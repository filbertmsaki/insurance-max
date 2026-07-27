import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { CreateQuotationDto } from '../dto/quotation-payload.dto';
import { QuotationFlow } from '../enums/quotation-flow.enum';
import { QuotationType } from '../enums/quotation-type.enum';

export function createNonMotorQuotationPayload(): CreateQuotationDto {
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
      total_premium_excluding_tax: 105000,
      total_premium_including_tax: 123900,
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
          discounts_offered: [
            {
              discount_type: 2,
              discount_rate: 0.05,
              discount_amount: 5000,
              request_reason_code: 'LOYALTY',
              request_comment: 'Introductory loyalty discount',
              approval_required: false,
              approval_status: 'NOT_REQUIRED',
            },
          ],
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
      cover_note_addons: [
        {
          addon_reference: 'ADDON-001',
          addon_desc: 'Loss of rent',
          addon_amount: 500000,
          addon_premium_rate: 0.01,
          premium_excluding_tax: 5000,
          premium_excluding_tax_equivalent: 5000,
          premium_including_tax: 5900,
          taxes_charged: [
            {
              tax_code: 'VAT-MAINLAND',
              is_tax_exempted: 'N',
              tax_exemption_type: null,
              tax_exemption_reference: null,
              tax_rate: 0.18,
              tax_amount: 900,
            },
          ],
        },
      ],
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

export function createMotorSingleQuotationPayload(): CreateQuotationDto {
  const payload = createNonMotorQuotationPayload();

  payload.internal_quotation.quotation_type = QuotationType.MOTOR;
  payload.internal_quotation.quotation_flow = QuotationFlow.MOTOR_SINGLE;
  payload.cover_note_dtl.cover_note_number = 'AICL-MTR-2026-000001';
  payload.cover_note_dtl.cover_note_desc = 'Private motor comprehensive cover';
  payload.cover_note_dtl.operative_clause = 'Motor Comprehensive';
  payload.cover_note_dtl.subject_matters_covered = [
    {
      subject_matter_reference: 'VEHICLE-001',
      subject_matter_desc: 'Toyota Hiace commuter bus',
    },
  ];
  payload.cover_note_dtl.motor_dtl = createMotorDetail(
    'T123ABC',
    'MOCKCHASSIS123456',
    'MOCKENGINE123',
  );

  return payload;
}

export function createMotorFleetQuotationPayload(): CreateQuotationDto {
  return {
    internal_quotation: {
      insurer_company_id: '0c3e98f1-d5c2-4caf-a23c-b7bc889979d6',
      intermediary_company_id: null,
      branch_id: 'f0cab54e-2d86-4d35-84c1-ac04ea563daf',
      department_id: null,
      category_id: '11111111-1111-4111-8111-111111111111',
      product_id: '22222222-2222-4222-8222-222222222222',
      sub_class_id: null,
      quotation_type: QuotationType.MOTOR,
      quotation_flow: QuotationFlow.MOTOR_FLEET,
      channel_type: ProductChannelType.DIRECT,
      is_fleet: true,
    },
    cover_note_hdr: {
      cover_note_type: 3,
    },
    cover_note_dtl: {
      fleet_hdr: {
        fleet_id: 'FLEET-2026-001',
        fleet_type: 1,
        fleet_size: 2,
        comprehensive_insured: 200000000,
        sale_point_code: 'SP502',
        cover_note_start_date: '2026-07-13T00:00:00',
        cover_note_end_date: '2027-07-12T23:59:59',
        payment_mode: 1,
        currency_code: 'TZS',
        exchange_rate: 1,
        total_premium_excluding_tax: 240000,
        total_premium_including_tax: 283200,
        commision_paid: 0,
        commision_rate: 0,
        officer_name: 'Silas Parks',
        officer_title: 'Underwriter',
        product_code: 'SP005001000000',
        policy_holders: [
          {
            policy_holder_name: 'ABC Logistics Company Limited',
            policy_holder_birth_date: '2010-01-01',
            policy_holder_type: 2,
            policy_holder_id_number: 'TIN-998877',
            policy_holder_id_type: 6,
            gender: null,
            country_code: 'TZA',
            region: 'DAR-ES-SALAAM',
            district: 'ILALA',
            street: 'Makoka',
            policy_holder_phone_number: '255712345678',
            policy_holder_fax: null,
            postal_address: 'P.O. BOX 123, Dar es Salaam',
            email_address: 'fleet@example.com',
          },
        ],
      },
      fleet_dtls: [
        {
          fleet_entry: 1,
          cover_note_number: 'AICL-FLT-2026-000001',
          prev_cover_note_reference_number: 'AICL-FLT-2025-000090',
          cover_note_desc: 'Fleet vehicle 1',
          operative_clause: 'Motor fleet insurance',
          endorsement_type: 1,
          endorsement_reason: 'Vehicle replacement',
          endorsement_premium_earned: 12000,
          risks_covered: [
            {
              risk_code: 'SP005001000001',
              pricing_quote_id: 'PQ-2026-00000002',
              sum_insured: 100000000,
              sum_insured_equivalent: 100000000,
              premium_rate: 0.01,
              premium_before_discount: 120000,
              premium_after_discount: 120000,
              premium_excluding_tax_equivalent: 120000,
              premium_including_tax: 141600,
              discounts_offered: [],
              taxes_charged: [
                {
                  tax_code: 'VAT-MAINLAND',
                  is_tax_exempted: 'N',
                  tax_exemption_type: null,
                  tax_exemption_reference: null,
                  tax_rate: 0.18,
                  tax_amount: 21600,
                },
              ],
            },
          ],
          subject_matters_covered: [
            {
              subject_matter_reference: 'VEHICLE-001',
              subject_matter_desc: 'Toyota Hiace bus',
            },
          ],
          cover_note_addons: [],
          motor_dtl: createMotorDetail(
            'T123ABC',
            'MOCKCHASSIS123456',
            'MOCKENGINE123',
          ),
        },
        {
          fleet_entry: 2,
          cover_note_number: 'AICL-FLT-2026-000002',
          prev_cover_note_reference_number: 'AICL-FLT-2025-000091',
          cover_note_desc: 'Fleet vehicle 2',
          operative_clause: 'Motor fleet insurance',
          endorsement_type: 1,
          endorsement_reason: 'Vehicle replacement',
          endorsement_premium_earned: 15000,
          risks_covered: [
            {
              risk_code: 'SP005001000001',
              pricing_quote_id: 'PQ-2026-00000003',
              sum_insured: 90000000,
              sum_insured_equivalent: 90000000,
              premium_rate: 0.01,
              premium_before_discount: 120000,
              premium_after_discount: 120000,
              premium_excluding_tax_equivalent: 120000,
              premium_including_tax: 136200,
              discounts_offered: [],
              taxes_charged: [
                {
                  tax_code: 'VAT-MAINLAND',
                  is_tax_exempted: 'N',
                  tax_exemption_type: null,
                  tax_exemption_reference: null,
                  tax_rate: 0.18,
                  tax_amount: 16200,
                },
              ],
            },
          ],
          subject_matters_covered: [
            {
              subject_matter_reference: 'VEHICLE-002',
              subject_matter_desc: 'Toyota Hiace minibus',
            },
          ],
          cover_note_addons: [],
          motor_dtl: createMotorDetail(
            'T124ABC',
            'MOCKCHASSIS654321',
            'MOCKENGINE456',
          ),
        },
      ],
    },
  };
}

function createMotorDetail(
  registrationNumber: string,
  chassisNumber: string,
  engineNumber: string,
) {
  return {
    motor_category: 1,
    motor_type: 1,
    registration_number: registrationNumber,
    chassis_number: chassisNumber,
    make: 'Toyota',
    model: 'Hiace',
    model_number: 'GDH201',
    body_type: 'Minibus',
    color: 'White',
    engine_number: engineNumber,
    engine_capacity: '2755',
    fuel_used: 'Diesel',
    number_of_axles: 2,
    axle_distance: 3,
    sitting_capacity: 14,
    year_of_manufacture: 2022,
    tare_weight: 2100,
    gross_weight: 3300,
    motor_usage: 2,
    owner_name: 'ABC Logistics Company Limited',
    owner_category: 2,
    owner_address: 'Makoka, Ubungo, Dar es Salaam',
  };
}
