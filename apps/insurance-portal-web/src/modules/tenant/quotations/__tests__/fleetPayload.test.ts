import { describe, expect, it } from 'vitest';
import {
  buildQuotationPayload,
  createEmptyAddonRow,
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyRiskRow,
  quotationFormSchema,
} from '../schemas';
import { getCustomerDefaultValues } from '../../customers/schemas';
import type { QuotationFormSchemaValues } from '../schemas';

function buildFleetForm(overrides: Partial<QuotationFormSchemaValues> = {}) {
  const values: QuotationFormSchemaValues = {
    insurer_company_id: 'company-1',
    intermediary_company_id: '',
    branch_id: 'branch-1',
    department_id: '',
    policyholder_mode: 'new',
    customer_id: 'customer-1',
    policyholder: {
      ...getCustomerDefaultValues(),
      full_name: 'Fleet Holder Ltd',
      customer_type: 'CORPORATE',
      company_name: 'Fleet Holder Ltd',
      date_of_birth: '2020-01-01',
      id_type: 1,
      id_number: 'ID-1',
      phone: '+255700000000',
      email: 'fleet@example.com',
      country_code: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ilala',
      postal_address: 'P.O. Box 1',
    },
    category_id: 'category-1',
    product_id: 'product-1',
    sub_class_id: '',
    risks: [createEmptyRiskRow()],
    addons: [createEmptyAddonRow()],
    motor_mode: 'new',
    motor: createEmptyMotorDetails(),
    fleet: createEmptyFleetDetails(),
    nonMotor: { items: [] },
    quotation_flow: 'MOTOR_FLEET',
    quotation_type: 'MOTOR',
    is_fleet: true,
    channel_type: 'DIRECT',
    status: 'DRAFT',
    currency: 'TZS',
    sum_insured: '',
    basic_premium: '',
    total_discount: '',
    total_tax: '',
    total_charges: '',
    total_commission: '',
    total_premium: '',
    net_premium: '',
    valid_from: '2026-07-13',
    valid_until: '2027-07-12',
    rating_version: '',
    rejection_reason: '',
    sale_point_id: '',
    exchange_rate: '1',
    cover_note_type: '1',
    prev_cover_note_reference: '',
    endorsement_type: '',
    endorsement_reason: '',
    endorsement_premium_earned: '',
    officer_name: 'Underwriter One',
    officer_title: 'Underwriter',
    payment_mode_tira: '1',
    ...overrides,
  };

  return values;
}

describe('Motor Fleet payload mapping', () => {
  it('produces the nested fleet payload contract', () => {
    const values = buildFleetForm();
    values.fleet.header.fleet_id = 'FLEET-001';
    values.fleet.header.fleet_type = '1';
    values.fleet.header.fleet_size = '1';
    values.fleet.header.comprehensive_insured = '1';
    values.fleet.header.sale_point_code = 'SP-01';
    values.fleet.header.product_code = 'PROD-01';
    values.fleet.header.cover_note_type = '1';
    values.fleet.header.cover_note_start_date = '2026-07-13T00:00:00';
    values.fleet.header.cover_note_end_date = '2027-07-12T23:59:59';
    values.fleet.header.payment_mode = '1';
    values.fleet.header.currency_code = 'TZS';
    values.fleet.header.exchange_rate = '1';
    values.fleet.header.commision_paid = '0';
    values.fleet.header.commision_rate = '0';
    values.fleet.header.policy_holders[0].policy_holder_name = 'Fleet Holder Ltd';
    values.fleet.header.policy_holders[0].policy_holder_type = '2';
    values.fleet.header.policy_holders[0].policy_holder_id_number = 'ID-1';
    values.fleet.header.policy_holders[0].policy_holder_id_type = '1';
    values.fleet.header.policy_holders[0].country_code = 'TZA';
    values.fleet.header.policy_holders[0].region = 'Dar es Salaam';
    values.fleet.header.policy_holders[0].district = 'Ilala';
    values.fleet.header.policy_holders[0].policy_holder_phone_number = '+255700000000';
    values.fleet.items[0].fleet_entry = '1';
    values.fleet.items[0].cover_note_number = 'CN-001';
    values.fleet.items[0].cover_note_desc = 'Comprehensive motor cover for fleet vehicle T123ABC';
    values.fleet.items[0].operative_clause = 'Motor Comprehensive Cover';
    values.fleet.items[0].registration_no = 'T123ABC';
    values.fleet.items[0].chassis_no = 'CHS-001';
    values.fleet.items[0].make = 'Toyota';
    values.fleet.items[0].model = 'Hiace';
    values.fleet.items[0].owner_name = 'Fleet Holder Ltd';
    values.fleet.items[0].owner_address = 'Dar es Salaam';
    values.fleet.items[0].sum_insured = '1000000';
    values.fleet.items[0].premium = '50000';
    values.fleet.items[0].risks_covered[0].risk_code = 'RC-01';
    values.fleet.items[0].risks_covered[0].sum_insured = '1000000';
    values.fleet.items[0].risks_covered[0].premium_rate = '0.05';
    values.fleet.items[0].risks_covered[0].premium_before_discount = '50000';
    values.fleet.items[0].risks_covered[0].premium_after_discount = '50000';
    values.fleet.items[0].risks_covered[0].premium_excluding_tax_equivalent = '50000';
    values.fleet.items[0].risks_covered[0].premium_including_tax = '59000';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_reference = 'T123ABC';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_desc = 'Toyota Hiace registration number T123ABC';
    values.fleet.items[0].motor_dtl.registration_number = 'T123ABC';
    values.fleet.items[0].motor_dtl.chassis_number = 'CHS-001';
    values.fleet.items[0].motor_dtl.make = 'Toyota';
    values.fleet.items[0].motor_dtl.model = 'Hiace';

    const payload = buildQuotationPayload(values, 'customer-1');

    expect('cover_note_payload' in payload).toBe(false);
    if ('cover_note_dtl' in payload) {
      expect(payload.internal_quotation.quotation_flow).toBe('MOTOR_FLEET');
      expect(payload.cover_note_hdr.cover_note_type).toBe(1);
      expect(payload.cover_note_dtl.fleet_hdr.fleet_size).toBe(1);
      expect(payload.cover_note_dtl.fleet_dtls).toHaveLength(1);
      expect(payload.cover_note_dtl.fleet_dtls[0].motor_dtl.registration_number).toBe('T123ABC');
      expect(payload.cover_note_dtl.fleet_dtls[0].subject_matters_covered[0].subject_matter_reference).toBe('T123ABC');
    }
  });
});

