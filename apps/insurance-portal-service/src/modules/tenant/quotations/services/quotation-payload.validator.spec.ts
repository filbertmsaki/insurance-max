import { BadRequestException } from '@nestjs/common';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { CreateQuotationDto } from '../dto/quotation-payload.dto';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationType } from '../enums/quotation-type.enum';
import { QuotationPayloadValidator } from './quotation-payload.validator';

describe('QuotationPayloadValidator', () => {
  let validator: QuotationPayloadValidator;

  beforeEach(() => {
    validator = new QuotationPayloadValidator();
  });

  it('accepts a valid non-motor quotation', () => {
    const payload = createValidNonMotorPayload();

    expect(() => validator.assertValid(payload)).not.toThrow();
  });

  it('accepts an empty cover_note_addons list and empty discounts', () => {
    const payload = createValidNonMotorPayload();

    payload.cover_note_dtl.cover_note_addons = [];
    payload.cover_note_dtl.risks_covered![0].discounts_offered = [];

    expect(() => validator.assertValid(payload)).not.toThrow();
  });

  it('defaults cover note type to new when it is omitted', () => {
    const payload = createValidNonMotorPayload();

    delete (payload.cover_note_hdr as Partial<typeof payload.cover_note_hdr>)
      .cover_note_type;

    expect(() => validator.assertValid(payload)).not.toThrow();
    expect(payload.cover_note_hdr.cover_note_type).toBe(1);
  });

  it('rejects a NON_MOTOR payload containing motor details', () => {
    const payload = createValidNonMotorPayload();

    payload.cover_note_dtl.motor_dtl = {
      motor_category: 1,
      motor_type: 1,
      registration_number: 'T123ABC',
      chassis_number: 'CHASSIS-001',
      make: 'Toyota',
      model: 'IST',
      model_number: 'NCP60',
      body_type: 'Station Wagon',
      color: 'Silver',
      engine_number: 'ENGINE-001',
      engine_capacity: '1490',
      fuel_used: 'Petrol',
      number_of_axles: 2,
      axle_distance: 2.4,
      sitting_capacity: 5,
      year_of_manufacture: 2010,
      tare_weight: 1000,
      gross_weight: 1250,
      motor_usage: 2,
      owner_name: 'Test Owner',
      owner_category: 1,
      owner_address: 'Dar es Salaam',
    };

    expect(() => validator.assertValid(payload)).toThrow(BadRequestException);
  });

  it('rejects invalid quotation totals', () => {
    const payload = createValidNonMotorPayload();

    payload.cover_note_dtl.total_premium_including_tax = 999999;

    expect(() => validator.assertValid(payload)).toThrow(BadRequestException);
  });

  it('rejects inconsistent risk discount arithmetic', () => {
    const payload = createValidNonMotorPayload();

    payload.cover_note_dtl.risks_covered![0].premium_after_discount = 50000;

    expect(() => validator.assertValid(payload)).toThrow(BadRequestException);
  });

  it('rejects tax exemption without reference information', () => {
    const payload = createValidNonMotorPayload();

    const tax = payload.cover_note_dtl.risks_covered![0].taxes_charged[0];

    tax.is_tax_exempted = 'Y';
    tax.tax_amount = 0;
    tax.tax_exemption_type = null;
    tax.tax_exemption_reference = null;

    expect(() => validator.assertValid(payload)).toThrow(BadRequestException);
  });
});

function createValidNonMotorPayload(): CreateQuotationDto {
  return {
    internal_quotation: {
      insurer_company_id: '0c3e98f1-d5c2-4caf-a23c-b7bc889979d6',
      intermediary_company_id: null,
      branch_id: 'f0cab54e-2d86-4d35-84c1-ac04ea563daf',
      department_id: null,
      category_id: '11111111-1111-4111-8111-111111111111',
      product_id: '22222222-2222-4222-8222-222222222222',
      sub_class_id: null,
      quotation_type: QuotationType.NON_MOTOR,
      quotation_flow: QuotationFlow.NON_MOTOR,
      channel_type: ProductChannelType.DIRECT,
      is_fleet: false,
    },
    cover_note_hdr: {
      cover_note_type: 1,
    },
    cover_note_dtl: {
      cover_note_number: 'AICL-NL-2026-000001',
      prev_cover_note_reference_number: null,
      sale_point_code: 'SP502',
      cover_note_start_date: '2026-07-13T00:00:00',
      cover_note_end_date: '2027-07-12T23:59:59',
      cover_note_desc: 'Fire and allied perils insurance',
      operative_clause: 'Fire and Allied Perils',
      payment_mode: 1,
      currency_code: 'TZS',
      exchange_rate: 1,
      total_premium_excluding_tax: 100000,
      total_premium_including_tax: 118000,
      commision_paid: 0,
      commision_rate: 0,
      officer_name: 'Silas Parks',
      officer_title: 'Underwriter',
      product_code: 'SP005001000000',
      endorsement_type: null,
      endorsement_reason: null,
      endorsement_premium_earned: null,
      risks_covered: [
        {
          risk_code: 'SP005001000001',
          pricing_quote_id: 'PQ-2026-00000001',
          sum_insured: 10000000,
          sum_insured_equivalent: 10000000,
          premium_rate: 0.01,
          premium_before_discount: 100000,
          premium_after_discount: 100000,
          premium_excluding_tax_equivalent: 100000,
          premium_including_tax: 118000,
          discounts_offered: [],
          taxes_charged: [
            {
              tax_code: 'VAT-MAINLAND',
              is_tax_exempted: 'N',
              tax_exemption_type: null,
              tax_exemption_reference: null,
              tax_rate: 0.18,
              tax_amount: 18000,
            },
          ],
        },
      ],
      subject_matters_covered: [
        {
          subject_matter_reference: 'PROPERTY-001',
          subject_matter_desc: 'Residential building and installed fixtures',
        },
      ],
      cover_note_addons: [],
      policy_holders: [
        {
          policy_holder_name: 'Filbert Elisaia Msaki',
          policy_holder_birth_date: '1996-06-30',
          policy_holder_type: 1,
          policy_holder_id_number: '1234567890',
          policy_holder_id_type: 1,
          gender: 'M',
          country_code: 'TZA',
          region: 'DAR-ES-SALAAM',
          district: 'UBUNGO',
          street: 'Kibangu',
          policy_holder_phone_number: '255762650393',
          policy_holder_fax: null,
          postal_address: 'Kibangu Mchichani',
          email_address: 'filymsaki@gmail.com',
        },
      ],
    },
  };
}
