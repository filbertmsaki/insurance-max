import { z } from 'zod';
import { customerFormObjectSchema, customerFormSchema, getCustomerDefaultValues } from '../customers/schemas';
import type {
  QuotationFormValues,
  QuotationPayload,
  QuotationRiskFormRow,
  QuotationWizardAddonRow,
} from './types';

const optionalText = z.string().trim().optional().or(z.literal(''));

const quotationRiskRowSchema = z.object({
  risk_id: z.string().min(1, 'Risk is required'),
  subject_matter_id: optionalText,
  motor_vehicle_id: optionalText,
  sum_insured: z.string().trim().min(1, 'Sum insured is required'),
  // Keyed by factor_id — dynamic shape driven by the risk's required rating factors.
  factor_values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  rate: optionalText,
  basic_premium: optionalText,
  discount_amount: optionalText,
  tax_amount: optionalText,
  charges_amount: optionalText,
  commission_amount: optionalText,
  total_premium: optionalText,
  net_premium: optionalText,
  // Last RiskPremiumResult returned by the rating engine for this row, kept for
  // display and forwarded into QuotationRisk.rating_result_metadata on save.
  rating_result_metadata: z.unknown().nullable(),
});

export function createEmptyRiskRow(): QuotationRiskFormRow {
  return {
    risk_id: '',
    subject_matter_id: '',
    motor_vehicle_id: '',
    sum_insured: '',
    factor_values: {},
    rate: '',
    basic_premium: '',
    discount_amount: '',
    tax_amount: '',
    charges_amount: '',
    commission_amount: '',
    total_premium: '',
    net_premium: '',
    rating_result_metadata: null,
  };
}

const quotationAddonTaxRowSchema = z.object({
  tax_code: optionalText,
  is_tax_exempted: z.boolean(),
  tax_exemption_type: optionalText,
  tax_exemption_reference: optionalText,
  tax_rate: optionalText,
});

const quotationAddonRowSchema = z.object({
  enabled: z.boolean(),
  addon_reference: optionalText,
  addon_desc: optionalText,
  addon_amount: optionalText,
  addon_premium_rate: optionalText,
  premium_excluding_tax: optionalText,
  taxes: z.array(quotationAddonTaxRowSchema),
});

export function createEmptyAddonTaxRow(): QuotationWizardAddonRow['taxes'][number] {
  return {
    tax_code: '',
    is_tax_exempted: false,
    tax_exemption_type: '',
    tax_exemption_reference: '',
    tax_rate: '',
  };
}

export function createEmptyAddonRow(): QuotationWizardAddonRow {
  return {
    enabled: true,
    addon_reference: '',
    addon_desc: '',
    addon_amount: '',
    addon_premium_rate: '',
    premium_excluding_tax: '',
    taxes: [],
  };
}

// Per-field max lengths mirror CreateMotorVehicleDto exactly (registration/chassis/
// engine/color/fuel_type -> 50, make/model/body_type/usage_type/vehicle_category -> 100,
// currency -> 10) — the standalone motor module's own zod schema uses a uniform 255
// cap that doesn't match the backend; this one is deliberately stricter/correct.
const quotationMotorSchema = z.object({
  // Set once an existing vehicle is selected, or after a new one is created at save time.
  vehicle_id: optionalText,
  registration_no: z.string().trim().max(50).optional().or(z.literal('')),
  chassis_no: z.string().trim().max(50).optional().or(z.literal('')),
  engine_no: z.string().trim().max(50).optional().or(z.literal('')),
  make: z.string().trim().max(100).optional().or(z.literal('')),
  model: z.string().trim().max(100).optional().or(z.literal('')),
  body_type: z.string().trim().max(100).optional().or(z.literal('')),
  color: z.string().trim().max(50).optional().or(z.literal('')),
  manufacture_year: optionalText,
  usage_type: z.string().trim().max(100).optional().or(z.literal('')),
  vehicle_category: z.string().trim().max(100).optional().or(z.literal('')),
  seating_capacity: optionalText,
  tonnage: optionalText,
  cubic_capacity: optionalText,
  fuel_type: z.string().trim().max(50).optional().or(z.literal('')),
  vehicle_value: optionalText,
});

export function createEmptyMotorDetails(): QuotationFormValues['motor'] {
  return {
    vehicle_id: '',
    registration_no: '',
    chassis_no: '',
    engine_no: '',
    make: '',
    model: '',
    body_type: '',
    color: '',
    manufacture_year: '',
    usage_type: '',
    vehicle_category: '',
    seating_capacity: '',
    tonnage: '',
    cubic_capacity: '',
    fuel_type: '',
    vehicle_value: '',
  };
}

