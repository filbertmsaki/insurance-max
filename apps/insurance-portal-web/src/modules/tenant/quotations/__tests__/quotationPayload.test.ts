import { describe, expect, it } from 'vitest';
import { getCustomerDefaultValues } from '../../customers/schemas';
import {
  buildMotorFleetQuotationPayload,
  buildMotorSingleQuotationPayload,
  buildNonMotorQuotationPayload,
  createEmptyAddonRow,
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyRiskRow,
  quotationFormSchema,
  type QuotationFormSchemaValues,
} from '../schemas';
import { buildSingleRiskPricingSignature } from '../wizard/utils/pricingStaleness';

function createBaseValues(): QuotationFormSchemaValues {
  return {
    insurer_company_id: 'company-1',
    intermediary_company_id: '',
    branch_id: 'branch-1',
    department_id: '',
    policyholder_mode: 'new',
    customer_id: '',
    policyholder: {
      ...getCustomerDefaultValues(),
      full_name: 'ABC Logistics Company Limited',
      customer_type: 'CORPORATE',
      company_name: 'ABC Logistics Company Limited',
      date_of_birth: '2020-01-01',
      id_type: 1,
      id_number: 'TIN-123456',
      phone: '+255700000000',
      country_code: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ubungo',
      postal_address: 'P.O. Box 1',
    },
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
    valid_from: '2026-07-21',
    valid_until: '2027-07-20',
    rating_version: '',
    rejection_reason: '',
    sale_point_id: 'sale-point-1',
    cover_note_number: 'CN-TEST-001',
    cover_note_desc: 'Test cover note',
    operative_clause: 'Standard cover clause',
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
    risks: [createEmptyRiskRow()],
    addons: [createEmptyAddonRow()],
    motor_mode: 'new',
    motor: createEmptyMotorDetails(),
    fleet: createEmptyFleetDetails(),
    nonMotor: createEmptyNonMotorDetails(),
  };
}

