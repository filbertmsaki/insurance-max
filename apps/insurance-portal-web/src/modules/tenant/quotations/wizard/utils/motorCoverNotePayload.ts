import type { CustomerRecord } from '@/modules/tenant/customers/types';
import { getCustomerFullName } from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';

function toNumberOrNull(value: string | number | null | undefined) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toDateTime(date: string | null | undefined, endOfDay: boolean) {
  if (!date) return '';
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function toExemptedFlag(value: boolean | null | undefined): 'Y' | 'N' {
  return value ? 'Y' : 'N';
}

interface MotorCoverNotePayloadContext {
  /** TIRAMIS sale point code for the selected branch's sale point. */
  salePointCode?: string | null;
  /** TIRAMIS product code for the selected product (falls back to its internal code). */
  productCode?: string | null;
  /** Free-text cover note description; defaults to a generic motor cover note description. */
  coverNoteDesc?: string | null;
  /** Free-text operative clause; defaults to a generic comprehensive-cover clause. */
  operativeClause?: string | null;
  /** The full customer record when policyholder_mode is 'existing' (unavailable for 'new'). */
  existingCustomer?: CustomerRecord | null;
}

function buildPolicyHolder(
  values: QuotationFormSchemaValues,
  existingCustomer?: CustomerRecord | null,
) {
  if (values.policyholder_mode === 'existing' && existingCustomer) {
    return {
      PolicyHolderName: getCustomerFullName(existingCustomer) || existingCustomer.company_name || '',
      PolicyHolderBirthDate: existingCustomer.date_of_birth || null,
      PolicyHolderType: existingCustomer.policy_holder_type ?? (existingCustomer.customer_type === 'CORPORATE' ? 2 : 1),
      PolicyHolderIdNumber: existingCustomer.id_number || '',
      PolicyHolderIdType: existingCustomer.id_type ?? null,
      Gender: existingCustomer.gender || null,
      CountryCode: existingCustomer.country_code || '',
      Region: existingCustomer.region || '',
      District: existingCustomer.district || '',
      Street: existingCustomer.street || null,
      PolicyHolderPhoneNumber: existingCustomer.phone || '',
      PolicyHolderFax: existingCustomer.fax || null,
      PostalAddress: existingCustomer.postal_address || null,
      EmailAddress: existingCustomer.email || null,
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
    PolicyHolderName: name,
    PolicyHolderBirthDate: policyholder.date_of_birth || null,
    PolicyHolderType: isCorporate ? 2 : 1,
    PolicyHolderIdNumber: policyholder.id_number || '',
    PolicyHolderIdType: policyholder.id_type || null,
    Gender: policyholder.gender || null,
    CountryCode: policyholder.country_code || '',
    Region: policyholder.region || '',
    District: policyholder.district || '',
    Street: policyholder.street || null,
    PolicyHolderPhoneNumber: policyholder.phone || '',
    PolicyHolderFax: policyholder.fax || null,
    PostalAddress: policyholder.postal_address || null,
    EmailAddress: policyholder.email || null,
  };
}

/**
 * Builds a preview (not submission-ready) of the TIRAMIS MotorCoverNoteRefReq
 * payload from the wizard's current form state, for display in Summary
 * Review. The real submission payload is assembled server-side once the
 * Quotation → TIRA integration exists (see apps/tiramis's
 * tiramis-motor-payload.service.ts, which this mirrors field-for-field).
 */
export function buildMotorCoverNoteRefReqPreview(
  values: QuotationFormSchemaValues,
  context: MotorCoverNotePayloadContext = {},
) {
  const risksCovered = values.risks.map((risk) => ({
    RiskCode: risk.risk_code || '',
    SumInsured: toNumberOrNull(risk.sum_insured) ?? 0,
    SumInsuredEquivalent: toNumberOrNull(risk.sum_insured_equivalent) ?? 0,
    PremiumRate: toNumberOrNull(risk.premium_rate) ?? 0,
    PremiumBeforeDiscount: toNumberOrNull(risk.premium_before_discount) ?? 0,
    PremiumAfterDiscount: toNumberOrNull(risk.premium_after_discount) ?? 0,
    PremiumExcludingTaxEquivalent:
      toNumberOrNull(risk.premium_excluding_tax_equivalent) ?? 0,
    PremiumIncludingTax: toNumberOrNull(risk.premium_including_tax) ?? 0,
    DiscountsOffered: risk.discounts_offered
      .filter((discount) => discount.discount_type)
      .map((discount) => ({
        DiscountType: toNumberOrNull(discount.discount_type) ?? 1,
        DiscountRate: toNumberOrNull(discount.discount_rate) ?? 0,
        DiscountAmount: toNumberOrNull(discount.discount_amount) ?? 0,
      })),
    TaxesCharged: risk.taxes_charged
      .filter((tax) => tax.tax_code)
      .map((tax) => ({
        TaxCode: tax.tax_code || '',
        IsTaxExempted: toExemptedFlag(tax.is_tax_exempted),
        TaxExemptionType: tax.is_tax_exempted
          ? toNumberOrNull(tax.tax_exemption_type)
          : null,
        TaxExemptionReference: tax.is_tax_exempted
          ? tax.tax_exemption_reference || null
          : null,
        TaxRate: toNumberOrNull(tax.tax_rate) ?? 0,
        TaxAmount: toNumberOrNull(tax.tax_amount) ?? 0,
      })),
  }));

  const subjectMattersCovered = values.nonMotor.items.map((item) => ({
    SubjectMatterReference: item.subject_matter_reference || '',
    SubjectMatterDesc: item.subject_matter_desc || '',
  }));

  const coverNoteAddons = values.addons
    .filter((addon) => addon.enabled)
    .map((addon) => ({
      AddonReference: addon.addon_reference || '',
      AddonDesc: addon.addon_desc || '',
      AddonAmount: toNumberOrNull(addon.addon_amount) ?? 0,
      AddonPremiumRate: toNumberOrNull(addon.addon_premium_rate) ?? 0,
      PremiumExcludingTax: toNumberOrNull(addon.premium_excluding_tax) ?? 0,
      PremiumExcludingTaxEquivalent:
        toNumberOrNull(addon.premium_excluding_tax) ?? 0,
      PremiumIncludingTax:
        (toNumberOrNull(addon.premium_excluding_tax) ?? 0) +
        addon.taxes.reduce((sum, tax) => sum + (toNumberOrNull(tax.tax_rate) ?? 0), 0),
      TaxesCharged: addon.taxes
        .filter((tax) => tax.tax_code)
        .map((tax) => ({
          TaxCode: tax.tax_code || '',
          IsTaxExempted: toExemptedFlag(tax.is_tax_exempted),
          TaxExemptionType: tax.is_tax_exempted
            ? toNumberOrNull(tax.tax_exemption_type)
            : null,
          TaxExemptionReference: tax.is_tax_exempted
            ? tax.tax_exemption_reference || null
            : null,
          TaxRate: toNumberOrNull(tax.tax_rate) ?? 0,
          TaxAmount: 0,
        })),
    }));

  const motor = values.motor;
  const motorDtl = {
    MotorCategory: toNumberOrNull(motor.motor_category_code) ?? 1,
    MotorType: toNumberOrNull(motor.motor_type_code) ?? 1,
    RegistrationNumber: motor.registration_no || '',
    ChassisNumber: motor.chassis_no || '',
    Make: motor.make || '',
    Model: motor.model || '',
    ModelNumber: motor.model_no || null,
    BodyType: motor.body_type || '',
    Color: motor.color || '',
    EngineNumber: motor.engine_no || '',
    EngineCapacity: motor.cubic_capacity || '',
    FuelUsed: motor.fuel_type || '',
    NumberOfAxles: toNumberOrNull(motor.number_of_axles),
    AxleDistance: toNumberOrNull(motor.axle_distance),
    SittingCapacity: toNumberOrNull(motor.seating_capacity),
    YearOfManufacture: toNumberOrNull(motor.manufacture_year) ?? new Date().getFullYear(),
    TareWeight: toNumberOrNull(motor.tare_weight),
    GrossWeight: toNumberOrNull(motor.gross_weight),
    MotorUsage: toNumberOrNull(motor.motor_usage_code) ?? 1,
    OwnerName: motor.owner_name || '',
    OwnerCategory: toNumberOrNull(motor.owner_category) ?? 1,
    OwnerAddress: motor.owner_address || '',
  };

  return {
    MotorCoverNoteRefReq: {
      CoverNoteHdr: {
        CoverNoteType: toNumberOrNull(values.cover_note_type) ?? 1,
      },
      CoverNoteDtl: {
        SalePointCode: context.salePointCode || '',
        CoverNoteStartDate: toDateTime(values.valid_from, false),
        CoverNoteEndDate: toDateTime(values.valid_until, true),
        CoverNoteDesc: context.coverNoteDesc || 'Motor cover note',
        OperativeClause: context.operativeClause || 'Motor Comprehensive cover',
        EndorsementType: toNumberOrNull(values.endorsement_type),
        EndorsementReason: values.endorsement_reason || '',
        EndorsementPremiumEarned: toNumberOrNull(values.endorsement_premium_earned),
        PaymentMode: toNumberOrNull(values.payment_mode_tira) ?? 1,
        CurrencyCode: values.currency?.trim().toUpperCase() || 'TZS',
        ExchangeRate: toNumberOrNull(values.exchange_rate) ?? 1,
        TotalPremiumExcludingTax: toNumberOrNull(values.basic_premium) ?? 0,
        TotalPremiumIncludingTax: toNumberOrNull(values.total_premium) ?? 0,
        CommisionPaid: toNumberOrNull(values.total_commission) ?? 0,
        CommisionRate: 0,
        OfficerName: values.officer_name || '',
        OfficerTitle: values.officer_title || '',
        ProductCode: context.productCode || '',
        EndorsementType: null,
        EndorsementReason: null,
        EndorsementPremiumEarned: null,
        RisksCovered: risksCovered,
        SubjectMattersCovered: subjectMattersCovered,
        CoverNoteAddons: coverNoteAddons,
        PolicyHolders: [buildPolicyHolder(values, context.existingCustomer)],
        MotorDtl: motorDtl,
      },
    },
  };
}
