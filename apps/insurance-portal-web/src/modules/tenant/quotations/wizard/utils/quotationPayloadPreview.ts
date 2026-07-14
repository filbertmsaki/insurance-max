import type { CustomerRecord } from '@/modules/tenant/customers/types';
import { getCustomerFullName } from '@/modules/tenant/customers/types';
import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import type {
  QuotationFormSchemaValues,
} from '../../schemas';

type QuotationPayloadPreviewContext = {
  salePointCode?: string | null;
  productCode?: string | null;
  productName?: string | null;
  existingCustomer?: CustomerRecord | null;
  existingVehicle?: MotorVehicleRecord | null;
};

function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDateTime(value: string | null | undefined, endOfDay: boolean) {
  if (!value) return '';
  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function toTaxFlag(value: boolean | null | undefined): 'Y' | 'N' {
  return value ? 'Y' : 'N';
}

function buildPolicyHolder(
  values: QuotationFormSchemaValues,
  existingCustomer?: CustomerRecord | null,
) {
  if (values.policyholder_mode === 'existing' && existingCustomer) {
    return {
      policy_holder_name:
        getCustomerFullName(existingCustomer) ||
        existingCustomer.company_name ||
        '',
      policy_holder_birth_date: existingCustomer.date_of_birth || null,
      policy_holder_type:
        existingCustomer.policy_holder_type ??
        (existingCustomer.customer_type === 'CORPORATE' ? 2 : 1),
      policy_holder_id_number: existingCustomer.id_number || '',
      policy_holder_id_type: existingCustomer.id_type ?? null,
      gender: existingCustomer.gender || null,
      country_code: existingCustomer.country_code || '',
      region: existingCustomer.region || '',
      district: existingCustomer.district || '',
      street: existingCustomer.street || null,
      policy_holder_phone_number: existingCustomer.phone || '',
      policy_holder_fax: existingCustomer.fax || null,
      postal_address: existingCustomer.postal_address || null,
      email_address: existingCustomer.email || null,
    };
  }

  const policyholder = values.policyholder;
  const isCorporate = policyholder.customer_type === 'CORPORATE';
  const name = isCorporate
    ? policyholder.company_name || policyholder.full_name || ''
    : policyholder.full_name ||
      [policyholder.first_name, policyholder.middle_name, policyholder.last_name]
        .filter(Boolean)
        .join(' ');

  return {
    policy_holder_name: name,
    policy_holder_birth_date: policyholder.date_of_birth || null,
    policy_holder_type: isCorporate ? 2 : 1,
    policy_holder_id_number: policyholder.id_number || '',
    policy_holder_id_type: toNullableNumber(policyholder.id_type),
    gender: policyholder.gender || null,
    country_code: policyholder.country_code || '',
    region: policyholder.region || '',
    district: policyholder.district || '',
    street: policyholder.street || null,
    policy_holder_phone_number: policyholder.phone || '',
    policy_holder_fax: policyholder.fax || null,
    postal_address: policyholder.postal_address || null,
    email_address: policyholder.email || null,
  };
}

function buildRisksCovered(values: QuotationFormSchemaValues) {
  return values.risks.map((risk) => ({
    risk_code: risk.risk_code || '',
    sum_insured: toNumber(risk.sum_insured),
    sum_insured_equivalent: toNumber(risk.sum_insured_equivalent),
    premium_rate: toNumber(risk.premium_rate),
    premium_before_discount: toNumber(risk.premium_before_discount),
    premium_after_discount: toNumber(risk.premium_after_discount),
    premium_excluding_tax_equivalent: toNumber(
      risk.premium_excluding_tax_equivalent,
    ),
    premium_including_tax: toNumber(risk.premium_including_tax),
    discounts_offered: risk.discounts_offered
      .filter((discount) => discount.discount_type)
      .map((discount) => ({
        discount_type: toNumber(discount.discount_type) || 1,
        discount_rate: toNumber(discount.discount_rate),
        discount_amount: toNumber(discount.discount_amount),
      })),
    taxes_charged: risk.taxes_charged
      .filter((tax) => tax.tax_code)
      .map((tax) => ({
        tax_code: tax.tax_code || '',
        is_tax_exempted: toTaxFlag(tax.is_tax_exempted),
        tax_exemption_type: tax.is_tax_exempted
          ? toNullableText(tax.tax_exemption_type)
          : null,
        tax_exemption_reference: tax.is_tax_exempted
          ? toNullableText(tax.tax_exemption_reference)
          : null,
        tax_rate: toNumber(tax.tax_rate),
        tax_amount: toNumber(tax.tax_amount),
      })),
  }));
}

function buildAddons(values: QuotationFormSchemaValues) {
  return values.addons
    .filter((addon) => addon.enabled)
    .map((addon) => ({
      addon_reference: addon.addon_reference || '',
      addon_desc: addon.addon_desc || '',
      addon_amount: toNumber(addon.addon_amount),
      addon_premium_rate: toNumber(addon.addon_premium_rate),
      premium_excluding_tax: toNumber(addon.premium_excluding_tax),
      premium_excluding_tax_equivalent: toNumber(addon.premium_excluding_tax),
      premium_including_tax:
        toNumber(addon.premium_excluding_tax) +
        addon.taxes.reduce((sum, tax) => sum + toNumber(tax.tax_rate), 0),
      taxes_charged: addon.taxes
        .filter((tax) => tax.tax_code)
        .map((tax) => ({
          tax_code: tax.tax_code || '',
          is_tax_exempted: toTaxFlag(tax.is_tax_exempted),
          tax_exemption_type: tax.is_tax_exempted
            ? toNullableText(tax.tax_exemption_type)
            : null,
          tax_exemption_reference: tax.is_tax_exempted
            ? toNullableText(tax.tax_exemption_reference)
            : null,
          tax_rate: toNumber(tax.tax_rate),
          tax_amount:
            toNumber(addon.premium_excluding_tax) * toNumber(tax.tax_rate),
        })),
    }));
}

function buildSubjectMatters(
  values: QuotationFormSchemaValues,
  context: QuotationPayloadPreviewContext = {},
) {
  if (values.quotation_flow === 'NON_MOTOR') {
    const productCode = context.productCode || values.product_id || 'PRODUCT';
    const productName = context.productName || 'Non-motor cover';
    return values.risks.map((_, index) => ({
      subject_matter_reference: `${productCode}-${Date.now()}-${index}`,
      subject_matter_desc: productName,
    }));
  }

  const directItems = values.nonMotor.items
    .filter((item) => item.subject_matter_reference || item.subject_matter_desc)
    .map((item) => ({
      subject_matter_reference: item.subject_matter_reference || '',
      subject_matter_desc: item.subject_matter_desc || '',
    }));

  if (directItems.length > 0) return directItems;

  return [
    {
      subject_matter_reference:
        values.motor.registration_no ||
        values.motor.vehicle_id ||
        values.product_id ||
        'MOTOR',
      subject_matter_desc:
        values.motor.body_type ||
        values.motor.make ||
        values.motor.model ||
        'Motor vehicle',
    },
  ];
}

function buildMotorDtl(values: QuotationFormSchemaValues) {
  const motor = values.motor;
  return {
    motor_category: toNullableNumber(motor.motor_category_code),
    motor_type: toNullableNumber(motor.motor_type_code),
    registration_number: motor.registration_no || '',
    chassis_number: motor.chassis_no || '',
    make: motor.make || '',
    model: motor.model || '',
    model_number: toNullableText(motor.model_no),
    body_type: motor.body_type || '',
    color: motor.color || '',
    engine_number: motor.engine_no || '',
    engine_capacity: toNullableText(motor.cubic_capacity),
    fuel_used: toNullableText(motor.fuel_type),
    number_of_axles: toNullableNumber(motor.number_of_axles),
    axle_distance: toNullableNumber(motor.axle_distance),
    sitting_capacity: toNullableNumber(motor.seating_capacity),
    year_of_manufacture: toNullableNumber(motor.manufacture_year),
    tare_weight: toNullableNumber(motor.tare_weight),
    gross_weight: toNullableNumber(motor.gross_weight),
    motor_usage: toNullableNumber(motor.motor_usage_code),
    owner_name: motor.owner_name || '',
    owner_category: toNullableNumber(motor.owner_category),
    owner_address: motor.owner_address || '',
  };
}

function buildFleetMotorDtl(item: QuotationFormSchemaValues['fleet']['items'][number]) {
  return {
    motor_category: toNullableNumber(item.motor_category_code),
    motor_type: toNullableNumber(item.motor_type_code),
    registration_number: item.registration_no || '',
    chassis_number: item.chassis_no || '',
    make: item.make || '',
    model: item.model || '',
    model_number: toNullableText(item.model_no),
    body_type: item.body_type || '',
    color: item.color || '',
    engine_number: item.engine_no || '',
    engine_capacity: toNullableText(item.engine_capacity),
    fuel_used: toNullableText(item.fuel_used),
    number_of_axles: toNullableNumber(item.number_of_axles),
    axle_distance: toNullableNumber(item.axle_distance),
    sitting_capacity: toNullableNumber(item.seating_capacity),
    year_of_manufacture: toNullableNumber(item.manufacture_year),
    tare_weight: toNullableNumber(item.tare_weight),
    gross_weight: toNullableNumber(item.gross_weight),
    motor_usage: toNullableNumber(item.motor_usage_code),
    owner_name: item.owner_name || '',
    owner_category: toNullableNumber(item.owner_category),
    owner_address: item.owner_address || '',
  };
}

export function buildQuotationPayloadPreview(
  values: QuotationFormSchemaValues,
  context: QuotationPayloadPreviewContext = {},
) {
  const coverNoteType = toNumber(values.cover_note_type) || 1;
  const productCode = context.productCode || values.product_id || '';
  const commonInternal = {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id: values.intermediary_company_id || null,
    branch_id: values.branch_id || null,
    department_id: values.department_id || null,
    category_id: values.category_id,
    product_id: values.product_id,
    sub_class_id: values.sub_class_id || null,
    quotation_type: values.quotation_type,
    quotation_flow: values.quotation_flow,
    channel_type: values.channel_type,
    is_fleet: values.is_fleet,
  };

  const coverNoteDtlBase = {
    cover_note_number:
      values.cover_note_type === '1'
        ? `CN-${Date.now()}`
        : `CN-${Date.now()}-${coverNoteType}`,
    prev_cover_note_reference_number:
      values.prev_cover_note_reference || null,
    sale_point_code: context.salePointCode || null,
    cover_note_start_date: toDateTime(values.valid_from, false),
    cover_note_end_date: toDateTime(values.valid_until, true),
    cover_note_desc:
      values.quotation_flow === 'NON_MOTOR'
        ? 'Non-motor insurance cover note'
        : 'Motor insurance cover note',
    operative_clause:
      values.quotation_flow === 'NON_MOTOR'
        ? 'Non-motor operative clause'
        : 'Motor Comprehensive Cover',
    payment_mode: toNumber(values.payment_mode_tira) || 1,
    currency_code: values.currency?.trim().toUpperCase() || 'TZS',
    exchange_rate: toNumber(values.exchange_rate) || 1,
    total_premium_excluding_tax:
      toNumber(values.basic_premium) ||
      values.risks.reduce((sum, risk) => sum + toNumber(risk.premium_after_discount), 0),
    total_premium_including_tax:
      toNumber(values.total_premium) ||
      values.risks.reduce((sum, risk) => sum + toNumber(risk.premium_including_tax), 0),
    commision_paid: toNumber(values.total_commission),
    commision_rate: 0,
    officer_name: values.officer_name || null,
    officer_title: values.officer_title || null,
    product_code: productCode,
    endorsement_type:
      values.cover_note_type === '3'
        ? toNumber(values.endorsement_type) || null
        : null,
    endorsement_reason:
      values.cover_note_type === '3' ? values.endorsement_reason || null : null,
    endorsement_premium_earned:
      values.cover_note_type === '3'
        ? toNumber(values.endorsement_premium_earned) || null
        : null,
  };

  if (values.quotation_flow === 'MOTOR_FLEET') {
    const fleetItems = values.fleet.items.map((item, index) => ({
      fleet_entry: index + 1,
      cover_note_number: `${values.fleet.header.fleet_id || 'FLEET'}-${String(index + 1).padStart(2, '0')}`,
      prev_cover_note_reference_number: null,
      cover_note_desc:
        item.cover_note_desc ||
        `Fleet vehicle ${item.registration_no || index + 1}`,
      operative_clause: item.operative_clause || 'Motor Comprehensive Cover',
      endorsement_type: null,
      endorsement_reason: null,
      endorsement_premium_earned: null,
      risks_covered: buildRisksCovered(values),
      subject_matters_covered: [
        {
          subject_matter_reference: item.registration_no || `FLEET-${index + 1}`,
          subject_matter_desc:
            item.cover_note_desc ||
            `${item.make || 'Vehicle'} ${item.model || ''}`.trim() ||
            'Fleet vehicle',
        },
      ],
      cover_note_addons: buildAddons(values),
      motor_dtl: buildFleetMotorDtl(item),
    }));

    return {
      internal_quotation: commonInternal,
      cover_note_hdr: {
        cover_note_type: coverNoteType,
      },
      cover_note_dtl: {
        fleet_hdr: {
          fleet_id: values.fleet.header.fleet_id || `FLEET-${Date.now()}`,
          fleet_type: toNumber(values.fleet.header.fleet_type) || 1,
          fleet_size: values.fleet.items.length,
          comprehensive_insured:
            toNumber(values.fleet.header.comprehensive_insured) ||
            values.fleet.items.length,
          sale_point_code: context.salePointCode || null,
          cover_note_start_date: toDateTime(values.valid_from, false),
          cover_note_end_date: toDateTime(values.valid_until, true),
          payment_mode: toNumber(values.payment_mode_tira) || 1,
          currency_code: values.currency?.trim().toUpperCase() || 'TZS',
          exchange_rate: toNumber(values.exchange_rate) || 1,
          total_premium_excluding_tax:
            toNumber(values.basic_premium) ||
            values.risks.reduce((sum, risk) => sum + toNumber(risk.premium_after_discount), 0),
          total_premium_including_tax:
            toNumber(values.total_premium) ||
            values.risks.reduce((sum, risk) => sum + toNumber(risk.premium_including_tax), 0),
          commision_paid: toNumber(values.total_commission),
          commision_rate: 0,
          officer_name: values.officer_name || null,
          officer_title: values.officer_title || null,
          product_code: productCode,
          policy_holders: [buildPolicyHolder(values, context.existingCustomer)],
        },
        fleet_dtls: fleetItems,
      },
    };
  }

  return {
    internal_quotation: commonInternal,
    cover_note_hdr: {
      cover_note_type: coverNoteType,
    },
    cover_note_dtl: {
      ...coverNoteDtlBase,
      risks_covered: buildRisksCovered(values),
      subject_matters_covered: buildSubjectMatters(values, context),
      cover_note_addons: buildAddons(values),
      policy_holders: [buildPolicyHolder(values, context.existingCustomer)],
      ...(values.quotation_flow === 'MOTOR_SINGLE'
        ? { motor_dtl: buildMotorDtl(values) }
        : {}),
    },
  };
}