const quotationFleetHeaderSchema = z.object({
  fleet_id: optionalText,
  fleet_no: z.string().trim().max(50).optional().or(z.literal('')),
  fleet_name: z.string().trim().max(150).optional().or(z.literal('')),
  fleet_type: z.enum(['1', '2']),
  comprehensive_insured: optionalText,
});

const quotationFleetItemRowSchema = z.object({
  vehicle_id: optionalText,
  fleet_item_id: optionalText,
  registration_no: z.string().trim().max(50).optional().or(z.literal('')),
  chassis_no: z.string().trim().max(50).optional().or(z.literal('')),
  make: z.string().trim().max(100).optional().or(z.literal('')),
  model: z.string().trim().max(100).optional().or(z.literal('')),
  manufacture_year: optionalText,
  seating_capacity: optionalText,
  vehicle_value: optionalText,
  sum_insured: optionalText,
  premium: optionalText,
});

export function createEmptyFleetItemRow(): QuotationFormValues['fleet']['items'][number] {
  return {
    vehicle_id: '',
    fleet_item_id: '',
    registration_no: '',
    chassis_no: '',
    make: '',
    model: '',
    manufacture_year: '',
    seating_capacity: '',
    vehicle_value: '',
    sum_insured: '',
    premium: '',
  };
}

export function createEmptyFleetDetails(): QuotationFormValues['fleet'] {
  return {
    header: { fleet_id: '', fleet_no: '', fleet_name: '', fleet_type: '1', comprehensive_insured: '' },
    items: [createEmptyFleetItemRow()],
  };
}

// Mirrors CreateSubjectMatterDto (subject_code max 100) plus the linking
// NonMotorQuotationDetail fields (cover_description/risk_location/insured_value/
// limit_of_liability). subject_matter_id/detail_id are populated once the
// backend records exist — see resolveNonMotor in QuotationWizardPage.
const quotationNonMotorItemRowSchema = z.object({
  subject_matter_id: optionalText,
  detail_id: optionalText,
  subject_type: z.string().trim().max(100).optional().or(z.literal('')),
  subject_code: z.string().trim().max(100).optional().or(z.literal('')),
  description: optionalText,
  location: optionalText,
  value: optionalText,
  cover_description: optionalText,
  risk_location: optionalText,
  insured_value: optionalText,
  limit_of_liability: optionalText,
});

export function createEmptyNonMotorItemRow(): QuotationFormValues['nonMotor']['items'][number] {
  return {
    subject_matter_id: '',
    detail_id: '',
    subject_type: '',
    subject_code: '',
    description: '',
    location: '',
    value: '',
    cover_description: '',
    risk_location: '',
    insured_value: '',
    limit_of_liability: '',
  };
}

export function createEmptyNonMotorDetails(): QuotationFormValues['nonMotor'] {
  return { items: [] };
}