describe('Motor Fleet validation', () => {
  it('rejects duplicate registration numbers within the fleet', () => {
    const values = buildFleetForm();
    values.fleet.header.fleet_id = 'FLEET-001';
    values.fleet.header.fleet_type = '1';
    values.fleet.header.fleet_size = '2';
    values.fleet.header.comprehensive_insured = '2';
    values.fleet.header.sale_point_code = 'SP-01';
    values.fleet.header.product_code = 'PROD-01';
    values.fleet.header.cover_note_type = '1';
    values.fleet.header.cover_note_start_date = '2026-07-13T00:00:00';
    values.fleet.header.cover_note_end_date = '2027-07-12T23:59:59';
    values.fleet.header.payment_mode = '1';
    values.fleet.header.currency_code = 'TZS';
    values.fleet.header.exchange_rate = '1';
    values.fleet.header.policy_holders[0].policy_holder_name = 'Fleet Holder Ltd';
    values.fleet.header.policy_holders[0].policy_holder_type = '2';
    values.fleet.header.policy_holders[0].policy_holder_id_number = 'ID-1';
    values.fleet.header.policy_holders[0].country_code = 'TZA';
    values.fleet.header.policy_holders[0].region = 'Dar es Salaam';
    values.fleet.header.policy_holders[0].district = 'Ilala';
    values.fleet.items = [
      { ...createEmptyFleetDetails().items[0] },
      { ...createEmptyFleetDetails().items[0] },
    ];
    values.fleet.items[0].registration_no = 'T123ABC';
    values.fleet.items[0].chassis_no = 'CHS-001';
    values.fleet.items[0].make = 'Toyota';
    values.fleet.items[0].model = 'Hiace';
    values.fleet.items[0].sum_insured = '1000000';
    values.fleet.items[0].premium = '50000';
    values.fleet.items[0].risks_covered[0].risk_code = 'RC-01';
    values.fleet.items[0].risks_covered[0].sum_insured = '1000000';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_reference = 'T123ABC';
    values.fleet.items[0].subject_matters_covered[0].subject_matter_desc = 'Toyota Hiace registration number T123ABC';
    values.fleet.items[0].motor_dtl.registration_number = 'T123ABC';
    values.fleet.items[0].motor_dtl.chassis_number = 'CHS-001';
    values.fleet.items[0].motor_dtl.make = 'Toyota';
    values.fleet.items[0].motor_dtl.model = 'Hiace';
    values.fleet.items[1].registration_no = 'T123ABC';
    values.fleet.items[1].chassis_no = 'CHS-002';
    values.fleet.items[1].make = 'Toyota';
    values.fleet.items[1].model = 'Coaster';
    values.fleet.items[1].sum_insured = '900000';
    values.fleet.items[1].premium = '45000';
    values.fleet.items[1].risks_covered[0].risk_code = 'RC-02';
    values.fleet.items[1].risks_covered[0].sum_insured = '900000';
    values.fleet.items[1].subject_matters_covered[0].subject_matter_reference = 'T123ABD';
    values.fleet.items[1].subject_matters_covered[0].subject_matter_desc = 'Toyota Coaster registration number T123ABD';
    values.fleet.items[1].motor_dtl.registration_number = 'T123ABC';
    values.fleet.items[1].motor_dtl.chassis_number = 'CHS-002';
    values.fleet.items[1].motor_dtl.make = 'Toyota';
    values.fleet.items[1].motor_dtl.model = 'Coaster';

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
