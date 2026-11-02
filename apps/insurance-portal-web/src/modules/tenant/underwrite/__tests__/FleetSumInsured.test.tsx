import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import { Form } from '@/components/ui/form';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { pricingApi } from '@/modules/pricing';
import {
  createEmptyFleetItemRow,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import { MotorFleetDetailsStep } from '@/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep';
import { peKeys } from '@/modules/tenant/product-engine/hooks/query-keys';
import type {
  InsuranceRisk,
  RiskRuleExplanation,
} from '@/types/product-engine';
import { defaultValuesForLine } from '../wizard/defaults';
import { FleetPremiumStep } from '../fleet/FleetPremiumStep';
import type { UnderwriteQuotationWizard } from '../wizard/useUnderwriteQuotationWizard';
import { getUnderwriteLineMeta } from '../lines';

vi.mock(
  '@/modules/tenant/quotations/wizard/components/VehicleDetailsFields',
  () => ({ VehicleDetailsFields: () => null }),
);
vi.mock('@/modules/tenant/quotations/wizard/components/VehicleLookup', () => ({
  VehicleLookup: () => null,
}));
const risks = ['positive', 'zero', 'negative', 'unknown'].map(
  (id) =>
    ({
      id,
      risk_code: id.toUpperCase(),
      risk_name: id,
      product_id: 'product',
      sub_class_id: null,
      description: null,
      is_active: true,
      created_at: '',
    }) satisfies InsuranceRisk,
);
function explanation(riskId: string, rate: number): RiskRuleExplanation {
  return {
    risk_id: riskId,
    risk_code: riskId.toUpperCase(),
    risk_name: riskId,
    rule_id: 'rule-' + riskId,
    rule_name: 'Base rate',
    priority: 1,
    rate_type: rate > 0 ? 'PERCENTAGE' : 'FIXED',
    percentage_rate: rate,
    fixed_amount: 1000,
    per_unit_amount: 0,
    per_unit_factor_code: null,
    minimum_amount: 0,
    formula: null,
    conditions: [],
    other_active_rule_count: 0,
  };
}
function renderFleet(selectedRiskId: string, withPremiumStep = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const risk of risks)
    queryClient.setQueryData(peKeys.requiredFactors.byRisk(risk.id), []);
  for (const [id, rate] of [
    ['positive', 0.035],
    ['zero', 0],
    ['negative', -1],
  ] as const)
    queryClient.setQueryData(['pricing', 'explain', id], explanation(id, rate));
  let form!: UseFormReturn<QuotationFormSchemaValues>;
  function Harness() {
    const defaults = defaultValuesForLine(
      getUnderwriteLineMeta(UnderwriteLine.FLEET),
    );
    form = useForm<QuotationFormSchemaValues>({
      defaultValues: {
        ...defaults,
        valid_from: '2026-11-01',
        valid_until: '2027-10-31',
        fleet: {
          ...defaults.fleet,
          header: {
            ...defaults.fleet.header,
            cover: {
              ...defaults.fleet.header.cover,
              risk_id: selectedRiskId,
              risk_code: selectedRiskId.toUpperCase(),
            },
          },
          items: [1, 2].map((entry) => {
            const item = createEmptyFleetItemRow();
            return {
              ...item,
              fleet_entry: String(entry),
              motor_dtl: {
                ...item.motor_dtl,
                registration_number: 'T00' + entry + 'AAA',
                make: 'TOYOTA',
                model: 'HILUX',
              },
              risks_covered: [
                {
                  ...item.risks_covered[0],
                  risk_id: selectedRiskId,
                  risk_code: selectedRiskId.toUpperCase(),
                  sum_insured: '10000',
                  sum_insured_equivalent: '10000',
                  factor_values: { sum_insured: 10000 },
                },
              ],
            };
          }),
        },
      },
    });
    const fieldArray = useFieldArray({
      control: form.control,
      name: 'fleet.items',
    });
    return (
      <Form {...form}>
        <MotorFleetDetailsStep
          form={form}
          fieldArray={fieldArray}
          riskOptions={risks}
          customerOptions={[]}
          vehicleOptions={[]}
          onAddVehicle={() => undefined}
          onRemoveVehicle={() => undefined}
          onDuplicateVehicle={() => undefined}
          onImportVehicles={() => undefined}
        />
        {/* The fleet-wide Calculate Fleet Premium action lives on the Premium step. */}
        {withPremiumStep && (
          <FleetPremiumStep
            wizard={
              {
                form,
                riskOptions: risks,
              } as unknown as UnderwriteQuotationWizard
            }
            onEditVehicles={() => undefined}
          />
        )}
      </Form>
    );
  }
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
  return { getForm: () => form, queryClient };
}
function openFirstVehicle() {
  fireEvent.click(
    within(screen.getByRole('table')).getAllByRole('button', {
      name: 'Edit',
    })[0],
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, company: null });
});