describe('quotation payload builders', () => {
  it('does not send branch or sales-point identifiers from the wizard', () => {
    const payload = buildNonMotorQuotationPayload(createBaseValues(), {
      salePointCode: 'SP-CLIENT-MUST-NOT-BE-AUTHORITATIVE',
      productCode: 'PROD-NM',
    });

    expect(payload.internal_quotation).not.toHaveProperty('branch_id');
    expect(payload.internal_quotation).not.toHaveProperty('branchId');
    expect(payload.cover_note_dtl).not.toHaveProperty('sale_point_code');
    expect(payload.cover_note_dtl).not.toHaveProperty('salesPointCode');
  });

  it('builds MOTOR_SINGLE payload in backend snake_case shape', () => {
    const values = createBaseValues();
    values.quotation_flow = 'MOTOR_SINGLE';
    values.quotation_type = 'MOTOR';
    values.risks[0].risk_id = 'risk-1';
    values.risks[0].risk_code = 'OD';
    values.risks[0].sum_insured = '1000000';
    values.risks[0].sum_insured_equivalent = '1000000';
    values.risks[0].premium_rate = '0.05';
    values.risks[0].premium_before_discount = '50000';
    values.risks[0].premium_after_discount = '50000';
    values.risks[0].premium_excluding_tax_equivalent = '50000';
    values.risks[0].premium_including_tax = '59000';
    values.risks[0].rating_result_metadata = {
      pricing_quote_id: 'PQ-2026-00000001',
    };
    values.motor = {
      ...createEmptyMotorDetails(),
      motor_category_code: '1',
      motor_type_code: '1',
      registration_no: '   t123abc   ',
      chassis_no: '  chs-001 ',
      engine_no: ' eng-001  ',
      make: ' Toyota ',
      model: 'Land   Cruiser',
      model_no: ' gdh201 ',
      body_type: 'Minibus',
      color: 'White',
      manufacture_year: '2022',
      motor_usage_code: '2',
      seating_capacity: '14',
      cubic_capacity: '2755',
      fuel_type: 'Diesel',
      number_of_axles: '2',
      axle_distance: '3',
      tare_weight: '2100',
      gross_weight: '3300',
      owner_name: 'ABC Logistics Company Limited',
      owner_category: '2',
      owner_address: 'Makoka, Ubungo, Dar es Salaam',
    };

    const payload = buildMotorSingleQuotationPayload(values, {
      salePointCode: 'SP-01',
      productCode: 'PROD-01',
    });

    expect(payload.internal_quotation.quotation_flow).toBe('MOTOR_SINGLE');
    expect(payload.cover_note_dtl.motor_dtl?.registration_number).toBe(
      'T123ABC',
    );
    expect(payload.cover_note_dtl.motor_dtl?.chassis_number).toBe('CHS-001');
    expect(payload.cover_note_dtl.motor_dtl?.engine_number).toBe('ENG-001');
    expect(payload.cover_note_dtl.motor_dtl?.make).toBe('TOYOTA');
    expect(payload.cover_note_dtl.motor_dtl?.model).toBe('LAND CRUISER');
    expect(payload.cover_note_dtl.motor_dtl?.model_number).toBe('GDH201');
    expect(payload.cover_note_dtl.policy_holders?.[0].policy_holder_name).toBe(
      'ABC Logistics Company Limited',
    );
    expect(payload.cover_note_dtl.risks_covered?.[0].risk_code).toBe('OD');
    expect(payload.cover_note_dtl.risks_covered?.[0].pricing_quote_id).toBe(
      'PQ-2026-00000001',
    );
  });

  it('builds MOTOR_FLEET payload in backend snake_case shape', () => {
    const values = createBaseValues();
    values.quotation_flow = 'MOTOR_FLEET';
    values.quotation_type = 'MOTOR';
    values.is_fleet = true;
    values.fleet.header.fleet_id = 'FLEET-001';
    values.fleet.items[0].fleet_entry = '1';
    values.fleet.items[0].cover_note_number = 'CN-001';
    values.fleet.items[0].cover_note_desc = 'Fleet vehicle cover';
    values.fleet.items[0].operative_clause = 'Motor Comprehensive Cover';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_reference =
      'T123ABC';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_desc =
      'Toyota Hiace';
    values.fleet.items[0].risks_covered[0].risk_code = 'OD';
    values.fleet.items[0].risks_covered[0].sum_insured = '1000000';
    values.fleet.items[0].risks_covered[0].sum_insured_equivalent = '1000000';
    values.fleet.items[0].risks_covered[0].premium_rate = '0.05';
    values.fleet.items[0].risks_covered[0].premium_before_discount = '50000';
    values.fleet.items[0].risks_covered[0].premium_after_discount = '50000';
    values.fleet.items[0].risks_covered[0].premium_excluding_tax_equivalent =
      '50000';
    values.fleet.items[0].risks_covered[0].premium_including_tax = '59000';
    values.fleet.items[0].risks_covered[0].rating_result_metadata = {
      pricing_quote_id: 'PQ-2026-00000002',
    };
    values.fleet.items[0].motor_dtl = {
      motor_category: '1',
      motor_type: '1',
      registration_number: '  t123abc ',
      chassis_number: ' chs-001 ',
      make: ' Toyota ',
      model: 'Land   Cruiser',
      model_number: ' gdh201 ',
      body_type: 'Minibus',
      color: 'White',
      engine_number: ' eng-001 ',
      engine_capacity: '2755',
      fuel_used: 'Diesel',
      number_of_axles: '2',
      axle_distance: '3',
      sitting_capacity: '14',
      year_of_manufacture: '2022',
      tare_weight: '2100',
      gross_weight: '3300',
      motor_usage: '2',
      owner_name: 'ABC Logistics Company Limited',
      owner_category: '2',
      owner_address: 'Makoka, Ubungo, Dar es Salaam',
    };

    const payload = buildMotorFleetQuotationPayload(values, {
      salePointCode: 'SP-01',
      productCode: 'PROD-01',
    });

    expect(payload.internal_quotation.quotation_flow).toBe('MOTOR_FLEET');
    expect(payload.cover_note_dtl.fleet_hdr?.fleet_id).toBe('FLEET-001');
    expect(payload.cover_note_dtl.fleet_dtls).toHaveLength(1);
    expect(
      payload.cover_note_dtl.fleet_dtls?.[0].motor_dtl.registration_number,
    ).toBe('T123ABC');
    expect(
      payload.cover_note_dtl.fleet_dtls?.[0].motor_dtl.chassis_number,
    ).toBe('CHS-001');
    expect(payload.cover_note_dtl.fleet_dtls?.[0].motor_dtl.engine_number).toBe(
      'ENG-001',
    );
    expect(payload.cover_note_dtl.fleet_dtls?.[0].motor_dtl.make).toBe(
      'TOYOTA',
    );
    expect(payload.cover_note_dtl.fleet_dtls?.[0].motor_dtl.model).toBe(
      'LAND CRUISER',
    );
    expect(payload.cover_note_dtl.fleet_dtls?.[0].motor_dtl.model_number).toBe(
      'GDH201',
    );
    expect(
      payload.cover_note_dtl.fleet_dtls?.[0].risks_covered[0].pricing_quote_id,
    ).toBe('PQ-2026-00000002');
  });

  it('builds NON_MOTOR payload in backend snake_case shape', () => {
    const values = createBaseValues();
    values.nonMotor.items = [
      {
        subject_matter_reference: 'SUB-001',
        subject_matter_desc: 'Warehouse stock',
      },
    ];
    values.risks[0].risk_id = 'risk-1';
    values.risks[0].risk_code = 'FIRE';
    values.risks[0].sum_insured = '5000000';
    values.risks[0].sum_insured_equivalent = '5000000';
    values.risks[0].premium_rate = '0.02';
    values.risks[0].premium_before_discount = '100000';
    values.risks[0].premium_after_discount = '100000';
    values.risks[0].premium_excluding_tax_equivalent = '100000';
    values.risks[0].premium_including_tax = '118000';

    const payload = buildNonMotorQuotationPayload(values, {
      salePointCode: 'SP-01',
      productCode: 'PROD-NM',
    });

    expect(payload.internal_quotation.quotation_flow).toBe('NON_MOTOR');
    expect(payload.cover_note_dtl.motor_dtl).toBeUndefined();
    expect(payload.cover_note_dtl.subject_matters_covered?.[0]).toEqual({
      subject_matter_reference: 'SUB-001',
      subject_matter_desc: 'Warehouse stock',
    });
  });

  it('omits stale pricing_quote_id when quote-sensitive inputs no longer match', () => {
    const values = createBaseValues();
    values.quotation_flow = 'MOTOR_SINGLE';
    values.quotation_type = 'MOTOR';
    values.risks[0].risk_id = 'risk-1';
    values.risks[0].risk_code = 'OD';
    values.risks[0].sum_insured = '1000000';
    values.risks[0].sum_insured_equivalent = '1000000';
    values.risks[0].premium_rate = '0.05';
    values.risks[0].premium_before_discount = '50000';
    values.risks[0].premium_after_discount = '50000';
    values.risks[0].premium_excluding_tax_equivalent = '50000';
    values.risks[0].premium_including_tax = '59000';
    values.risks[0].rating_result_metadata = {
      pricing_quote_id: 'PQ-2026-00000009',
      pricing_input_signature: 'old-signature',
      pricing_is_stale: false,
    };
    values.motor = {
      ...createEmptyMotorDetails(),
      motor_category_code: '1',
      motor_type_code: '1',
      registration_no: 'T123ABC',
      chassis_no: 'CHS-001',
      engine_no: 'ENG-001',
      make: 'Toyota',
      model: 'Hiace',
      manufacture_year: '2022',
      motor_usage_code: '2',
    };

    const payload = buildMotorSingleQuotationPayload(values, {
      salePointCode: 'SP-01',
      productCode: 'PROD-01',
    });

    expect(
      payload.cover_note_dtl.risks_covered?.[0].pricing_quote_id,
    ).toBeNull();
  });

  it('keeps pricing_quote_id when calculated fields change but the pricing inputs still match', () => {
    const values = createBaseValues();
    values.quotation_flow = 'MOTOR_SINGLE';
    values.quotation_type = 'MOTOR';
    values.risks[0].risk_id = 'risk-1';
    values.risks[0].risk_code = 'SP014001000002';
    values.risks[0].sum_insured = '50000000';
    values.risks[0].sum_insured_equivalent = '50000000';
    values.risks[0].premium_rate = '0.035';
    values.risks[0].premium_before_discount = '1750000';
    values.risks[0].premium_after_discount = '1575000';
    values.risks[0].premium_excluding_tax_equivalent = '1575000';
    values.risks[0].premium_including_tax = '2016000';
    values.risks[0].discounts_offered[0] = {
      ...values.risks[0].discounts_offered[0],
      discount_type: '1',
      discount_rate: '0.10',
      discount_amount: '175000',
    };
    values.risks[0].taxes_charged[0] = {
      ...values.risks[0].taxes_charged[0],
      tax_code: 'VAT-MAINLAND',
      tax_rate: '0.18',
      tax_amount: '283500',
    };
    values.motor = {
      ...createEmptyMotorDetails(),
      motor_category_code: '1',
      motor_type_code: '1',
      registration_no: 'T123ABC',
      chassis_no: 'CHS-001',
      engine_no: 'ENG-001',
      make: 'Toyota',
      model: 'Hiace',
      manufacture_year: '2022',
      motor_usage_code: '2',
    };

    values.risks[0].rating_result_metadata = {
      pricing_quote_id: 'PQ-2026-00000012',
      pricing_input_signature: buildSingleRiskPricingSignature({
        quotation_type: values.quotation_type,
        product_id: values.product_id,
        valid_from: values.valid_from,
        valid_until: values.valid_until,
        currency: values.currency,
        exchange_rate: values.exchange_rate,
        motor: values.motor,
        addons: values.addons,
        risk: {
          risk_id: values.risks[0].risk_id,
          risk_code: values.risks[0].risk_code,
          sum_insured: values.risks[0].sum_insured,
          factor_values: values.risks[0].factor_values,
          discounts_offered: values.risks[0].discounts_offered,
          taxes_charged: values.risks[0].taxes_charged,
        },
      }),
      pricing_is_stale: false,
      calculated_at: '2026-07-28T05:14:50.278Z',
    };

    const payload = buildMotorSingleQuotationPayload(values, {
      salePointCode: 'SP-01',
      productCode: 'PROD-01',
    });

    expect(payload.cover_note_dtl.risks_covered?.[0].pricing_quote_id).toBe(
      'PQ-2026-00000012',
    );
  });

  it('validates duplicate fleet registrations', () => {
    const values = createBaseValues();
    values.quotation_flow = 'MOTOR_FLEET';
    values.quotation_type = 'MOTOR';
    values.is_fleet = true;
    values.fleet.items = [
      createEmptyFleetDetails().items[0],
      createEmptyFleetDetails().items[0],
    ];
    values.fleet.items[0].cover_note_number = 'CN-001';
    values.fleet.items[0].cover_note_desc = 'Vehicle 1';
    values.fleet.items[0].operative_clause = 'Motor Comprehensive Cover';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_reference =
      'T123ABC';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_desc =
      'Vehicle 1';
    values.fleet.items[0].risks_covered[0].risk_code = 'OD';
    values.fleet.items[0].motor_dtl.registration_number = 'T123ABC';
    values.fleet.items[0].motor_dtl.chassis_number = 'CHS-001';
    values.fleet.items[0].motor_dtl.engine_number = 'ENG-001';
    values.fleet.items[1].cover_note_number = 'CN-002';
    values.fleet.items[1].cover_note_desc = 'Vehicle 2';
    values.fleet.items[1].operative_clause = 'Motor Comprehensive Cover';
    values.fleet.items[1].subject_matters_covered[0].subject_matter_reference =
      'T123ABD';
    values.fleet.items[1].subject_matters_covered[0].subject_matter_desc =
      'Vehicle 2';
    values.fleet.items[1].risks_covered[0].risk_code = 'OD';
    values.fleet.items[1].motor_dtl.registration_number = 'T123ABC';
    values.fleet.items[1].motor_dtl.chassis_number = 'CHS-002';
    values.fleet.items[1].motor_dtl.engine_number = 'ENG-002';

    const result = quotationFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.toLowerCase().includes('duplicate registration number'),
        ),
      ).toBe(true);
    }
  });
});
