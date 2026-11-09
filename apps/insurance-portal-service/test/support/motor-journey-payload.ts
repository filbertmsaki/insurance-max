import { randomUUID } from 'crypto';
const suffix = randomUUID().slice(0, 8);
const SUFFIX = suffix.toUpperCase();
function eat(date: Date) {
  return new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 19);
}

function risk(sumInsured: number) {
  return {
    risk_code: 'SP014001000001',
    sum_insured: sumInsured,
    sum_insured_equivalent: sumInsured,
    premium_rate: 0,
    premium_before_discount: 0,
    premium_after_discount: 0,
    premium_excluding_tax_equivalent: 0,
    premium_including_tax: 0,
    discounts_offered: [],
    taxes_charged: [],
  };
}

function motor(entry: number) {
  return {
    motor_category: 1,
    motor_type: 1,
    registration_number: `T${SUFFIX.slice(0, 3)}F${entry}`,
    chassis_number: `CHF${SUFFIX}${entry}`,
    make: 'Toyota',
    model: entry === 1 ? 'Hiace' : 'Coaster',
    model_number: entry === 1 ? 'KDH200' : 'HZB50',
    body_type: 'Minibus',
    color: entry === 1 ? 'White' : 'Silver',
    engine_number: `ENF${SUFFIX}${entry}`,
    engine_capacity: '2800',
    fuel_used: 'Diesel',
    number_of_axles: 2,
    axle_distance: 2.6,
    sitting_capacity: entry === 1 ? 14 : 26,
    year_of_manufacture: 2021,
    tare_weight: 2000,
    gross_weight: 3200,
    motor_usage: 2,
    owner_name: 'Fleet Smoke Ltd',
    owner_category: 2,
    owner_address: 'Dar es Salaam',
  };
}

function fleetBody(fx: any): any {
  const start = new Date(Date.now() + 10 * 60_000);
  const end = new Date(start.getTime() + 364 * 86_400_000);
  const holder = {
    policy_holder_name: 'Fleet Smoke Ltd',
    policy_holder_birth_date: '2005-01-01',
    policy_holder_type: 2,
    policy_holder_id_number: `TIN${SUFFIX}`,
    policy_holder_id_type: 6,
    gender: null,
    country_code: 'TZA',
    region: 'Dar es Salaam',
    district: 'Ilala',
    street: 'Samora Avenue',
    policy_holder_phone_number: `25576${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
    policy_holder_fax: null,
    postal_address: 'P.O. Box 99',
    email_address: `fleet.${suffix}@example.com`,
  };

  return {
    internal_quotation: {
      insurer_company_id: fx.companyId,
      intermediary_company_id: null,
      department_id: null,
      category_id: fx.categoryId,
      product_id: fx.productId,
      sub_class_id: null,
      quotation_type: 'MOTOR',
      quotation_flow: 'MOTOR_FLEET',
      channel_type: 'DIRECT',
      is_fleet: true,
    },
    cover_note_hdr: { cover_note_type: 1 },
    cover_note_dtl: {
      fleet_hdr: {
        fleet_id: `FLT-${SUFFIX}`,
        fleet_type: 1,
        fleet_size: 2,
        comprehensive_insured: 2,
        sale_point_code: fx.salePointCode,
        cover_note_start_date: eat(start),
        cover_note_end_date: eat(end),
        payment_mode: 1,
        currency_code: 'TZS',
        exchange_rate: 1,
        total_premium_excluding_tax: 0,
        total_premium_including_tax: 0,
        commision_paid: 0,
        commision_rate: 0,
        officer_name: 'Fleet Issuer',
        officer_title: 'Underwriter',
        product_code: fx.tiramisProductCode,
        policy_holders: [holder],
      },
      fleet_dtls: [1, 2].map((entry) => ({
        fleet_entry: entry,
        prev_cover_note_reference_number: null,
        cover_note_desc: `Fleet vehicle ${entry} comprehensive cover`,
        operative_clause: 'Motor Fleet Comprehensive',
        endorsement_type: null,
        endorsement_reason: null,
        endorsement_premium_earned: null,
        risks_covered: [risk(entry === 1 ? 30_000_000 : 45_000_000)],
        subject_matters_covered: [
          {
            subject_matter_reference: `FLT-${SUFFIX}-${entry}`,
            subject_matter_desc:
              entry === 1 ? 'Toyota Hiace' : 'Toyota Coaster',
          },
        ],
        cover_note_addons: [],
        motor_dtl: motor(entry),
      })),
    },
  };
}

export function motorJourneyPayload(fx: any, fleet: boolean): any {
  const body = fleetBody(fx);
  body.internal_quotation.branch_id = fx.branchId;
  if (fleet) return body;
  body.internal_quotation.quotation_flow = 'MOTOR_SINGLE';
  body.internal_quotation.is_fleet = false;
  const { fleet_hdr: header, fleet_dtls: entries } = body.cover_note_dtl;
  const { fleet_id, fleet_type, fleet_size, comprehensive_insured, ...common } =
    header;
  body.cover_note_dtl = {
    ...common,
    ...entries[0],
    policy_holders: header.policy_holders,
  };
  delete body.cover_note_dtl.fleet_entry;
  return body;
}
