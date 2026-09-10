import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import {
  createEmptyAddonRow,
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyRiskRow,
  createEmptyRiskTaxRow,
  type QuotationFormSchemaValues,
} from '../../../schemas';
import { useRiskPremiumCalculation } from '../useRiskPremiumCalculation';

const { mutateMock, apiGetMock, rulePreviewDataMock, requiredFactorsDataMock } =
  vi.hoisted(() => ({
    mutateMock: vi.fn(),
    apiGetMock: vi.fn(),
    rulePreviewDataMock: vi.fn(),
    requiredFactorsDataMock: vi.fn(),
  }));

vi.mock('@/modules/shared/api/client', () => ({
  apiClient: {
    get: apiGetMock,
  },
}));

vi.mock('@/modules/pricing', () => ({
  usePricingCalculator: () => ({
    calculateSingleMutation: {
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    },
  }),
  usePricingRequiredFactors: () => ({
    data: requiredFactorsDataMock(),
    isLoading: false,
  }),
  usePricingRulePreview: () => ({ data: { data: rulePreviewDataMock() } }),
  readPricingQuoteMetadata: (value: unknown) =>
    value as Record<string, unknown> | null,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function buildFormValues(
  riskOverrides: Partial<QuotationFormSchemaValues['risks'][number]> = {},
): QuotationFormSchemaValues {
  const risk = {
    ...createEmptyRiskRow(),
    client_ref: 'risk-row-1',
    risk_id: 'risk-1',
    risk_code: 'MOTOR-COMP',
    sum_insured: '10000000',
    ...riskOverrides,
  };

  return {
    insurer_company_id: 'company-1',
    intermediary_company_id: '',
    branch_id: 'branch-1',
    department_id: '',
    policyholder_mode: 'new',
    customer_id: '',
    policyholder: getCustomerDefaultValues(),
    category_id: 'category-1',
    product_id: 'product-1',
    sub_class_id: '',
    quotation_flow: 'MOTOR_SINGLE',
    quotation_type: 'MOTOR',
    is_fleet: false,
    channel_type: 'DIRECT',
    status: 'DRAFT',
    currency: 'TZS',
    exchange_rate: '1',
    sum_insured: '',
    basic_premium: '',
    total_discount: '',
    total_tax: '',
    total_charges: '',
    total_commission: '',
    total_premium: '',
    net_premium: '',
    valid_from: '2026-07-27',
    valid_until: '2027-07-26',
    rating_version: '',
    rejection_reason: '',
    sale_point_id: 'sale-point-1',
    cover_note_number: 'CN-001',
    cover_note_desc: 'Motor quote',
    operative_clause: 'Standard cover',
    cover_note_type: '1',
    prev_cover_note_reference: '',
    endorsement_type: '',
    endorsement_reason: '',
    endorsement_premium_earned: '',
    commission_paid: '',
    commission_rate: '',
    officer_name: 'Underwriter One',
    officer_title: 'Underwriter',
    payment_mode_tira: '1',
    risks: [risk],
    addons: [createEmptyAddonRow()],
    motor_mode: 'new',
    motor: createEmptyMotorDetails(),
    fleet: createEmptyFleetDetails(),
    nonMotor: createEmptyNonMotorDetails(),
  };
}

function renderRiskPricingHook(
  riskOverrides: Partial<QuotationFormSchemaValues['risks'][number]> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const wrapper = createWrapper(queryClient);
  const { result: formResult } = renderHook(
    () =>
      useForm<QuotationFormSchemaValues>({
        defaultValues: buildFormValues(riskOverrides),
      }),
    { wrapper },
  );
  const form = formResult.current;

  const hook = renderHook(() => useRiskPremiumCalculation(form, 0), {
    wrapper,
  });
  return { form, hook, queryClient };
}

async function settleTaxRuleQuery() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useRiskPremiumCalculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutateMock.mockReset();
    apiGetMock.mockReset();
    rulePreviewDataMock.mockReset();
    requiredFactorsDataMock.mockReset();
    apiGetMock.mockResolvedValue({ data: [] });
    rulePreviewDataMock.mockReturnValue([]);
    requiredFactorsDataMock.mockReturnValue([]);
    useAuthStore.setState({
      company: {
        id: 'company-1',
        name: 'Test Company',
        slug: 'test-company',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.setState({
      company: null,
      user: null,
    });
  });

  it('prefills zero sum insured and keeps pricing in preview mode for risks that do not require it', async () => {
    rulePreviewDataMock.mockReturnValue([
      {
        is_active: true,
        priority: 1,
        minimum_amount: 100000,
        percentage_rate: 0.015,
      },
    ]);
    requiredFactorsDataMock.mockReturnValue([
      {
        factor: {
          code: 'seat_capacity',
          name: 'Seat Capacity',
          data_type: 'INTEGER',
        },
      },
    ]);

    const { form } = renderRiskPricingHook({
      sum_insured: '',
      factor_values: {
        seat_capacity: 14,
      },
    });

    await settleTaxRuleQuery();

    expect(form.getValues('risks.0.sum_insured')).toBe('0');
    expect(form.getValues('risks.0.sum_insured_equivalent')).toBe('0');
    expect(form.getValues('risks.0.premium_rate')).toBe('0.015');
    expect(form.getValues('risks.0.minimum_amount')).toBe('100000');
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('does not schedule another request when only calculated amounts or object identities change', async () => {
    const { form, hook } = renderRiskPricingHook({
      taxes_charged: [
        {
          ...createEmptyRiskTaxRow(),
          tax_code: 'VAT-MAINLAND',
          tax_rate: '0.18',
          tax_amount: '',
        },
      ],
    });
    await settleTaxRuleQuery();
    act(() => hook.result.current.handleSumInsuredBlur());
    act(() => vi.advanceTimersByTime(450));
    expect(mutateMock).toHaveBeenCalledTimes(1);
    act(() => {
      form.setValue('risks.0.taxes_charged.0.tax_amount', '18000');
      form.setValue('risks.0.factor_values', {
        ...form.getValues('risks.0.factor_values'),
      });
    });
    act(() => vi.advanceTimersByTime(450));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  describe('automatic calculation', () => {
    it('includes the requested discount rate in the calculation payload once sum insured is committed', async () => {
      const { form, hook } = renderRiskPricingHook({
        discounts_offered: [
          {
            discount_type: '1',
            discount_rate: '0.05',
            discount_amount: '',
            request_reason_code: '',
            request_comment: '',
            effective_from: '',
            effective_to: '',
            requested_by: '',
            requested_at: '',
            max_permitted_rate: '',
            max_permitted_amount: '',
            approval_required: false,
            approval_status: '',
            approved_rate: '',
            approved_amount: '',
            approved_by: '',
            approval_date: '',
            rejection_reason: '',
          },
        ],
      });

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock.mock.calls[0][0]).toMatchObject({
        risk_id: 'risk-1',
        sum_insured: 10000000,
        discount: { rate: 0.05 },
      });
      void form;
    });

    it('omits the discount field entirely when no discount rate is requested', async () => {
      const { hook } = renderRiskPricingHook({
        discounts_offered: [
          {
            ...createEmptyRiskRow().discounts_offered[0],
            discount_type: '',
            discount_rate: '',
          },
        ],
      });

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock.mock.calls[0][0].discount).toBeUndefined();
    });

    it('sends only the tax codes selected on the risk row in the calculation payload', async () => {
      const { hook } = renderRiskPricingHook({
        taxes_charged: [
          {
            ...createEmptyRiskTaxRow(),
            tax_code: 'WITHHOLDING',
            tax_rate: '0.10',
          },
        ],
      });

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock.mock.calls[0][0].tax_codes).toEqual(['WITHHOLDING']);
    });

    it('sends an empty tax_codes array when every tax row is exempted', async () => {
      const { hook } = renderRiskPricingHook({
        taxes_charged: [
          {
            ...createEmptyRiskTaxRow(),
            tax_code: 'VAT-MAINLAND',
            is_tax_exempted: true,
          },
        ],
      });

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock.mock.calls[0][0].tax_codes).toEqual([]);
    });

    it('still requests authoritative pricing when the preview minimum premium is higher than the sum insured', async () => {
      rulePreviewDataMock.mockReturnValue([
        {
          is_active: true,
          priority: 1,
          minimum_amount: 250000,
          percentage_rate: 0.035,
        },
      ]);

      const { form, hook } = renderRiskPricingHook({
        sum_insured: '50000',
      });

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(form.getValues('risks.0.minimum_amount')).toBe('250000');
      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock.mock.calls[0][0]).toMatchObject({
        risk_id: 'risk-1',
        sum_insured: 50000,
      });
    });

    it('discards an earlier calculation response that resolves after a newer one (stale response guard)', async () => {
      const { form, hook } = renderRiskPricingHook();

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });
      expect(mutateMock).toHaveBeenCalledTimes(1);
      const firstCallOptions = mutateMock.mock.calls[0][1];

      // Trigger a second calculation cycle (a discount edit changes the
      // pricing signature and re-arms the debounce).
      act(() => {
        form.setValue('risks.0.discounts_offered.0.discount_rate', '0.1');
      });
      hook.rerender();
      act(() => {
        vi.advanceTimersByTime(450);
      });
      expect(mutateMock).toHaveBeenCalledTimes(2);
      const secondCallOptions = mutateMock.mock.calls[1][1];

      const baseResult = {
        risk_id: 'risk-1',
        risk_code: 'MOTOR-COMP',
        risk_name: 'Private Comprehensive',
        sum_insured: 10000000,
        sum_insured_equivalent: 10000000,
        percentage_rate: 0.035,
        charges: [],
      };

      // The newer request (#2) resolves first...
      act(() => {
        secondCallOptions.onSuccess({
          ...baseResult,
          premium_rate: 0.999,
          premium_before_discount: 999000,
        });
      });
      // ...then the stale, earlier request (#1) resolves late.
      act(() => {
        firstCallOptions.onSuccess({
          ...baseResult,
          premium_rate: 0.035,
          premium_before_discount: 350000,
        });
      });

      // The stale (#1) result must NOT have overwritten the newer (#2) one.
      expect(form.getValues('risks.0.premium_rate')).toBe('0.999');
    });

    it('does not trigger a second pricing request when only computed discount and tax amounts change', async () => {
      const { hook } = renderRiskPricingHook({
        discounts_offered: [
          {
            ...createEmptyRiskRow().discounts_offered[0],
            discount_type: '1',
            discount_rate: '0.10',
          },
        ],
        taxes_charged: [
          {
            ...createEmptyRiskTaxRow(),
            tax_code: 'VAT-MAINLAND',
            tax_rate: '0.18',
          },
        ],
      });

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(mutateMock).toHaveBeenCalledTimes(1);
      const callOptions = mutateMock.mock.calls[0][1];

      act(() => {
        callOptions.onSuccess({
          risk_id: 'risk-1',
          risk_code: 'MOTOR-COMP',
          risk_name: 'Private Comprehensive',
          sum_insured: 10000000,
          sum_insured_equivalent: 10000000,
          percentage_rate: 0.035,
          premium_rate: 0.035,
          premium_before_discount: 350000,
          discount_amount: 35000,
          premium_after_discount: 315000,
          premium_excluding_tax_equivalent: 315000,
          premium_including_tax: 371700,
          charges: [
            {
              applied_rule_id: 'tax-rule-vat',
              charge_code: 'VAT-MAINLAND',
              charge_name: 'VAT',
              charge_category: 'TAX',
              charge_scope: 'RISK',
              charge_type: 'PERCENTAGE',
              calculation_base: 'NET_PREMIUM',
              base_amount: 315000,
              rate: 0.18,
              fixed_amount: null,
              minimum_charge_amount: null,
              maximum_charge_amount: null,
              computed_amount: 56700,
              is_taxable: false,
              effective_from: '2026-01-01',
              effective_to: '2026-12-31',
            },
          ],
          discount_control: {
            max_rate: null,
            max_amount: null,
            approval_threshold_rate: null,
            approval_threshold_amount: null,
            effective_from: null,
            effective_to: null,
          },
          loading_control: {
            max_rate: null,
            max_amount: null,
            approval_threshold_rate: null,
            approval_threshold_amount: null,
            effective_from: null,
            effective_to: null,
          },
          validation_errors: [],
          validation_warnings: [],
        });
      });

      hook.rerender();
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(mutateMock).toHaveBeenCalledTimes(1);
    });

    it('applies legacy calculation payloads to premium fields without replacing them with zeroes', async () => {
      const { form, hook } = renderRiskPricingHook();

      await settleTaxRuleQuery();
      act(() => {
        hook.result.current.handleSumInsuredBlur();
      });
      act(() => {
        vi.advanceTimersByTime(450);
      });

      expect(mutateMock).toHaveBeenCalledTimes(1);
      const callOptions = mutateMock.mock.calls[0][1];

      act(() => {
        callOptions.onSuccess({
          risk_id: 'risk-1',
          risk_code: 'SP014001000001',
          risk_name: 'Motor Comprehensive',
          sum_insured: 50000000,
          base_premium: 1750000,
          gross_premium: 1750000,
          final_premium: 1750000,
          percentage_rate: 0.035,
          charges: [],
          premium_including_charges: 1750000,
          premium_breakdown: {
            items: [
              {
                premium_after_discount: 1750000,
                raw_premium: 1750000,
              },
            ],
            totals: {
              raw_premium: 1750000,
              premium_after_discount: 1750000,
              payable_premium: 1750000,
            },
          },
          discount_control: {
            max_rate: null,
            max_amount: null,
            approval_threshold_rate: null,
            approval_threshold_amount: null,
            effective_from: null,
            effective_to: null,
          },
          loading_control: {
            max_rate: null,
            max_amount: null,
            approval_threshold_rate: null,
            approval_threshold_amount: null,
            effective_from: null,
            effective_to: null,
          },
          validation_errors: [],
          validation_warnings: [],
        });
      });

      expect(form.getValues('risks.0.premium_before_discount')).toBe('1750000');
      expect(form.getValues('risks.0.premium_after_discount')).toBe('1750000');
      expect(form.getValues('risks.0.premium_excluding_tax_equivalent')).toBe(
        '1750000',
      );
      expect(form.getValues('risks.0.premium_including_tax')).toBe('1750000');
    });
  });
});
