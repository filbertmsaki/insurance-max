import { describe, expect, it } from 'vitest';
import { getCustomerDefaultValues } from '../../customers/schemas';
import {
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyRiskRow,
  type QuotationFormSchemaValues,
} from '../schemas';
import { resolveFactorValues } from '../wizard/utils/riskFactorResolver';
import type { RiskRequiredFactor } from '@/types/product-engine';

function createBaseValues(): QuotationFormSchemaValues {
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
    quotation_flow: 'NON_MOTOR',
    quotation_type: 'NON_MOTOR',
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
    cover_note_number: '',
    cover_note_desc: '',
    operative_clause: '',
    cover_note_type: '1',
    prev_cover_note_reference: '',
    endorsement_type: '',
    endorsement_reason: '',
    endorsement_premium_earned: '',
    commission_paid: '',
    commission_rate: '',
    officer_name: '',
    officer_title: '',
    payment_mode_tira: '1',
    risks: [createEmptyRiskRow()],
    addons: [],
    motor_mode: 'new',
    motor: createEmptyMotorDetails(),
    fleet: createEmptyFleetDetails(),
    nonMotor: createEmptyNonMotorDetails(),
  };
}

function requiredFactor(
  code: string,
  dataType: RiskRequiredFactor['factor']['data_type'] = 'NUMBER',
): RiskRequiredFactor {
  return {
    id: `required-${code}`,
    risk_id: 'risk-1',
    factor_id: `factor-${code}`,
    is_required: true,
    sort_order: 1,
    factor: {
      id: `factor-${code}`,
      code,
      name: code,
      data_type: dataType,
      unit: null,
      options: null,
      default_value: null,
      is_required: true,
      is_active: true,
      created_at: '2026-07-27T00:00:00.000Z',
    },
  };
}

describe('resolveFactorValues', () => {
  it('uses annual_turnover as the effective pricing base when explicit sum insured is blank', () => {
    const values = createBaseValues();
    values.risks[0].sum_insured = '';
    values.risks[0].factor_values = {
      annual_turnover: 125000000,
      number_of_locations: 3,
    };

    const resolved = resolveFactorValues(
      [
        requiredFactor('annual_turnover'),
        requiredFactor('number_of_locations'),
      ],
      values,
      0,
    );

    expect(resolved.sum_insured).toBe(125000000);
    expect(resolved.annual_turnover).toBe(125000000);
    expect(resolved.number_of_locations).toBe(3);
  });

  it('prefers the explicit sum insured when both sum insured and declared value exist', () => {
    const values = createBaseValues();
    values.risks[0].sum_insured = '5000000';
    values.risks[0].factor_values = {
      declared_value: 99000000,
    };

    const resolved = resolveFactorValues(
      [requiredFactor('declared_value')],
      values,
      0,
    );

    expect(resolved.sum_insured).toBe(5000000);
    expect(resolved.declared_value).toBe(99000000);
  });

  it('includes quotation-level values required by pricing', () => {
    const values = createBaseValues();
    values.quotation_type = 'MOTOR';
    values.currency = 'USD';
    values.exchange_rate = '2540.125';
    values.officer_name = 'Jane Officer';
    values.officer_title = 'Underwriter';

    const resolved = resolveFactorValues(
      [
        requiredFactor('payment_mode'),
        requiredFactor('currency_code', 'TEXT'),
        requiredFactor('exchange_rate'),
        requiredFactor('sale_point_code', 'TEXT'),
        requiredFactor('officer_name', 'TEXT'),
        requiredFactor('officer_title', 'TEXT'),
        requiredFactor('policy_holder_type'),
      ],
      values,
      0,
      { salePointCode: 'SP-01', policyHolderType: 1 },
    );

    expect(resolved).toMatchObject({
      payment_mode: 'Cash',
      currency_code: 'USD',
      exchange_rate: 2540.125,
      sale_point_code: 'SP-01',
      officer_name: 'Jane Officer',
      officer_title: 'Underwriter',
      policy_holder_type: 'Individual',
    });
  });
});