const quotationFormObjectSchema = z.object({
  insurer_company_id: z.string().min(1, 'Company is required'),
  intermediary_company_id: optionalText,
  branch_id: optionalText,
  department_id: optionalText,
  // Wizard-local (not a Quotation column): which TIRAMIS sale point this cover
  // note will be submitted under. Required whenever the branch has more than
  // one active sale point — enforced imperatively in CoverNoteSetupStep, since
  // that depends on async reference data the schema can't see.
  sale_point_id: optionalText,
  // 'existing' -> customer_id must reference a saved Customer record.
  // 'new' -> the nested `policyholder` object is validated as a full
  // CreateCustomerDto-equivalent and a Customer record is created at save time.
  policyholder_mode: z.enum(['existing', 'new']),
  customer_id: optionalText,
  policyholder: customerFormObjectSchema,
  category_id: z.string().min(1, 'Category is required'),
  product_id: z.string().min(1, 'Product is required'),
  sub_class_id: optionalText,
  risks: z.array(quotationRiskRowSchema).min(1, 'At least one risk is required'),
  addons: z.array(quotationAddonRowSchema),
  // Only meaningful when quotation_type === 'MOTOR' && !is_fleet (Step 5A).
  motor_mode: z.enum(['existing', 'new']),
  motor: quotationMotorSchema,
  // Only meaningful when quotation_type === 'MOTOR' && is_fleet (Step 5B).
  fleet: z.object({
    header: quotationFleetHeaderSchema,
    items: z.array(quotationFleetItemRowSchema),
  }),
  // Only meaningful when quotation_type === 'NON_MOTOR' (Step 6).
  nonMotor: z.object({
    items: z.array(quotationNonMotorItemRowSchema),
  }),
  quotation_type: z.enum(['MOTOR', 'NON_MOTOR']),
  is_fleet: z.boolean(),
  channel_type: z.enum(['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API']),
  status: z.enum(['DRAFT', 'RATED', 'REFERRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED', 'CANCELLED']),
  currency: z.string().trim().min(1).max(10),
  // Wizard-local: exchange rate against the quotation currency, required only
  // when currency isn't TZS. Carried through to the TIRA payload's ExchangeRate
  // field at submission time; not a Quotation column (see wizard gap #5).
  exchange_rate: z.string().trim().optional().or(z.literal('')),
  sum_insured: z.string().trim().optional().or(z.literal('')),
  basic_premium: z.string().trim().optional().or(z.literal('')),
  total_discount: z.string().trim().optional().or(z.literal('')),
  total_tax: z.string().trim().optional().or(z.literal('')),
  total_charges: z.string().trim().optional().or(z.literal('')),
  total_commission: z.string().trim().optional().or(z.literal('')),
  total_premium: z.string().trim().optional().or(z.literal('')),
  net_premium: z.string().trim().optional().or(z.literal('')),
  valid_from: z.string().min(1, 'Valid from is required'),
  valid_until: z.string().min(1, 'Valid until is required'),
  rating_version: optionalText,
  rejection_reason: optionalText,
  // TIRA-only header fields (CoverNoteHdr/CoverNoteDtl) — collected here but not
  // sent as part of the Quotation create/update payload, only used when the
  // TIRA submission payload is assembled (Phase 13).
  cover_note_type: z.enum(['1', '2', '3']),
  prev_cover_note_reference: optionalText,
  officer_name: optionalText,
  officer_title: optionalText,
  payment_mode_tira: z.enum(['1', '2', '3']),
});

