import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import {
  createEmptyAddonRow,
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyRiskRow,
  type QuotationFormSchemaValues,
} from '../../../schemas';
import { useRiskPremiumCalculation } from '../useRiskPremiumCalculation';

const mutateMock = vi.fn();

vi.mock('@/modules/pricing', () => ({
  usePricingCalculator: () => ({
    calculateSingleMutation: {
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    },
  }),
  usePricingRequiredFactors: () => ({ data: [], isLoading: false }),
  usePricingRulePreview: () => ({ data: { data: [] } }),
  readPricingQuoteMetadata: (value: unknown) =>
    value as Record<string, unknown> | null,
}));

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
  } as QuotationFormSchemaValues;
}

function renderRiskPricingHook(
  riskOverrides: Partial<QuotationFormSchemaValues['risks'][number]> = {},
) {
  const { result: formResult } = renderHook(() =>
    useForm<QuotationFormSchemaValues>({
      defaultValues: buildFormValues(riskOverrides),
    }),
  );
  const form = formResult.current;

  const hook = renderHook(() => useRiskPremiumCalculation(form, 0));
  return { form, hook };
}

describe('useRiskPremiumCalculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutateMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes the requested discount rate in the calculation payload once sum insured is committed', () => {
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

  it('omits the discount field entirely when no discount rate is requested', () => {
    const { hook } = renderRiskPricingHook();

    act(() => {
      hook.result.current.handleSumInsuredBlur();
    });
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0].discount).toBeUndefined();
  });

  it('discards an earlier calculation response that resolves after a newer one (stale response guard)', () => {
    const { form, hook } = renderRiskPricingHook();

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
      } as any);
    });
    // ...then the stale, earlier request (#1) resolves late.
    act(() => {
      firstCallOptions.onSuccess({
        ...baseResult,
        premium_rate: 0.035,
        premium_before_discount: 350000,
      } as any);
    });

    // The stale (#1) result must NOT have overwritten the newer (#2) one.
    expect(form.getValues('risks.0.premium_rate')).toBe('0.999');
  });
});