describe('Fleet sum insured visibility', () => {
  it('shows the input for a positive selected risk rate and retains the entered value', async () => {
    const { getForm } = renderFleet('positive');
    openFirstVehicle();
    expect(
      await screen.findByRole('spinbutton', { name: /sum insured/i }),
    ).toHaveValue(10000);
    expect(
      getForm().getValues('fleet.items.1.risks_covered.0.sum_insured'),
    ).toBe('10000');
  });
  it.each(['zero', 'negative'])(
    'hides the input and clears all fleet entries for a %s rate',
    async (id) => {
      const { getForm } = renderFleet(id);
      await waitFor(() =>
        expect(
          getForm().getValues('fleet.items.1.risks_covered.0.sum_insured'),
        ).toBe('0'),
      );
      openFirstVehicle();
      expect(
        screen.queryByRole('spinbutton', { name: /sum insured/i }),
      ).toBeNull();
      for (const item of getForm().getValues('fleet.items')) {
        expect(item.risks_covered[0]).toMatchObject({
          sum_insured: '0',
          sum_insured_equivalent: '0',
          factor_values: { sum_insured: 0 },
        });
      }
    },
  );
  it('clears previous values when switching to a zero-rate risk', async () => {
    const { getForm } = renderFleet('positive');
    act(() => {
      getForm().setValue('fleet.header.cover.risk_id', 'zero');
      getForm().setValue('fleet.header.cover.risk_code', 'ZERO');
    });
    await waitFor(() =>
      expect(
        getForm().getValues('fleet.items.1.risks_covered.0.sum_insured'),
      ).toBe('0'),
    );
    openFirstVehicle();
    expect(
      screen.queryByRole('spinbutton', { name: /sum insured/i }),
    ).toBeNull();
  });
  it('does not clear values while the selected rate is still unknown', () => {
    vi.spyOn(pricingApi, 'explainRisk').mockImplementation(
      () => new Promise(() => undefined),
    );
    const { getForm } = renderFleet('unknown');
    openFirstVehicle();
    expect(
      screen.queryByRole('spinbutton', { name: /sum insured/i }),
    ).toBeNull();
    expect(
      getForm().getValues('fleet.items.0.risks_covered.0.sum_insured'),
    ).toBe('10000');
  });
  it('sends zero sums insured in the calculation request for zero-rate risks', async () => {
    const calculate = vi
      .spyOn(pricingApi, 'calculateFleet')
      .mockRejectedValue(new Error('Stop after capturing payload'));
    renderFleet('zero', true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate Fleet Premium' }),
    );
    await waitFor(() => expect(calculate).toHaveBeenCalled());
    expect(calculate.mock.calls[0][0]).toMatchObject({
      vehicles: expect.arrayContaining([
        expect.objectContaining({
          sum_insured: 0,
          factors: expect.objectContaining({ sum_insured: 0 }),
        }),
      ]),
    });
    expect(calculate.mock.calls[0][0].vehicles).toHaveLength(2);
  });
  it('calculates once after saving a valid vehicle, without recalculating while typing', async () => {
    const calculate = vi
      .spyOn(pricingApi, 'calculateFleet')
      .mockRejectedValue(new Error('Stop after capturing payload'));
    const { getForm } = renderFleet('zero');
    act(() => {
      const form = getForm();
      form.setValue('product_id', 'product');
      form.setValue('cover_note_desc', 'Generated vehicle cover');
      form.setValue('operative_clause', 'Generated operative clause');
      const current = form.getValues('fleet.items.0.motor_dtl');
      form.setValue('fleet.items.0.motor_dtl', {
        ...current,
        motor_type: '1',
        motor_category: '1',
        registration_number: 'T001AAA',
        chassis_number: 'CHASSIS001',
        engine_number: 'ENGINE001',
        make: 'TOYOTA',
        model: 'HILUX',
        body_type: 'PICKUP',
        color: 'WHITE',
        year_of_manufacture: '2020',
        engine_capacity: '2000',
        fuel_used: 'DIESEL',
        tare_weight: '1000',
        gross_weight: '2000',
        owner_category: '1',
      });
    });
    openFirstVehicle();
    act(() =>
      getForm().setValue('fleet.items.0.motor_dtl.model', 'HILUX UPDATED'),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(calculate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));
    await waitFor(() => expect(calculate).toHaveBeenCalledTimes(1));
    expect(calculate.mock.calls[0][0].vehicles[0]).toMatchObject({
      sum_insured: 0,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(calculate).toHaveBeenCalledTimes(1);
  });
  it('does not calculate for an invalid vehicle or when cancelling the editor', async () => {
    const calculate = vi
      .spyOn(pricingApi, 'calculateFleet')
      .mockRejectedValue(new Error('Unexpected calculation'));
    renderFleet('zero');
    openFirstVehicle();
    fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));
    await screen.findByText("This vehicle can't be saved yet:");
    expect(calculate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calculate).not.toHaveBeenCalled();
  });
});