export const quotationFormSchema = quotationFormObjectSchema.superRefine((values, ctx) => {
  if (values.policyholder_mode === 'existing') {
    if (!values.customer_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_id'],
        message: 'Select an existing customer',
      });
    }
  } else {
    const result = customerFormSchema.safeParse(values.policyholder);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['policyholder', ...issue.path] });
      }
    }
  }

  if (values.valid_from && values.valid_until && values.valid_until <= values.valid_from) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['valid_until'],
      message: 'Cover end date must be after the start date',
    });
  }

  const currency = values.currency?.trim().toUpperCase();
  if (currency && currency !== 'TZS' && !values.exchange_rate?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exchange_rate'],
      message: 'Exchange rate is required for non-TZS currencies',
    });
  }

  values.risks.forEach((row, index) => {
    const sumInsured = Number(row.sum_insured);
    if (!row.sum_insured || !Number.isFinite(sumInsured) || sumInsured <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['risks', index, 'sum_insured'],
        message: 'Sum insured must be a positive number',
      });
    }
  });

  if (values.cover_note_type !== '1' && !values.prev_cover_note_reference?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prev_cover_note_reference'],
      message: 'Previous cover note reference is required for renewals and endorsements',
    });
  }

  values.addons.forEach((addon, index) => {
    // Disabled add-ons are dropped before the TIRA payload is built (Phase 13),
    // so there's nothing to validate for them here.
    if (!addon.enabled) return;

    if (!addon.addon_reference?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['addons', index, 'addon_reference'], message: 'Add-on reference is required' });
    }
    if (!addon.addon_desc?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['addons', index, 'addon_desc'], message: 'Add-on description is required' });
    }
    const amount = Number(addon.addon_amount);
    if (!addon.addon_amount || !Number.isFinite(amount) || amount <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['addons', index, 'addon_amount'], message: 'Add-on amount must be a positive number' });
    }
    const excludingTax = Number(addon.premium_excluding_tax);
    if (!addon.premium_excluding_tax || !Number.isFinite(excludingTax) || excludingTax < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['addons', index, 'premium_excluding_tax'], message: 'Premium excluding tax must be a non-negative number' });
    }

    addon.taxes.forEach((tax, taxIndex) => {
      if (!tax.tax_code?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['addons', index, 'taxes', taxIndex, 'tax_code'], message: 'Tax code is required' });
      }
      if (!tax.is_tax_exempted) {
        const rate = Number(tax.tax_rate);
        if (!tax.tax_rate || !Number.isFinite(rate) || rate < 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['addons', index, 'taxes', taxIndex, 'tax_rate'], message: 'Tax rate is required unless the tax is exempted' });
        }
      }
    });
  });

  if (values.quotation_type === 'MOTOR' && !values.is_fleet) {
    if (values.motor_mode === 'existing') {
      if (!values.motor.vehicle_id?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'vehicle_id'], message: 'Select an existing vehicle' });
      }
    } else {
      const currentYear = new Date().getFullYear();
      if (!values.motor.chassis_no?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'chassis_no'], message: 'Chassis number is required' });
      }
      if (!values.motor.make?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'make'], message: 'Make is required' });
      }
      if (!values.motor.model?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'model'], message: 'Model is required' });
      }
      if (!values.motor.usage_type?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'usage_type'], message: 'Vehicle usage is required' });
      }
      if (!values.motor.vehicle_category?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'vehicle_category'], message: 'Vehicle category is required' });
      }
      const year = Number(values.motor.manufacture_year);
      if (!values.motor.manufacture_year || !Number.isInteger(year) || year < 1900 || year > currentYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['motor', 'manufacture_year'],
          message: `Year of manufacture must be between 1900 and ${currentYear}`,
        });
      }
      const seating = values.motor.seating_capacity;
      if (seating && (!Number.isInteger(Number(seating)) || Number(seating) < 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'seating_capacity'], message: 'Seating capacity must be a whole number' });
      }
      const value = Number(values.motor.vehicle_value);
      if (!values.motor.vehicle_value || !Number.isFinite(value) || value <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motor', 'vehicle_value'], message: 'Vehicle value must be a positive number' });
      }
    }
  }

  if (values.quotation_type === 'MOTOR' && values.is_fleet) {
    if (!values.fleet.header.fleet_no?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'header', 'fleet_no'], message: 'Fleet number is required' });
    }
    if (!values.fleet.items.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items'], message: 'At least one fleet vehicle is required' });
    }

    const seenRegistrations = new Map<string, number>();
    const seenChassis = new Map<string, number>();

    values.fleet.items.forEach((item, index) => {
      if (!item.chassis_no?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items', index, 'chassis_no'], message: 'Chassis number is required' });
      }
      if (!item.make?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items', index, 'make'], message: 'Make is required' });
      }
      if (!item.model?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items', index, 'model'], message: 'Model is required' });
      }
      const value = Number(item.vehicle_value);
      if (!item.vehicle_value || !Number.isFinite(value) || value <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items', index, 'vehicle_value'], message: 'Vehicle value must be a positive number' });
      }
      const sumInsured = Number(item.sum_insured);
      if (!item.sum_insured || !Number.isFinite(sumInsured) || sumInsured <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items', index, 'sum_insured'], message: 'Sum insured must be a positive number' });
      }

      const registration = item.registration_no?.trim().toUpperCase();
      if (registration) {
        const firstIndex = seenRegistrations.get(registration);
        if (firstIndex !== undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items', index, 'registration_no'], message: `Duplicate registration number (also used in row ${firstIndex + 1})` });
        } else {
          seenRegistrations.set(registration, index);
        }
      }
      const chassis = item.chassis_no?.trim().toUpperCase();
      if (chassis) {
        const firstIndex = seenChassis.get(chassis);
        if (firstIndex !== undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fleet', 'items', index, 'chassis_no'], message: `Duplicate chassis number (also used in row ${firstIndex + 1})` });
        } else {
          seenChassis.set(chassis, index);
        }
      }
    });
  }

  if (values.quotation_type === 'NON_MOTOR') {
    const items = values.nonMotor.items;
    // Each subject matter row maps 1:1 by index to a Risk & Premium row (see
    // QuotationWizardNonMotorItemRow) because NonMotorQuotationDetail requires
    // a real quotation_risk_id — there's no way to have more subject matters
    // than risks to attach them to.
    if (items.length > values.risks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nonMotor', 'items'],
        message: `Cannot have more subject matters (${items.length}) than risk rows (${values.risks.length}) — each subject matter links to one risk`,
      });
    }

    items.forEach((item, index) => {
      if (!item.subject_code?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nonMotor', 'items', index, 'subject_code'], message: 'Subject matter reference is required' });
      }
      if (!item.description?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nonMotor', 'items', index, 'description'], message: 'Subject matter description is required' });
      }
      if (item.insured_value) {
        const insured = Number(item.insured_value);
        if (!Number.isFinite(insured) || insured < 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nonMotor', 'items', index, 'insured_value'], message: 'Insured value must be a non-negative number' });
        }
      }
    });
  }
});

