import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
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
import { RiskRow } from '../RiskRow';
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

function TestHarness() {
  const form = useForm<QuotationFormSchemaValues>({
    defaultValues: createBaseValues(),
  });

  return (
    <Form {...form}>
      <RiskRow
        form={form}
        index={0}
        riskOptions={
          [
            {
              id: 'risk-1',
              risk_code: 'MOTOR-COMP',
              risk_name: 'Private Comprehensive',
            },
          ] as unknown as InsuranceRisk[]
        }
        onRemove={vi.fn()}
        canRemove
      />
    </Form>
  );
}

describe('RiskRow', () => {
  it('renders premium, discount and tax fields as manually editable', () => {
    // Automatic calculation is temporarily disabled
    // (AUTO_CALCULATION_DISABLED in useRiskPremiumCalculation.ts), so nothing
    // fills these fields anymore — they must be editable so the wizard is
    // still usable in the meantime.
    render(<TestHarness />);

    expect(screen.getByLabelText('Sum Insured')).not.toHaveAttribute(
      'readonly',
    );
    expect(screen.getByLabelText('Sum Insured Equivalent')).toHaveAttribute(
      'readonly',
    );
    expect(screen.getByLabelText('Premium Rate')).not.toHaveAttribute(
      'readonly',
    );
    expect(
      screen.getByLabelText('Premium Before Discount'),
    ).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Premium After Discount')).not.toHaveAttribute(
      'readonly',
    );
    expect(
      screen.getByLabelText('Premium Excluding Tax Equivalent'),
    ).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Premium Including Tax')).not.toHaveAttribute(
      'readonly',
    );
    expect(screen.getByLabelText('Amount')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Tax Rate')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Tax Amount')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Rate')).not.toHaveAttribute('readonly');
  });

  it('mirrors sum insured into sum insured equivalent and does not show the optional-risk notice', () => {
    render(<TestHarness />);

    const sumInsuredInput = screen.getByLabelText('Sum Insured');
    const sumInsuredEquivalentInput = screen.getByLabelText(
      'Sum Insured Equivalent',
    );

    fireEvent.change(sumInsuredInput, {
      target: { value: '0' },
    });

    expect(sumInsuredEquivalentInput.value).toBe('0');
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

  it('only recomputes dependent premium fields once Premium Before Discount is blurred', () => {
    render(<TestHarness />);

    const premiumBeforeDiscountInput = screen.getByLabelText(
      'Premium Before Discount',
    );
    const premiumAfterDiscountInput = screen.getByLabelText(
      'Premium After Discount',
    );

    // The mount-time recompute already normalized this to match Premium
    // Before Discount (35000), since the fixture's default discount row has
    // no discount_type/discount_rate set.
    expect(Number(premiumAfterDiscountInput.value)).toBe(35000);

    // Typing alone must not trigger a recompute yet.
    fireEvent.change(premiumBeforeDiscountInput, {
      target: { value: '100000' },
    });
    expect(Number(premiumAfterDiscountInput.value)).toBe(35000);

    // Leaving the field commits the value and recomputes dependents.
    fireEvent.blur(premiumBeforeDiscountInput);
    expect(Number(premiumAfterDiscountInput.value)).toBe(100000);
  });
});
