import { act, fireEvent, render, screen } from '@testing-library/react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Form } from '@/components/ui/form';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import {
  createEmptyAddonRow,
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyRiskRow,
  type QuotationFormSchemaValues,
} from '../../../schemas';
import { RiskPremiumStep } from '../../steps/RiskPremiumStep';
import type { InsuranceRisk } from '@/types/product-engine';

vi.mock('../../hooks/useRiskPremiumCalculation', () => ({
  useRiskPremiumCalculation: () => ({
    calculateMutation: {
      isPending: false,
      isError: false,
      error: null,
    },
    requiredFactorsQuery: {
      data: [],
      isLoading: false,
    },
    handleSumInsuredBlur: vi.fn(),
  }),
}));

function createBaseValues(): QuotationFormSchemaValues {
  const risk = createEmptyRiskRow();
  risk.client_ref = 'risk-row-1';
  risk.risk_id = 'risk-1';
  risk.risk_code = 'MOTOR-COMP';
  risk.sum_insured = '1000000';
  risk.sum_insured_equivalent = '1000000';
  risk.premium_rate = '0.035';
  risk.premium_before_discount = '35000';
  risk.premium_after_discount = '33250';
  risk.premium_excluding_tax_equivalent = '33250';
  risk.premium_including_tax = '39235';
  risk.rating_result_metadata = {
    pricing_quote_id: 'PQ-2026-00000051',
    validation_errors: ['Sum insured is required'],
    validation_warnings: ['Referral to underwriting required'],
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

function TestHarness({
  onReady,
}: {
  onReady?: (form: UseFormReturn<QuotationFormSchemaValues>) => void;
}) {
  const form = useForm<QuotationFormSchemaValues>({
    defaultValues: createBaseValues(),
  });

  const fieldArray = useFieldArray({ control: form.control, name: 'risks' });
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  useEffect(() => {
    onReady?.(form);
  }, [form, onReady]);
  return (
    <QueryClientProvider client={client}>
      <Form {...form}>
        <RiskPremiumStep
          form={form}
          fieldArray={fieldArray}
          flow="MOTOR_SINGLE"
          riskOptions={
            [
              {
                id: 'risk-1',
                risk_code: 'MOTOR-COMP',
                risk_name: 'Private Comprehensive',
              },
            ] as unknown as InsuranceRisk[]
          }
          onRemoveRisk={vi.fn()}
          onAddRisk={vi.fn()}
        />
      </Form>
    </QueryClientProvider>
  );
}

describe('RiskRow', () => {
  it('keeps cover inputs editable and calculated premiums out of the form', () => {
    let form!: UseFormReturn<QuotationFormSchemaValues>;
    render(
      <TestHarness
        onReady={(value) => {
          form = value;
        }}
      />,
    );
    expect(screen.getByLabelText('Sum Insured')).not.toHaveAttribute(
      'readonly',
    );
    for (const label of [
      'Sum Insured Equivalent',
      'Premium Rate',
      'Premium Before Discount',
      'Premium After Discount',
      'Premium Including Tax',
    ]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(Number(form.getValues('risks.0.premium_before_discount'))).toBe(
      35000,
    );
    expect(screen.getByLabelText('Rate (%)')).toHaveAttribute('readonly');
  });

  it('keeps the discount dropdown open when a nested premium update refreshes the risk array', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    let form: UseFormReturn<QuotationFormSchemaValues>;
    render(
      <TestHarness
        onReady={(value) => {
          form = value;
        }}
      />,
    );
    const trigger = screen.getByLabelText('Discount Type');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await screen.findByRole('listbox');
    act(() => form.setValue('risks.0.premium_before_discount', '40000'));
    expect(trigger).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '1. Fleet discount' }));
    expect(form!.getValues('risks.0.discounts_offered.0.discount_type')).toBe(
      '1',
    );
  });

  it('mirrors sum insured into sum insured equivalent and does not show the optional-risk notice', () => {
    let form!: UseFormReturn<QuotationFormSchemaValues>;
    render(
      <TestHarness
        onReady={(value) => {
          form = value;
        }}
      />,
    );

    const sumInsuredInput = screen.getByLabelText('Sum Insured');

    fireEvent.change(sumInsuredInput, {
      target: { value: '0' },
    });

    expect(form.getValues('risks.0.sum_insured_equivalent')).toBe('0');
    expect(
      screen.queryByText(
        'Sum insured is not required for the selected Motor risk.',
      ),
    ).not.toBeInTheDocument();
  });

  it('hides the pricing status card and still shows discount request fields', () => {
    render(<TestHarness />);

    expect(
      screen.queryByText('Pricing needs attention'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Pricing available')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Pricing quote: PQ-2026-00000051'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reason Code')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Why is this discount requested?'),
    ).toBeInTheDocument();
  });

  it('recomputes dependent amounts after an authoritative premium update', () => {
    let form!: UseFormReturn<QuotationFormSchemaValues>;
    render(
      <TestHarness
        onReady={(value) => {
          form = value;
        }}
      />,
    );
    act(() => form.setValue('risks.0.premium_before_discount', '100000'));
    expect(Number(form.getValues('risks.0.premium_after_discount'))).toBe(
      100000,
    );
  });
});