export type QuotationFormSchemaValues = z.infer<typeof quotationFormObjectSchema>;

function normalizeText(value: string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeNumber(value: string | number | null | undefined) {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * `customerIdOverride` lets callers pass the freshly-created customer id when
 * `policyholder_mode === 'new'` without waiting on a form.setValue re-render —
 * the wizard resolves that id synchronously right before calling this function.
 */
export function buildQuotationPayload(
  values: QuotationFormSchemaValues,
  customerIdOverride?: string,
): QuotationPayload {
  const customerId = customerIdOverride ?? values.customer_id;
  if (!customerId) {
    throw new Error('A policyholder (existing or newly created) is required before saving a quotation');
  }
  return {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id: normalizeText(values.intermediary_company_id) ?? null,
    branch_id: normalizeText(values.branch_id) ?? null,
    department_id: normalizeText(values.department_id) ?? null,
    customer_id: customerId,
    category_id: values.category_id,
    product_id: values.product_id,
    sub_class_id: normalizeText(values.sub_class_id) ?? null,
    quotation_type: values.quotation_type,
    channel_type: values.channel_type,
    status: values.status,
    currency: values.currency.trim().toUpperCase(),
    sum_insured: normalizeNumber(values.sum_insured) ?? 0,
    basic_premium: normalizeNumber(values.basic_premium) ?? 0,
    total_discount: normalizeNumber(values.total_discount) ?? 0,
    total_tax: normalizeNumber(values.total_tax) ?? 0,
    total_charges: normalizeNumber(values.total_charges) ?? 0,
    total_commission: normalizeNumber(values.total_commission) ?? 0,
    total_premium: normalizeNumber(values.total_premium) ?? 0,
    net_premium: normalizeNumber(values.net_premium) ?? 0,
    valid_from: values.valid_from,
    valid_until: values.valid_until,
    rating_version: normalizeText(values.rating_version) ?? null,
    // is_fleet has no dedicated Quotation column yet, so it rides along in
    // rating_metadata until the backend adds a proper column (see wizard gap #5).
    rating_metadata: values.is_fleet ? { is_fleet: true } : null,
    rejection_reason: normalizeText(values.rejection_reason) ?? null,
    risks: values.risks.map((row) => ({
      risk_id: row.risk_id,
      subject_matter_id: normalizeText(row.subject_matter_id) ?? null,
      motor_vehicle_id: normalizeText(row.motor_vehicle_id) ?? null,
      sum_insured: normalizeNumber(row.sum_insured) ?? 0,
      basic_premium: normalizeNumber(row.basic_premium) ?? 0,
      discount_amount: normalizeNumber(row.discount_amount) ?? 0,
      tax_amount: normalizeNumber(row.tax_amount) ?? 0,
      charges_amount: normalizeNumber(row.charges_amount) ?? 0,
      commission_amount: normalizeNumber(row.commission_amount) ?? 0,
      total_premium: normalizeNumber(row.total_premium) ?? 0,
      net_premium: normalizeNumber(row.net_premium) ?? 0,
      rating_result_metadata: (row.rating_result_metadata as Record<string, unknown> | null) ?? null,
    })),
    // NOTE (multi-risk gap): the backend links a factor_value to a risk via a
    // client-supplied `quotation_risk_id`, but risk rows don't have a real id
    // until after INSERT — there's no positional auto-correlation server-side
    // (see quotations.service.ts create/replaceRiskChildren). With more than
    // one risk row this means factor values cannot be reliably attributed to
    // the risk that produced them; they're flattened untagged below. This
    // needs a backend fix (e.g. a client-supplied correlation key, or
    // returning created risk ids for a follow-up PATCH) before multi-risk
    // factor attribution can be trusted.
    factor_values: values.risks.flatMap((row) =>
      Object.entries(row.factor_values).map(([factorId, value]) => ({
        quotation_risk_id: undefined,
        factor_id: factorId,
        value_text: typeof value === 'string' ? value : null,
        value_number: typeof value === 'number' ? value : null,
        value_date: null,
        value_boolean: typeof value === 'boolean' ? value : null,
        value_json: null,
      })),
    ),
  };
}

export function quotationRecordToFormValues(record: any): Partial<QuotationFormValues> {
  return {
    insurer_company_id: record.insurer_company_id ?? '',
    intermediary_company_id: record.intermediary_company_id ?? '',
    branch_id: record.branch_id ?? '',
    department_id: record.department_id ?? '',
    policyholder_mode: 'existing',
    customer_id: record.customer_id ?? '',
    policyholder: getCustomerDefaultValues(record.customer ?? null),
    category_id: record.category_id ?? '',
    product_id: record.product_id ?? '',
    sub_class_id: record.sub_class_id ?? '',
    quotation_type: (record.quotation_type as QuotationFormValues['quotation_type']) ?? 'NON_MOTOR',
    // is_fleet is not persisted on the Quotation entity yet — always reloads as false.
    is_fleet: Boolean(record.rating_metadata?.is_fleet),
    channel_type: (record.channel_type as QuotationFormValues['channel_type']) ?? 'DIRECT',
    status: (record.status as QuotationFormValues['status']) ?? 'DRAFT',
    currency: record.currency ?? 'TZS',
    sum_insured: record.sum_insured ?? '',
    basic_premium: record.basic_premium ?? '',
    total_discount: record.total_discount ?? '',
    total_tax: record.total_tax ?? '',
    total_charges: record.total_charges ?? '',
    total_commission: record.total_commission ?? '',
    total_premium: record.total_premium ?? '',
    net_premium: record.net_premium ?? '',
    valid_from: record.valid_from ?? '',
    valid_until: record.valid_until ?? '',
    rating_version: record.rating_version ?? '',
    rejection_reason: record.rejection_reason ?? '',
    cover_note_type: '1',
    prev_cover_note_reference: '',
    officer_name: '',
    officer_title: '',
    payment_mode_tira: '1',
    sale_point_id: '',
    exchange_rate: '',
    // Add-ons have no backend entity — never persisted, so a reloaded quotation
    // always starts with an empty add-ons list.
    addons: [],
    motor_mode: 'existing',
    // Only the vehicle id round-trips reliably here (from the first risk row) —
    // full vehicle field hydration would need a separate motor vehicle fetch,
    // which this synchronous mapper doesn't have access to.
    motor: { ...createEmptyMotorDetails(), vehicle_id: String(record.risks?.[0]?.motor_vehicle_id ?? '') },
    // Fleet header/items are not embedded on the Quotation record — they live
    // on separate MotorFleet/MotorFleetItem rows the wizard would need to fetch
    // independently to hydrate here, which this synchronous mapper can't do.
    fleet: createEmptyFleetDetails(),
    // Same limitation as fleet — NonMotorQuotationDetail rows live separately
    // and would need their own fetch to hydrate here.
    nonMotor: createEmptyNonMotorDetails(),
    risks: (record.risks?.length ? record.risks : []).map((risk: Record<string, unknown>) => {
      const factorValues: Record<string, string | number | boolean> = {};
      for (const fv of (record.factor_values ?? []) as Record<string, unknown>[]) {
        if (fv.quotation_risk_id !== risk.id) continue;
        const factorId = String(fv.factor_id);
        if (fv.value_text !== null && fv.value_text !== undefined) factorValues[factorId] = String(fv.value_text);
        else if (fv.value_number !== null && fv.value_number !== undefined) factorValues[factorId] = Number(fv.value_number);
        else if (fv.value_boolean !== null && fv.value_boolean !== undefined) factorValues[factorId] = Boolean(fv.value_boolean);
        else if (fv.value_date !== null && fv.value_date !== undefined) factorValues[factorId] = String(fv.value_date);
      }
      return {
        risk_id: String(risk.risk_id ?? ''),
        subject_matter_id: risk.subject_matter_id ? String(risk.subject_matter_id) : '',
        motor_vehicle_id: risk.motor_vehicle_id ? String(risk.motor_vehicle_id) : '',
        sum_insured: risk.sum_insured != null ? String(risk.sum_insured) : '',
        factor_values: factorValues,
        rate: risk.rate != null ? String(risk.rate) : '',
        basic_premium: risk.basic_premium != null ? String(risk.basic_premium) : '',
        discount_amount: risk.discount_amount != null ? String(risk.discount_amount) : '',
        tax_amount: risk.tax_amount != null ? String(risk.tax_amount) : '',
        charges_amount: risk.charges_amount != null ? String(risk.charges_amount) : '',
        commission_amount: risk.commission_amount != null ? String(risk.commission_amount) : '',
        total_premium: risk.total_premium != null ? String(risk.total_premium) : '',
        net_premium: risk.net_premium != null ? String(risk.net_premium) : '',
        rating_result_metadata: risk.rating_result_metadata ?? null,
      };
    }),
  };
}
