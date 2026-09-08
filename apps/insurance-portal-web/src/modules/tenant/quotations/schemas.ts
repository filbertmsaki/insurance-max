import { z } from 'zod';
import {
  roundExchangeRate,
  roundMoney,
  roundRate,
  sumDecimals,
  toDecimal,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import {
  customerFormSchema,
  customerFormObjectSchema,
  getCustomerDefaultValues,
} from '../customers/schemas';
import {
  getCustomerFullName,
  type CustomerFormValues,
  type CustomerRecord,
} from '../customers/types';
import { readPricingQuoteMetadata } from '@/modules/pricing';
import type {
  QuotationDetailRecord,
  QuotationDiscountPayload,
  QuotationDraftRecordPayload,
  QuotationFormValues,
  QuotationPayload,
  QuotationPolicyHolderPayload,
  QuotationRiskCoveredPayload,
  QuotationRiskFormRow,
  QuotationTaxPayload,
  QuotationWizardAddonRow,
  QuotationWizardFleetItemRow,
  QuotationWizardFleetRiskRow,
  QuotationWizardNonMotorItemRow,
} from './types';
import {
  inclusiveDayCount,
  isBeforeToday,
} from './wizard/utils/coverNoteDateRange';
import { getTaxRateForCode } from './wizard/utils/taxOptions';
import {
  buildFleetRiskPricingSignature,
  buildSingleRiskPricingSignature,
} from './wizard/utils/pricingStaleness';
import {
  normalizeMotorTextInput,
  normalizeMotorTextValue,
} from './utils/motorText';

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => value ?? '');

function createClientRef(prefix = 'risk') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value?: string | number | null, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePositiveNumber(value?: string | number | null, fallback = 1) {
  const parsed = normalizeNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function normalizeMoneyNumber(value?: string | number | null, fallback = 0) {
  return roundMoney(normalizeNumber(value, fallback));
}

function normalizeRateNumber(value?: string | number | null, fallback = 0) {
  return roundRate(normalizeNumber(value, fallback));
}

function normalizeExchangeRateNumber(
  value?: string | number | null,
  fallback = 1,
) {
  return roundExchangeRate(normalizePositiveNumber(value, fallback));
}

function normalizeAdjustmentApprovalStatus(
  value?: string | null,
): QuotationDiscountPayload['approval_status'] {
  const normalized = normalizeText(value)?.toUpperCase();
  if (
    normalized === 'NOT_REQUIRED' ||
    normalized === 'PENDING' ||
    normalized === 'APPROVED' ||
    normalized === 'REJECTED'
  ) {
    return normalized;
  }

  return null;
}

function formatDateTime(date: string, endOfDay: boolean) {
  if (date.includes('T')) return date;
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function toTaxFlag(value: boolean): 'Y' | 'N' {
  return value ? 'Y' : 'N';
}

function toBooleanTaxFlag(value?: 'Y' | 'N' | boolean | null) {
  return value === 'Y' || value === true;
}

function buildPolicyholderFormDefaults(
  policyHolder?: QuotationPolicyHolderPayload,
): CustomerFormValues {
  const defaults = getCustomerDefaultValues();

  if (!policyHolder) {
    return defaults;
  }

  return {
    ...defaults,
    customer_type:
      policyHolder.policy_holder_type === 2 ? 'CORPORATE' : 'INDIVIDUAL',
    full_name: policyHolder.policy_holder_name,
    company_name:
      policyHolder.policy_holder_type === 2
        ? policyHolder.policy_holder_name
        : '',
    gender: policyHolder.gender ?? '',
    date_of_birth: policyHolder.policy_holder_birth_date,
    id_type:
      policyHolder.policy_holder_id_type as CustomerFormValues['id_type'],
    id_number: policyHolder.policy_holder_id_number,
    phone: policyHolder.policy_holder_phone_number,
    fax: policyHolder.policy_holder_fax ?? '',
    email: policyHolder.email_address ?? '',
    country_code: policyHolder.country_code,
    region: policyHolder.region,
    district: policyHolder.district,
    street: policyHolder.street ?? '',
    postal_address: policyHolder.postal_address ?? '',
  };
}

function createEmptyTaxRow() {
  return {
    tax_code: 'VAT-MAINLAND',
    is_tax_exempted: false,
    tax_exemption_type: '',
    tax_exemption_reference: '',
    tax_rate: getTaxRateForCode('VAT-MAINLAND'),
    tax_amount: '',
  };
}

function createEmptyDiscountRow() {
  return {
    discount_type: '',
    discount_rate: '',
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
  };
}

export function createEmptyRiskDiscountRow() {
  return createEmptyDiscountRow();
}

export function createEmptyRiskTaxRow() {
  return createEmptyTaxRow();
}

export const quotationRiskRowSchema = z.object({
  client_ref: z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value : createClientRef())),
  risk_id: optionalText,
  risk_code: optionalText,
  factor_values: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
  sum_insured: optionalText,
  sum_insured_equivalent: optionalText,
  premium_rate: optionalText,
  premium_before_discount: optionalText,
  premium_after_discount: optionalText,
  premium_excluding_tax_equivalent: optionalText,
  premium_including_tax: optionalText,
  minimum_amount: optionalText,
  discounts_offered: z.array(
    z
      .object({
        discount_type: optionalText,
        discount_rate: optionalText,
        discount_amount: optionalText,
        request_reason_code: optionalText,
        request_comment: optionalText,
        effective_from: optionalText,
        effective_to: optionalText,
        requested_by: optionalText,
        requested_at: optionalText,
        max_permitted_rate: optionalText,
        max_permitted_amount: optionalText,
        approval_required: z.boolean().default(false),
        approval_status: optionalText,
        approved_rate: optionalText,
        approved_amount: optionalText,
        approved_by: optionalText,
        approval_date: optionalText,
        rejection_reason: optionalText,
      })
      .superRefine((row, ctx) => {
        // discount_rate is only required once the user has committed to a
        // discount type — a risk with no discount at all stays valid.
        if (row.discount_type?.trim() && !row.discount_rate?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Discount rate is required once a discount type is selected.',
            path: ['discount_rate'],
          });
        }
      }),
  ),
  taxes_charged: z.array(
    z
      .object({
        tax_code: optionalText,
        is_tax_exempted: z.boolean().default(false),
        tax_exemption_type: optionalText,
        tax_exemption_reference: optionalText,
        tax_rate: optionalText,
        tax_amount: optionalText,
      })
      .superRefine((row, ctx) => {
        // tax_rate is backend-calculated and required once a tax code is
        // selected — it stays blank (and invalid) until a calculation
        // resolves, so a quotation can never be submitted with an
        // undetermined tax rate.
        if (row.tax_code?.trim() && !row.tax_rate?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'Tax rate is required once a tax code is selected.',
            path: ['tax_rate'],
          });
        }
      }),
  ),
  rate: optionalText,
  basic_premium: optionalText,
  discount_amount: optionalText,
  tax_amount: optionalText,
  charges_amount: optionalText,
  commission_amount: optionalText,
  total_premium: optionalText,
  net_premium: optionalText,
  rating_result_metadata: z.custom<
    QuotationRiskFormRow['rating_result_metadata']
  >(
    (value) =>
      value === null || value === undefined || typeof value === 'object',
  ),
});

const addonTaxSchema = z
  .object({
    tax_code: optionalText,
    is_tax_exempted: z.boolean().default(false),
    tax_exemption_type: optionalText,
    tax_exemption_reference: optionalText,
    tax_rate: optionalText,
    tax_amount: optionalText,
  })
  .superRefine((row, ctx) => {
    if (row.tax_code?.trim() && !row.tax_rate?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Tax rate is required once a tax code is selected.',
        path: ['tax_rate'],
      });
    }
  });

const addonSchema = z.object({
  enabled: z.boolean(),
  addon_reference: optionalText,
  addon_desc: optionalText,
  addon_amount: optionalText,
  addon_premium_rate: optionalText,
  premium_excluding_tax: optionalText,
  premium_excluding_tax_equivalent: optionalText,
  premium_including_tax: optionalText,
  taxes: z.array(addonTaxSchema),
});

const motorSchema = z.object({
  vehicle_id: optionalText,
  motor_category_code: z.enum(['', '1', '2']),
  motor_type_code: z.enum(['', '1', '2']),
  registration_no: optionalText,
  chassis_no: optionalText,
  engine_no: optionalText,
  make: optionalText,
  model: optionalText,
  model_no: optionalText,
  body_type: optionalText,
  color: optionalText,
  manufacture_year: optionalText,
  usage_type: optionalText,
  motor_usage_code: z.enum(['', '1', '2']),
  vehicle_category: optionalText,
  seating_capacity: optionalText,
  tonnage: optionalText,
  cubic_capacity: optionalText,
  fuel_type: optionalText,
  number_of_axles: optionalText,
  axle_distance: optionalText,
  tare_weight: optionalText,
  gross_weight: optionalText,
  owner_name: optionalText,
  owner_category: z.enum(['', '1', '2']),
  owner_address: optionalText,
  vehicle_value: optionalText,
});

const fleetRiskSchema = z.object({
  client_ref: z
    .string()
    .optional()
    .transform((value) =>
      value?.trim() ? value : createClientRef('fleet-risk'),
    ),
  risk_id: optionalText,
  risk_code: optionalText,
  factor_values: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
  sum_insured: optionalText,
  sum_insured_equivalent: optionalText,
  premium_rate: optionalText,
  premium_before_discount: optionalText,
  premium_after_discount: optionalText,
  premium_excluding_tax_equivalent: optionalText,
  premium_including_tax: optionalText,
  discounts_offered: z.array(
    z.object({
      discount_type: optionalText,
      discount_rate: optionalText,
      discount_amount: optionalText,
      request_reason_code: optionalText,
      request_comment: optionalText,
      effective_from: optionalText,
      effective_to: optionalText,
      requested_by: optionalText,
      requested_at: optionalText,
      max_permitted_rate: optionalText,
      max_permitted_amount: optionalText,
      approval_required: z.boolean().default(false),
      approval_status: optionalText,
      approved_rate: optionalText,
      approved_amount: optionalText,
      approved_by: optionalText,
      approval_date: optionalText,
      rejection_reason: optionalText,
    }),
  ),
  taxes_charged: z.array(addonTaxSchema),
  rating_result_metadata: z.custom<
    QuotationWizardFleetRiskRow['rating_result_metadata']
  >(
    (value) =>
      value === null || value === undefined || typeof value === 'object',
  ),
});

const fleetItemSchema = z.object({
  vehicle_id: optionalText,
  fleet_item_id: optionalText,
  registration_no: optionalText,
  chassis_no: optionalText,
  make: optionalText,
  model: optionalText,
  model_no: optionalText,
  body_type: optionalText,
  color: optionalText,
  engine_no: optionalText,
  engine_capacity: optionalText,
  fuel_used: optionalText,
  number_of_axles: optionalText,
  axle_distance: optionalText,
  manufacture_year: optionalText,
  seating_capacity: optionalText,
  tare_weight: optionalText,
  gross_weight: optionalText,
  motor_category_code: z.enum(['', '1', '2']),
  motor_type_code: z.enum(['', '1', '2']),
  motor_usage_code: z.enum(['', '1', '2']),
  owner_name: optionalText,
  owner_category: z.enum(['', '1', '2']),
  owner_address: optionalText,
  vehicle_value: optionalText,
  sum_insured: optionalText,
  premium: optionalText,
  fleet_entry: optionalText,
  cover_note_number: optionalText,
  prev_cover_note_reference_number: optionalText,
  cover_note_desc: optionalText,
  operative_clause: optionalText,
  endorsement_type: z.enum(['', '1', '2', '3', '4']),
  endorsement_reason: optionalText,
  endorsement_premium_earned: optionalText,
  risks_covered: z.array(fleetRiskSchema),
  subject_matters_covered: z.array(
    z.object({
      subject_matter_reference: optionalText,
      subject_matter_desc: optionalText,
    }),
  ),
  cover_note_addons: z.array(
    z.object({
      addon_reference: optionalText,
      addon_desc: optionalText,
      addon_amount: optionalText,
      addon_premium_rate: optionalText,
      premium_excluding_tax: optionalText,
      premium_excluding_tax_equivalent: optionalText,
      premium_including_tax: optionalText,
      taxes: z.array(addonTaxSchema),
    }),
  ),
  motor_dtl: z.object({
    motor_category: optionalText,
    motor_type: optionalText,
    registration_number: optionalText,
    chassis_number: optionalText,
    make: optionalText,
    model: optionalText,
    model_number: optionalText,
    body_type: optionalText,
    color: optionalText,
    engine_number: optionalText,
    engine_capacity: optionalText,
    fuel_used: optionalText,
    number_of_axles: optionalText,
    axle_distance: optionalText,
    sitting_capacity: optionalText,
    year_of_manufacture: optionalText,
    tare_weight: optionalText,
    gross_weight: optionalText,
    motor_usage: optionalText,
    owner_name: optionalText,
    owner_category: optionalText,
    owner_address: optionalText,
  }),
});

const nonMotorItemSchema = z.object({
  subject_matter_reference: optionalText,
  subject_matter_desc: optionalText,
});

const quotationFormObjectSchema = z.object({
  insurer_company_id: z.string().min(1, 'Company is required'),
  intermediary_company_id: optionalText,
  branch_id: optionalText,
  department_id: optionalText,
  sale_point_id: optionalText,
  policyholder_mode: z.enum(['existing', 'new']),
  customer_id: optionalText,
  policyholder: customerFormObjectSchema,
  category_id: z.string().min(1, 'Category is required'),
  product_id: z.string().min(1, 'Product is required'),
  sub_class_id: optionalText,
  quotation_flow: z.enum(['NON_MOTOR', 'MOTOR_SINGLE', 'MOTOR_FLEET']),
  quotation_type: z.enum(['MOTOR', 'NON_MOTOR']),
  is_fleet: z.boolean(),
  channel_type: z.enum(['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API']),
  status: z.enum([
    'DRAFT',
    'PENDING_REQUIREMENTS',
    'READY_FOR_SUBMISSION',
    'SUBMITTING_TO_TIRA',
    'SUBMITTED_TO_TIRA',
    'TIRA_PROCESSING',
    'COMPLETED',
    'REJECTED',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
  ]),
  currency: z.string().min(1, 'Currency is required'),
  exchange_rate: optionalText,
  sum_insured: optionalText,
  basic_premium: optionalText,
  total_discount: optionalText,
  total_tax: optionalText,
  total_charges: optionalText,
  total_commission: optionalText,
  total_premium: optionalText,
  net_premium: optionalText,
  valid_from: z.string().min(1, 'Cover start date is required'),
  valid_until: z.string().min(1, 'Cover end date is required'),
  rating_version: optionalText,
  rejection_reason: optionalText,
  cover_note_number: optionalText,
  cover_note_desc: optionalText,
  operative_clause: optionalText,
  cover_note_type: z.enum(['1', '2', '3']),
  prev_cover_note_reference: optionalText,
  endorsement_type: z.enum(['', '1', '2', '3', '4']),
  endorsement_reason: optionalText,
  endorsement_premium_earned: optionalText,
  commission_paid: optionalText,
  commission_rate: optionalText,
  officer_name: optionalText,
  officer_title: optionalText,
  payment_mode_tira: z.enum(['1', '2', '3']),
  risks: z
    .array(quotationRiskRowSchema)
    .min(1, 'At least one risk is required'),
  addons: z.array(addonSchema),
  motor_mode: z.enum(['existing', 'new']),
  motor: motorSchema,
  fleet: z.object({
    header: z.object({
      fleet_id: optionalText,
      fleet_no: optionalText,
      fleet_name: optionalText,
      fleet_type: z.enum(['1', '2']),
      fleet_size: optionalText,
      comprehensive_insured: optionalText,
    }),
    items: z.array(fleetItemSchema),
  }),
  nonMotor: z.object({
    items: z.array(nonMotorItemSchema),
  }),
});

function validatePolicyholder(
  values: z.infer<typeof quotationFormObjectSchema>,
  ctx: z.RefinementCtx,
) {
  if (values.policyholder_mode === 'existing') {
    if (!values.customer_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['customer_id'],
        message: 'Select an existing policyholder',
      });
    }
    return;
  }

  const result = customerFormSchema.safeParse(values.policyholder);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      ctx.addIssue({
        code: 'custom',
        path: ['policyholder', ...issue.path],
        message: issue.message,
      });
    });
  }
}

function validateRiskRows(
  risks: Array<{ risk_id?: string; risk_code?: string }>,
  ctx: z.RefinementCtx,
  path: (string | number)[] = ['risks'],
) {
  risks.forEach((risk, index) => {
    if (!normalizeText(risk.risk_id) && !normalizeText(risk.risk_code)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, index, 'risk_id'],
        message: 'Risk is required',
      });
    }
  });
}

function validateStandardCoverNoteFields(
  values: z.infer<typeof quotationFormObjectSchema>,
  ctx: z.RefinementCtx,
) {
  const requiredFields: Array<'cover_note_desc' | 'operative_clause'> = [
    'cover_note_desc',
    'operative_clause',
  ];

  requiredFields.forEach((field) => {
    if (!normalizeText(values[field])) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: 'Required',
      });
    }
  });

  if (!normalizeText(values.officer_name)) {
    ctx.addIssue({
      code: 'custom',
      path: ['officer_name'],
      message: 'Required',
    });
  }

  if (!normalizeText(values.officer_title)) {
    ctx.addIssue({
      code: 'custom',
      path: ['officer_title'],
      message: 'Required',
    });
  }
}

function validateMotorSingle(
  values: z.infer<typeof quotationFormObjectSchema>,
  ctx: z.RefinementCtx,
) {
  const motor = values.motor;
  const requiredFields: Array<keyof typeof motor> = [
    'motor_category_code',
    'motor_type_code',
    'registration_no',
    'chassis_no',
    'make',
    'model',
    'body_type',
    'color',
    'engine_no',
    'cubic_capacity',
    'fuel_type',
    'number_of_axles',
    'axle_distance',
    'seating_capacity',
    'manufacture_year',
    'tare_weight',
    'gross_weight',
    'motor_usage_code',
    'owner_name',
    'owner_category',
    'owner_address',
  ];

  requiredFields.forEach((field) => {
    if (!normalizeText(motor[field])) {
      ctx.addIssue({
        code: 'custom',
        path: ['motor', field],
        message: 'Required',
      });
    }
  });
}

function validateFleet(
  values: z.infer<typeof quotationFormObjectSchema>,
  ctx: z.RefinementCtx,
) {
  if (values.fleet.items.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['fleet', 'items'],
      message: 'Add at least one fleet vehicle',
    });
    return;
  }

  const seenRegistration = new Map<string, number>();
  const seenChassis = new Map<string, number>();
  const seenEngine = new Map<string, number>();

  values.fleet.items.forEach((item, index) => {
    if (!normalizeText(item.cover_note_desc)) {
      ctx.addIssue({
        code: 'custom',
        path: ['fleet', 'items', index, 'cover_note_desc'],
        message: 'Cover note description is required',
      });
    }
    if (!normalizeText(item.operative_clause)) {
      ctx.addIssue({
        code: 'custom',
        path: ['fleet', 'items', index, 'operative_clause'],
        message: 'Operative clause is required',
      });
    }

    const registration =
      normalizeMotorTextValue(item.motor_dtl.registration_number) ??
      normalizeMotorTextValue(item.registration_no);
    const chassis =
      normalizeMotorTextValue(item.motor_dtl.chassis_number) ??
      normalizeMotorTextValue(item.chassis_no);
    const engine =
      normalizeMotorTextValue(item.motor_dtl.engine_number) ??
      normalizeMotorTextValue(item.engine_no);

    if (registration) {
      const previous = seenRegistration.get(registration);
      if (previous !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fleet', 'items', index, 'motor_dtl', 'registration_number'],
          message: 'Duplicate registration number in fleet',
        });
      }
      seenRegistration.set(registration, index);
    }

    if (chassis) {
      const previous = seenChassis.get(chassis);
      if (previous !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fleet', 'items', index, 'motor_dtl', 'chassis_number'],
          message: 'Duplicate chassis number in fleet',
        });
      }
      seenChassis.set(chassis, index);
    }

    if (engine) {
      const previous = seenEngine.get(engine);
      if (previous !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fleet', 'items', index, 'motor_dtl', 'engine_number'],
          message: 'Duplicate engine number in fleet',
        });
      }
      seenEngine.set(engine, index);
    }

    if (item.risks_covered.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['fleet', 'items', index, 'risks_covered'],
        message: 'Add at least one risk for this vehicle',
      });
    }

    item.risks_covered.forEach((risk, riskIndex) => {
      if (!normalizeText(risk.risk_code)) {
        ctx.addIssue({
          code: 'custom',
          path: [
            'fleet',
            'items',
            index,
            'risks_covered',
            riskIndex,
            'risk_code',
          ],
          message: 'Risk code is required',
        });
      }
    });

    if (item.subject_matters_covered.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['fleet', 'items', index, 'subject_matters_covered'],
        message: 'Add at least one subject matter for this vehicle',
      });
    }
  });
}

function validateNonMotor(
  values: z.infer<typeof quotationFormObjectSchema>,
  ctx: z.RefinementCtx,
) {
  if (values.nonMotor.items.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['nonMotor', 'items'],
      message: 'Add at least one subject matter',
    });
  }

  values.nonMotor.items.forEach((item, index) => {
    if (!normalizeText(item.subject_matter_reference)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nonMotor', 'items', index, 'subject_matter_reference'],
        message: 'Reference is required',
      });
    }
    if (!normalizeText(item.subject_matter_desc)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nonMotor', 'items', index, 'subject_matter_desc'],
        message: 'Description is required',
      });
    }
  });
}

export const quotationFormSchema: z.ZodType<QuotationFormValues> =
  quotationFormObjectSchema.superRefine((values, ctx) => {
    validatePolicyholder(values, ctx);
    validateRiskRows(values.risks, ctx);

    if (values.quotation_flow !== 'MOTOR_FLEET') {
      validateStandardCoverNoteFields(values, ctx);
    } else {
      if (!normalizeText(values.officer_name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['officer_name'],
          message: 'Required',
        });
      }

      if (!normalizeText(values.officer_title)) {
        ctx.addIssue({
          code: 'custom',
          path: ['officer_title'],
          message: 'Required',
        });
      }
    }

    if (values.valid_until < values.valid_from) {
      ctx.addIssue({
        code: 'custom',
        path: ['valid_until'],
        message: 'Cover end date must be after cover start date',
      });
    }

    if (values.currency.trim().toUpperCase() !== 'TZS') {
      if (normalizePositiveNumber(values.exchange_rate, 0) <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['exchange_rate'],
          message: 'Exchange rate is required',
        });
      }
    }

    if (values.cover_note_type !== '1' && !values.prev_cover_note_reference) {
      ctx.addIssue({
        code: 'custom',
        path: ['prev_cover_note_reference'],
        message: 'Previous cover note reference is required',
      });
    }

    if (values.cover_note_type === '3') {
      if (!values.endorsement_type) {
        ctx.addIssue({
          code: 'custom',
          path: ['endorsement_type'],
          message: 'Endorsement type is required',
        });
      }
      if (!values.endorsement_reason) {
        ctx.addIssue({
          code: 'custom',
          path: ['endorsement_reason'],
          message: 'Endorsement reason is required',
        });
      }
    }

    switch (values.quotation_flow) {
      case 'MOTOR_SINGLE':
        validateMotorSingle(values, ctx);
        break;
      case 'MOTOR_FLEET':
        validateFleet(values, ctx);
        break;
      case 'NON_MOTOR':
        validateNonMotor(values, ctx);
        break;
    }
  });

export type QuotationFormSchemaValues = QuotationFormValues;

/**
 * Chains an extra cover-period rule onto the base schema for brand-new Motor/Non-Motor
 * quotations only (never Fleet, never edit/endorsement mode). Returns the base schema
 * unchanged when the option is off, so existing callers/tests see no behavior change.
 */
export function createQuotationFormSchema(
  options: { enforceFreshCoverPeriod?: boolean } = {},
): z.ZodType<QuotationFormValues> {
  if (!options.enforceFreshCoverPeriod) return quotationFormSchema;

  return quotationFormSchema.superRefine((values, ctx) => {
    if (values.quotation_flow === 'MOTOR_FLEET') return;

    if (isBeforeToday(values.valid_from)) {
      ctx.addIssue({
        code: 'custom',
        path: ['valid_from'],
        message: 'Cover start date cannot be earlier than today',
      });
    }

    const totalDays = inclusiveDayCount(values.valid_from, values.valid_until);
    if (totalDays !== null && totalDays < 30) {
      ctx.addIssue({
        code: 'custom',
        path: ['valid_until'],
        message: 'Cover period must be at least 30 days',
      });
    }
  });
}

export function createEmptyRiskRow(): QuotationRiskFormRow {
  return {
    client_ref: createClientRef(),
    risk_id: '',
    risk_code: '',
    factor_values: {},
    sum_insured: '',
    sum_insured_equivalent: '',
    premium_rate: '',
    premium_before_discount: '',
    premium_after_discount: '',
    premium_excluding_tax_equivalent: '',
    premium_including_tax: '',
    minimum_amount: '',
    discounts_offered: [createEmptyDiscountRow()],
    taxes_charged: [createEmptyTaxRow()],
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

export function createEmptyAddonTaxRow(): QuotationWizardAddonRow['taxes'][number] {
  return createEmptyTaxRow();
}

export function createEmptyAddonRow(): QuotationWizardAddonRow {
  return {
    enabled: true,
    addon_reference: '',
    addon_desc: '',
    addon_amount: '',
    addon_premium_rate: '',
    premium_excluding_tax: '',
    premium_excluding_tax_equivalent: '',
    premium_including_tax: '',
    taxes: [],
  };
}

export function createEmptyMotorDetails(): QuotationFormValues['motor'] {
  return {
    vehicle_id: '',
    motor_category_code: '',
    motor_type_code: '1',
    registration_no: '',
    chassis_no: '',
    engine_no: '',
    make: '',
    model: '',
    model_no: '',
    body_type: '',
    color: '',
    manufacture_year: '',
    usage_type: '',
    motor_usage_code: '',
    vehicle_category: '',
    seating_capacity: '',
    tonnage: '',
    cubic_capacity: '',
    fuel_type: '',
    number_of_axles: '',
    axle_distance: '',
    tare_weight: '',
    gross_weight: '',
    owner_name: '',
    owner_category: '',
    owner_address: '',
    vehicle_value: '',
  };
}

function createEmptyFleetRiskRow(): QuotationFormValues['fleet']['items'][number]['risks_covered'][number] {
  return {
    client_ref: createClientRef('fleet-risk'),
    risk_id: '',
    risk_code: '',
    factor_values: {},
    sum_insured: '',
    sum_insured_equivalent: '',
    premium_rate: '',
    premium_before_discount: '',
    premium_after_discount: '',
    premium_excluding_tax_equivalent: '',
    premium_including_tax: '',
    discounts_offered: [createEmptyDiscountRow()],
    taxes_charged: [createEmptyTaxRow()],
    rating_result_metadata: null,
  };
}

export function createEmptyFleetItemRow(): QuotationWizardFleetItemRow {
  return {
    vehicle_id: '',
    fleet_item_id: '',
    registration_no: '',
    chassis_no: '',
    make: '',
    model: '',
    model_no: '',
    body_type: '',
    color: '',
    engine_no: '',
    engine_capacity: '',
    fuel_used: '',
    number_of_axles: '',
    axle_distance: '',
    manufacture_year: '',
    seating_capacity: '',
    tare_weight: '',
    gross_weight: '',
    motor_category_code: '',
    motor_type_code: '',
    motor_usage_code: '',
    owner_name: '',
    owner_category: '',
    owner_address: '',
    vehicle_value: '',
    sum_insured: '',
    premium: '',
    fleet_entry: '',
    cover_note_number: '',
    prev_cover_note_reference_number: '',
    cover_note_desc: '',
    operative_clause: '',
    endorsement_type: '',
    endorsement_reason: '',
    endorsement_premium_earned: '',
    risks_covered: [createEmptyFleetRiskRow()],
    subject_matters_covered: [
      {
        subject_matter_reference: '',
        subject_matter_desc: '',
      },
    ],
    cover_note_addons: [],
    motor_dtl: {
      motor_category: '',
      motor_type: '',
      registration_number: '',
      chassis_number: '',
      make: '',
      model: '',
      model_number: '',
      body_type: '',
      color: '',
      engine_number: '',
      engine_capacity: '',
      fuel_used: '',
      number_of_axles: '',
      axle_distance: '',
      sitting_capacity: '',
      year_of_manufacture: '',
      tare_weight: '',
      gross_weight: '',
      motor_usage: '',
      owner_name: '',
      owner_category: '',
      owner_address: '',
    },
  };
}

export function createEmptyFleetDetails(): QuotationFormValues['fleet'] {
  return {
    header: {
      fleet_id: '',
      fleet_no: '',
      fleet_name: '',
      fleet_type: '1',
      fleet_size: '1',
      comprehensive_insured: '1',
    },
    items: [createEmptyFleetItemRow()],
  };
}

export function createEmptyNonMotorItemRow(): QuotationWizardNonMotorItemRow {
  return {
    subject_matter_reference: '',
    subject_matter_desc: '',
  };
}

export function createEmptyNonMotorDetails(): QuotationFormValues['nonMotor'] {
  return {
    items: [createEmptyNonMotorItemRow()],
  };
}

function buildPolicyHolderPayload(
  values: QuotationFormSchemaValues,
  existingCustomer?: CustomerRecord | null,
): QuotationPolicyHolderPayload {
  if (values.policyholder_mode === 'existing' && existingCustomer) {
    return {
      policy_holder_name:
        getCustomerFullName(existingCustomer) ||
        existingCustomer.company_name ||
        '',
      policy_holder_birth_date: existingCustomer.date_of_birth ?? '',
      policy_holder_type:
        existingCustomer.policy_holder_type ??
        (existingCustomer.customer_type === 'CORPORATE' ? 2 : 1),
      policy_holder_id_number: existingCustomer.id_number ?? '',
      policy_holder_id_type: existingCustomer.id_type ?? 1,
      gender: existingCustomer.gender ?? null,
      country_code: existingCustomer.country_code ?? 'TZA',
      region: existingCustomer.region ?? '',
      district: existingCustomer.district ?? '',
      street: existingCustomer.street ?? null,
      policy_holder_phone_number: existingCustomer.phone ?? '',
      policy_holder_fax: existingCustomer.fax ?? null,
      postal_address: existingCustomer.postal_address ?? null,
      email_address: existingCustomer.email ?? null,
    };
  }

  const policyholder = values.policyholder;
  const isCorporate = policyholder.customer_type === 'CORPORATE';
  const policyHolderName =
    normalizeText(policyholder.full_name) ??
    (isCorporate
      ? normalizeText(policyholder.company_name)
      : [
          policyholder.first_name,
          policyholder.middle_name,
          policyholder.last_name,
        ]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(' ')) ??
    '';

  return {
    policy_holder_name: policyHolderName,
    policy_holder_birth_date: policyholder.date_of_birth,
    policy_holder_type: isCorporate ? 2 : 1,
    policy_holder_id_number: policyholder.id_number,
    policy_holder_id_type: Number(policyholder.id_type || 1),
    gender: policyholder.gender || null,
    country_code: policyholder.country_code || 'TZA',
    region: policyholder.region,
    district: policyholder.district,
    street: normalizeText(policyholder.street),
    policy_holder_phone_number: policyholder.phone,
    policy_holder_fax: normalizeText(policyholder.fax),
    postal_address: normalizeText(policyholder.postal_address),
    email_address: normalizeText(policyholder.email),
  };
}

function buildTaxPayload(
  taxes: Array<{
    tax_code: string;
    is_tax_exempted: boolean;
    tax_exemption_type: string;
    tax_exemption_reference: string;
    tax_rate: string;
    tax_amount: string;
  }>,
): QuotationTaxPayload[] {
  return taxes
    .filter((tax) => normalizeText(tax.tax_code))
    .map((tax) => ({
      tax_code: tax.tax_code,
      is_tax_exempted: toTaxFlag(tax.is_tax_exempted),
      tax_exemption_type: tax.is_tax_exempted
        ? normalizeText(tax.tax_exemption_type)
        : null,
      tax_exemption_reference: tax.is_tax_exempted
        ? normalizeText(tax.tax_exemption_reference)
        : null,
      tax_rate: normalizeRateNumber(tax.tax_rate),
      tax_amount: normalizeMoneyNumber(tax.tax_amount),
    }));
}

function buildDiscountPayload(
  discounts: Array<{
    discount_type: string;
    discount_rate: string;
    discount_amount: string;
    request_reason_code: string;
    request_comment: string;
    effective_from: string;
    effective_to: string;
    requested_by: string;
    requested_at: string;
    max_permitted_rate: string;
    max_permitted_amount: string;
    approval_required: boolean;
    approval_status: string;
    approved_rate: string;
    approved_amount: string;
    approved_by: string;
    approval_date: string;
    rejection_reason: string;
  }>,
): QuotationDiscountPayload[] {
  return discounts
    .filter((discount) => normalizeText(discount.discount_type))
    .map((discount) => ({
      discount_type: normalizePositiveNumber(discount.discount_type),
      discount_rate: normalizeRateNumber(discount.discount_rate),
      discount_amount: normalizeMoneyNumber(discount.discount_amount),
      request_reason_code: normalizeText(discount.request_reason_code),
      request_comment: normalizeText(discount.request_comment),
      effective_from: normalizeText(discount.effective_from),
      effective_to: normalizeText(discount.effective_to),
      requested_by: normalizeText(discount.requested_by),
      requested_at: normalizeText(discount.requested_at),
      max_permitted_rate:
        normalizeText(discount.max_permitted_rate) === null
          ? null
          : normalizeRateNumber(discount.max_permitted_rate),
      max_permitted_amount:
        normalizeText(discount.max_permitted_amount) === null
          ? null
          : normalizeMoneyNumber(discount.max_permitted_amount),
      approval_required: discount.approval_required,
      approval_status: normalizeAdjustmentApprovalStatus(
        discount.approval_status,
      ),
      approved_rate:
        normalizeText(discount.approved_rate) === null
          ? null
          : normalizeRateNumber(discount.approved_rate),
      approved_amount:
        normalizeText(discount.approved_amount) === null
          ? null
          : normalizeMoneyNumber(discount.approved_amount),
      approved_by: normalizeText(discount.approved_by),
      approval_date: normalizeText(discount.approval_date),
      rejection_reason: normalizeText(discount.rejection_reason),
    }));
}

function buildRiskPayload(
  risk: QuotationRiskFormRow,
  values: QuotationFormSchemaValues,
): QuotationRiskCoveredPayload {
  const currentPricingSignature = buildSingleRiskPricingSignature({
    quotation_type: values.quotation_type,
    product_id: values.product_id,
    valid_from: values.valid_from,
    valid_until: values.valid_until,
    currency: values.currency,
    exchange_rate: values.exchange_rate,
    motor: values.motor,
    addons: values.addons,
    risk,
  });

  return {
    risk_code: risk.risk_code,
    pricing_quote_id: extractPricingQuoteId(
      risk.rating_result_metadata,
      currentPricingSignature,
    ),
    sum_insured: normalizeMoneyNumber(risk.sum_insured),
    sum_insured_equivalent: normalizeMoneyNumber(risk.sum_insured),
    premium_rate: normalizeRateNumber(risk.premium_rate || risk.rate),
    premium_before_discount: normalizeMoneyNumber(risk.premium_before_discount),
    premium_after_discount:
      normalizeMoneyNumber(risk.premium_after_discount) ||
      normalizeMoneyNumber(risk.basic_premium),
    premium_excluding_tax_equivalent:
      normalizeMoneyNumber(risk.premium_excluding_tax_equivalent) ||
      normalizeMoneyNumber(risk.basic_premium),
    premium_including_tax:
      normalizeMoneyNumber(risk.premium_including_tax) ||
      normalizeMoneyNumber(risk.total_premium),
    discounts_offered: buildDiscountPayload(risk.discounts_offered),
    taxes_charged: buildTaxPayload(risk.taxes_charged),
  };
}

function buildAddonPayload(
  addons: QuotationFormValues['addons'],
): QuotationPayload['cover_note_dtl']['cover_note_addons'] {
  return addons
    .filter((addon) => addon.enabled)
    .map((addon) => ({
      addon_reference: addon.addon_reference,
      addon_desc: addon.addon_desc,
      addon_amount: normalizeMoneyNumber(addon.addon_amount),
      addon_premium_rate: normalizeRateNumber(addon.addon_premium_rate),
      premium_excluding_tax:
        normalizeMoneyNumber(addon.premium_excluding_tax) ||
        normalizeMoneyNumber(addon.addon_amount),
      premium_excluding_tax_equivalent:
        normalizeMoneyNumber(addon.premium_excluding_tax_equivalent) ||
        normalizeMoneyNumber(addon.premium_excluding_tax) ||
        normalizeMoneyNumber(addon.addon_amount),
      premium_including_tax:
        normalizeMoneyNumber(addon.premium_including_tax) ||
        roundMoney(
          toDecimal(normalizeMoneyNumber(addon.premium_excluding_tax)).plus(
            sumDecimals(
              buildTaxPayload(addon.taxes).map((tax) => tax.tax_amount),
            ),
          ),
        ),
      taxes_charged: buildTaxPayload(addon.taxes),
    }));
}

function buildCommonDetail(
  values: QuotationFormSchemaValues,
  policyHolder: QuotationPolicyHolderPayload,
  salePointCode: string,
  productCode: string,
) {
  const risks = values.risks.map((risk) => buildRiskPayload(risk, values));
  return {
    prev_cover_note_reference_number: normalizeText(
      values.prev_cover_note_reference,
    ),
    cover_note_start_date: formatDateTime(values.valid_from, false),
    cover_note_end_date: formatDateTime(values.valid_until, true),
    cover_note_desc: normalizeText(values.cover_note_desc) ?? '',
    operative_clause: normalizeText(values.operative_clause) ?? '',
    payment_mode: normalizePositiveNumber(values.payment_mode_tira),
    currency_code: values.currency.trim().toUpperCase(),
    exchange_rate:
      values.currency.trim().toUpperCase() === 'TZS'
        ? 1
        : normalizeExchangeRateNumber(values.exchange_rate),
    total_premium_excluding_tax:
      normalizeMoneyNumber(values.basic_premium) ||
      roundMoney(sumDecimals(risks.map((risk) => risk.premium_after_discount))),
    total_premium_including_tax:
      normalizeMoneyNumber(values.total_premium) ||
      roundMoney(sumDecimals(risks.map((risk) => risk.premium_including_tax))),
    commision_paid:
      values.channel_type === 'DIRECT'
        ? 0
        : normalizeMoneyNumber(values.commission_paid) ||
          normalizeMoneyNumber(values.total_commission),
    commision_rate:
      values.channel_type === 'DIRECT'
        ? 0
        : normalizeRateNumber(values.commission_rate),
    officer_name: normalizeText(values.officer_name) ?? '',
    officer_title: normalizeText(values.officer_title) ?? '',
    product_code: productCode,
    endorsement_type: values.endorsement_type
      ? normalizePositiveNumber(values.endorsement_type)
      : null,
    endorsement_reason: normalizeText(values.endorsement_reason),
    endorsement_premium_earned: values.endorsement_premium_earned
      ? normalizeMoneyNumber(values.endorsement_premium_earned)
      : null,
    risks_covered: risks,
    cover_note_addons: buildAddonPayload(values.addons),
    policy_holders: [policyHolder],
  };
}

export function buildMotorSingleQuotationPayload(
  values: QuotationFormSchemaValues,
  context: {
    salePointCode: string;
    productCode: string;
    existingCustomer?: CustomerRecord | null;
  },
): QuotationPayload {
  const policyHolder = buildPolicyHolderPayload(
    values,
    context.existingCustomer,
  );
  const detail = buildCommonDetail(
    values,
    policyHolder,
    context.salePointCode,
    context.productCode,
  );
  const registrationNumber = normalizeMotorTextInput(
    values.motor.registration_no,
  );
  const chassisNumber = normalizeMotorTextInput(values.motor.chassis_no);
  const engineNumber = normalizeMotorTextInput(values.motor.engine_no);
  const make = normalizeMotorTextInput(values.motor.make);
  const model = normalizeMotorTextInput(values.motor.model);
  const modelNumber = normalizeMotorTextValue(values.motor.model_no);

  return {
    internal_quotation: {
      insurer_company_id: values.insurer_company_id,
      intermediary_company_id: normalizeText(values.intermediary_company_id),
      department_id: normalizeText(values.department_id),
      category_id: values.category_id,
      product_id: values.product_id,
      sub_class_id: normalizeText(values.sub_class_id),
      quotation_type: 'MOTOR',
      quotation_flow: 'MOTOR_SINGLE',
      channel_type: values.channel_type,
      is_fleet: false,
    },
    cover_note_hdr: {
      cover_note_type: normalizePositiveNumber(values.cover_note_type),
    },
    cover_note_dtl: {
      ...detail,
      subject_matters_covered: [
        {
          subject_matter_reference:
            normalizeMotorTextValue(values.motor.registration_no) ??
            normalizeMotorTextValue(values.motor.chassis_no) ??
            '',
          subject_matter_desc:
            [make, model].filter(Boolean).join(' ') || 'Motor vehicle',
        },
      ],
      motor_dtl: {
        motor_category: normalizePositiveNumber(
          values.motor.motor_category_code,
        ),
        motor_type: normalizePositiveNumber(values.motor.motor_type_code),
        registration_number: registrationNumber,
        chassis_number: chassisNumber,
        make,
        model,
        model_number: modelNumber,
        body_type: values.motor.body_type,
        color: values.motor.color,
        engine_number: engineNumber,
        engine_capacity: values.motor.cubic_capacity,
        fuel_used: values.motor.fuel_type,
        number_of_axles: normalizePositiveNumber(values.motor.number_of_axles),
        axle_distance: normalizeNumber(values.motor.axle_distance),
        sitting_capacity: normalizePositiveNumber(
          values.motor.seating_capacity,
        ),
        year_of_manufacture: normalizePositiveNumber(
          values.motor.manufacture_year,
        ),
        tare_weight: normalizeNumber(values.motor.tare_weight),
        gross_weight: normalizeNumber(values.motor.gross_weight),
        motor_usage: normalizePositiveNumber(values.motor.motor_usage_code),
        owner_name: values.motor.owner_name,
        owner_category: normalizePositiveNumber(values.motor.owner_category),
        owner_address: values.motor.owner_address,
      },
    },
  };
}

export function buildMotorFleetQuotationPayload(
  values: QuotationFormSchemaValues,
  context: {
    salePointCode: string;
    productCode: string;
    existingCustomer?: CustomerRecord | null;
  },
): QuotationPayload {
  const policyHolder = buildPolicyHolderPayload(
    values,
    context.existingCustomer,
  );
  const fleetItems = values.fleet.items.map((item, index) => {
    const registrationNumber = normalizeMotorTextInput(
      item.motor_dtl.registration_number,
    );
    const chassisNumber = normalizeMotorTextInput(
      item.motor_dtl.chassis_number,
    );
    const engineNumber = normalizeMotorTextInput(item.motor_dtl.engine_number);
    const make = normalizeMotorTextInput(item.motor_dtl.make);
    const model = normalizeMotorTextInput(item.motor_dtl.model);
    const modelNumber = normalizeMotorTextValue(item.motor_dtl.model_number);
    const taxMappedAddons = item.cover_note_addons.map((addon) => ({
      addon_reference: addon.addon_reference,
      addon_desc: addon.addon_desc,
      addon_amount: normalizeMoneyNumber(addon.addon_amount),
      addon_premium_rate: normalizeRateNumber(addon.addon_premium_rate),
      premium_excluding_tax:
        normalizeMoneyNumber(addon.premium_excluding_tax) ||
        normalizeMoneyNumber(addon.addon_amount),
      premium_excluding_tax_equivalent:
        normalizeMoneyNumber(addon.premium_excluding_tax_equivalent) ||
        normalizeMoneyNumber(addon.premium_excluding_tax) ||
        normalizeMoneyNumber(addon.addon_amount),
      premium_including_tax:
        normalizeMoneyNumber(addon.premium_including_tax) ||
        roundMoney(
          toDecimal(normalizeMoneyNumber(addon.premium_excluding_tax)).plus(
            sumDecimals(
              buildTaxPayload(addon.taxes).map((tax) => tax.tax_amount),
            ),
          ),
        ),
      taxes_charged: buildTaxPayload(addon.taxes),
    }));

    return {
      fleet_entry: normalizePositiveNumber(item.fleet_entry, index + 1),
      prev_cover_note_reference_number: normalizeText(
        item.prev_cover_note_reference_number,
      ),
      cover_note_desc: item.cover_note_desc,
      operative_clause: item.operative_clause,
      endorsement_type: item.endorsement_type
        ? normalizePositiveNumber(item.endorsement_type)
        : null,
      endorsement_reason: normalizeText(item.endorsement_reason),
      endorsement_premium_earned: item.endorsement_premium_earned
        ? normalizeMoneyNumber(item.endorsement_premium_earned)
        : null,
      risks_covered: item.risks_covered.map((risk) => {
        const currentPricingSignature = buildFleetRiskPricingSignature({
          quotation_type: values.quotation_type,
          product_id: values.product_id,
          valid_from: values.valid_from,
          valid_until: values.valid_until,
          currency: values.currency,
          exchange_rate: values.exchange_rate,
          fleet_header: values.fleet.header,
          item,
          risk,
        });

        return {
          risk_code: risk.risk_code,
          pricing_quote_id: extractPricingQuoteId(
            risk.rating_result_metadata,
            currentPricingSignature,
          ),
          sum_insured: normalizeMoneyNumber(risk.sum_insured),
          sum_insured_equivalent: normalizeMoneyNumber(risk.sum_insured),
          premium_rate: normalizeRateNumber(risk.premium_rate),
          premium_before_discount: normalizeMoneyNumber(
            risk.premium_before_discount,
          ),
          premium_after_discount: normalizeMoneyNumber(
            risk.premium_after_discount,
          ),
          premium_excluding_tax_equivalent: normalizeMoneyNumber(
            risk.premium_excluding_tax_equivalent,
          ),
          premium_including_tax: normalizeMoneyNumber(
            risk.premium_including_tax,
          ),
          discounts_offered: buildDiscountPayload(risk.discounts_offered),
          taxes_charged: buildTaxPayload(risk.taxes_charged),
        };
      }),
      subject_matters_covered: item.subject_matters_covered.map((subject) => ({
        subject_matter_reference: subject.subject_matter_reference,
        subject_matter_desc: subject.subject_matter_desc,
      })),
      cover_note_addons: taxMappedAddons,
      motor_dtl: {
        motor_category: normalizePositiveNumber(item.motor_dtl.motor_category),
        motor_type: normalizePositiveNumber(item.motor_dtl.motor_type),
        registration_number: registrationNumber,
        chassis_number: chassisNumber,
        make,
        model,
        model_number: modelNumber,
        body_type: item.motor_dtl.body_type,
        color: item.motor_dtl.color,
        engine_number: engineNumber,
        engine_capacity: item.motor_dtl.engine_capacity,
        fuel_used: item.motor_dtl.fuel_used,
        number_of_axles: normalizePositiveNumber(
          item.motor_dtl.number_of_axles,
        ),
        axle_distance: normalizeNumber(item.motor_dtl.axle_distance),
        sitting_capacity: normalizePositiveNumber(
          item.motor_dtl.sitting_capacity,
        ),
        year_of_manufacture: normalizePositiveNumber(
          item.motor_dtl.year_of_manufacture,
        ),
        tare_weight: normalizeNumber(item.motor_dtl.tare_weight),
        gross_weight: normalizeNumber(item.motor_dtl.gross_weight),
        motor_usage: normalizePositiveNumber(item.motor_dtl.motor_usage),
        owner_name: item.motor_dtl.owner_name,
        owner_category: normalizePositiveNumber(item.motor_dtl.owner_category),
        owner_address: item.motor_dtl.owner_address,
      },
    };
  });

  return {
    internal_quotation: {
      insurer_company_id: values.insurer_company_id,
      intermediary_company_id: normalizeText(values.intermediary_company_id),
      department_id: normalizeText(values.department_id),
      category_id: values.category_id,
      product_id: values.product_id,
      sub_class_id: normalizeText(values.sub_class_id),
      quotation_type: 'MOTOR',
      quotation_flow: 'MOTOR_FLEET',
      channel_type: values.channel_type,
      is_fleet: true,
    },
    cover_note_hdr: {
      cover_note_type: normalizePositiveNumber(values.cover_note_type),
    },
    cover_note_dtl: {
      fleet_hdr: {
        fleet_id: values.fleet.header.fleet_id,
        fleet_type: normalizePositiveNumber(values.fleet.header.fleet_type),
        fleet_size: fleetItems.length,
        comprehensive_insured:
          normalizeNumber(values.fleet.header.comprehensive_insured) ||
          fleetItems.length,
        cover_note_start_date: formatDateTime(values.valid_from, false),
        cover_note_end_date: formatDateTime(values.valid_until, true),
        payment_mode: normalizePositiveNumber(values.payment_mode_tira),
        currency_code: values.currency.trim().toUpperCase(),
        exchange_rate:
          values.currency.trim().toUpperCase() === 'TZS'
            ? 1
            : normalizeExchangeRateNumber(values.exchange_rate),
        total_premium_excluding_tax: roundMoney(
          sumDecimals(
            fleetItems.flatMap((fleetItem) =>
              fleetItem.risks_covered.map(
                (risk) => risk.premium_excluding_tax_equivalent,
              ),
            ),
          ),
        ),
        total_premium_including_tax: roundMoney(
          sumDecimals(
            fleetItems.flatMap((fleetItem) =>
              fleetItem.risks_covered.map((risk) => risk.premium_including_tax),
            ),
          ),
        ),
        commision_paid:
          values.channel_type === 'DIRECT'
            ? 0
            : normalizeMoneyNumber(values.commission_paid) ||
              normalizeMoneyNumber(values.total_commission),
        commision_rate:
          values.channel_type === 'DIRECT'
            ? 0
            : normalizeRateNumber(values.commission_rate),
        officer_name: normalizeText(values.officer_name) ?? '',
        officer_title: normalizeText(values.officer_title) ?? '',
        product_code: context.productCode,
        policy_holders: [policyHolder],
      },
      fleet_dtls: fleetItems,
    },
  };
}

export function buildNonMotorQuotationPayload(
  values: QuotationFormSchemaValues,
  context: {
    salePointCode: string;
    productCode: string;
    existingCustomer?: CustomerRecord | null;
  },
): QuotationPayload {
  const policyHolder = buildPolicyHolderPayload(
    values,
    context.existingCustomer,
  );
  const detail = buildCommonDetail(
    values,
    policyHolder,
    context.salePointCode,
    context.productCode,
  );

  return {
    internal_quotation: {
      insurer_company_id: values.insurer_company_id,
      intermediary_company_id: normalizeText(values.intermediary_company_id),
      department_id: normalizeText(values.department_id),
      category_id: values.category_id,
      product_id: values.product_id,
      sub_class_id: normalizeText(values.sub_class_id),
      quotation_type: 'NON_MOTOR',
      quotation_flow: 'NON_MOTOR',
      channel_type: values.channel_type,
      is_fleet: false,
    },
    cover_note_hdr: {
      cover_note_type: normalizePositiveNumber(values.cover_note_type),
    },
    cover_note_dtl: {
      ...detail,
      subject_matters_covered: values.nonMotor.items.map((item) => ({
        subject_matter_reference: item.subject_matter_reference,
        subject_matter_desc: item.subject_matter_desc,
      })),
    },
  };
}

export function buildQuotationPayload(
  values: QuotationFormSchemaValues,
  context: {
    salePointCode: string;
    productCode: string;
    existingCustomer?: CustomerRecord | null;
  },
): QuotationPayload {
  switch (values.quotation_flow) {
    case 'MOTOR_SINGLE':
      return buildMotorSingleQuotationPayload(values, context);
    case 'MOTOR_FLEET':
      return buildMotorFleetQuotationPayload(values, context);
    case 'NON_MOTOR':
    default:
      return buildNonMotorQuotationPayload(values, context);
  }
}

export function buildQuotationDraftPayload(
  values: QuotationFormSchemaValues,
  currentWizardStep?: string | null,
): QuotationDraftRecordPayload {
  return {
    insurer_company_id: values.insurer_company_id || null,
    intermediary_company_id: values.intermediary_company_id || null,
    department_id: values.department_id || null,
    customer_id: values.customer_id || null,
    sub_class_id: values.sub_class_id || null,
    category_id: values.category_id,
    product_id: values.product_id,
    quotation_type: values.quotation_type,
    quotation_flow: values.quotation_flow,
    channel_type: values.channel_type,
    is_fleet: values.is_fleet,
    current_wizard_step: currentWizardStep ?? null,
    draft_payload: values as unknown as Record<string, unknown>,
  };
}

function mapPolicyHolderToForm(
  record: QuotationDetailRecord,
): CustomerFormValues {
  const source =
    record.internal_quotation.quotation_flow === 'MOTOR_FLEET'
      ? record.cover_note_dtl.fleet_hdr?.policy_holders?.[0]
      : record.cover_note_dtl.policy_holders?.[0];

  return buildPolicyholderFormDefaults(source);
}

function mapRiskRows(
  detailRisks: QuotationRiskCoveredPayload[] | undefined,
): QuotationRiskFormRow[] {
  return (detailRisks ?? []).map((risk) => ({
    client_ref: createClientRef(),
    risk_id: '',
    risk_code: risk.risk_code,
    factor_values: {},
    sum_insured: String(risk.sum_insured),
    sum_insured_equivalent: String(risk.sum_insured_equivalent),
    premium_rate: String(risk.premium_rate),
    premium_before_discount: String(risk.premium_before_discount),
    premium_after_discount: String(risk.premium_after_discount),
    premium_excluding_tax_equivalent: String(
      risk.premium_excluding_tax_equivalent,
    ),
    premium_including_tax: String(risk.premium_including_tax),
    minimum_amount: '',
    discounts_offered:
      risk.discounts_offered.length > 0
        ? risk.discounts_offered.map((discount) => ({
            discount_type: String(discount.discount_type),
            discount_rate: String(discount.discount_rate),
            discount_amount: String(discount.discount_amount),
            request_reason_code: discount.request_reason_code ?? '',
            request_comment: discount.request_comment ?? '',
            effective_from: discount.effective_from ?? '',
            effective_to: discount.effective_to ?? '',
            requested_by: discount.requested_by ?? '',
            requested_at: discount.requested_at ?? '',
            max_permitted_rate:
              discount.max_permitted_rate == null
                ? ''
                : String(discount.max_permitted_rate),
            max_permitted_amount:
              discount.max_permitted_amount == null
                ? ''
                : String(discount.max_permitted_amount),
            approval_required: discount.approval_required ?? false,
            approval_status: discount.approval_status ?? '',
            approved_rate:
              discount.approved_rate == null
                ? ''
                : String(discount.approved_rate),
            approved_amount:
              discount.approved_amount == null
                ? ''
                : String(discount.approved_amount),
            approved_by: discount.approved_by ?? '',
            approval_date: discount.approval_date ?? '',
            rejection_reason: discount.rejection_reason ?? '',
          }))
        : [createEmptyDiscountRow()],
    taxes_charged:
      risk.taxes_charged.length > 0
        ? risk.taxes_charged.map((tax) => ({
            tax_code: tax.tax_code,
            is_tax_exempted: toBooleanTaxFlag(tax.is_tax_exempted),
            tax_exemption_type: tax.tax_exemption_type ?? '',
            tax_exemption_reference: tax.tax_exemption_reference ?? '',
            tax_rate: String(tax.tax_rate),
            tax_amount: String(tax.tax_amount),
          }))
        : [createEmptyTaxRow()],
    rate: String(risk.premium_rate),
    basic_premium: String(risk.premium_after_discount),
    discount_amount: String(
      risk.discounts_offered.reduce(
        (sum, discount) => sum + discount.discount_amount,
        0,
      ),
    ),
    tax_amount: String(
      risk.taxes_charged.reduce((sum, tax) => sum + tax.tax_amount, 0),
    ),
    charges_amount: '',
    commission_amount: '',
    total_premium: String(risk.premium_including_tax),
    net_premium: String(risk.premium_including_tax),
    rating_result_metadata: {
      pricing_quote_id: risk.pricing_quote_id ?? null,
    },
  }));
}

function extractPricingQuoteId(
  metadata: QuotationRiskFormRow['rating_result_metadata'],
  currentPricingSignature?: string,
): string | null {
  const pricingMetadata = readPricingQuoteMetadata(metadata);
  if (!pricingMetadata) {
    return null;
  }

  if (pricingMetadata.pricing_is_stale) {
    return null;
  }

  if (
    currentPricingSignature &&
    pricingMetadata.pricing_input_signature &&
    pricingMetadata.pricing_input_signature !== currentPricingSignature
  ) {
    return null;
  }

  const pricingQuoteId = pricingMetadata.pricing_quote_id;

  return typeof pricingQuoteId === 'string' && pricingQuoteId.trim()
    ? pricingQuoteId.trim()
    : null;
}

function mapAddons(
  addons: QuotationDetailRecord['cover_note_dtl']['cover_note_addons'],
) {
  return (addons ?? []).map((addon) => ({
    enabled: true,
    addon_reference: addon.addon_reference,
    addon_desc: addon.addon_desc,
    addon_amount: String(addon.addon_amount),
    addon_premium_rate: String(addon.addon_premium_rate),
    premium_excluding_tax: String(addon.premium_excluding_tax),
    premium_excluding_tax_equivalent: String(
      addon.premium_excluding_tax_equivalent,
    ),
    premium_including_tax: String(addon.premium_including_tax),
    taxes: addon.taxes_charged.map((tax) => ({
      tax_code: tax.tax_code,
      is_tax_exempted: toBooleanTaxFlag(tax.is_tax_exempted),
      tax_exemption_type: tax.tax_exemption_type ?? '',
      tax_exemption_reference: tax.tax_exemption_reference ?? '',
      tax_rate: String(tax.tax_rate),
      tax_amount: String(tax.tax_amount),
    })),
  }));
}

export function quotationRecordToFormValues(
  record: QuotationDetailRecord,
): Partial<QuotationFormValues> {
  const flow = record.internal_quotation.quotation_flow;
  const hasExistingCustomer = !!record.customer_id;
  const policyholderMode: 'existing' | 'new' = hasExistingCustomer
    ? 'existing'
    : 'new';
  const common = {
    insurer_company_id: record.internal_quotation.insurer_company_id,
    intermediary_company_id:
      record.internal_quotation.intermediary_company_id ?? '',
    branch_id: record.internal_quotation.branch_id ?? '',
    department_id: record.internal_quotation.department_id ?? '',
    policyholder_mode: policyholderMode,
    customer_id: record.customer_id ?? '',
    policyholder: mapPolicyHolderToForm(record),
    category_id: record.internal_quotation.category_id,
    product_id: record.internal_quotation.product_id,
    sub_class_id: record.internal_quotation.sub_class_id ?? '',
    quotation_flow: flow,
    quotation_type: record.internal_quotation.quotation_type,
    is_fleet: record.internal_quotation.is_fleet,
    channel_type: record.internal_quotation.channel_type,
    status: record.status,
    currency:
      record.cover_note_dtl.fleet_hdr?.currency_code ??
      record.cover_note_dtl.currency_code ??
      'TZS',
    exchange_rate: String(
      record.cover_note_dtl.fleet_hdr?.exchange_rate ??
        record.cover_note_dtl.exchange_rate ??
        1,
    ),
    sum_insured: '',
    basic_premium: String(
      record.cover_note_dtl.fleet_hdr?.total_premium_excluding_tax ??
        record.cover_note_dtl.total_premium_excluding_tax ??
        0,
    ),
    total_discount: '',
    total_tax: '',
    total_charges: '',
    total_commission: String(
      record.cover_note_dtl.fleet_hdr?.commision_paid ??
        record.cover_note_dtl.commision_paid ??
        0,
    ),
    total_premium: String(
      record.cover_note_dtl.fleet_hdr?.total_premium_including_tax ??
        record.cover_note_dtl.total_premium_including_tax ??
        0,
    ),
    net_premium: String(
      record.cover_note_dtl.fleet_hdr?.total_premium_including_tax ??
        record.cover_note_dtl.total_premium_including_tax ??
        0,
    ),
    valid_from: dateOnly(
      record.cover_note_dtl.fleet_hdr?.cover_note_start_date ??
        record.cover_note_dtl.cover_note_start_date,
    ),
    valid_until: dateOnly(
      record.cover_note_dtl.fleet_hdr?.cover_note_end_date ??
        record.cover_note_dtl.cover_note_end_date,
    ),
    rating_version: '',
    rejection_reason: '',
    sale_point_id: '',
    cover_note_desc: record.cover_note_dtl.cover_note_desc ?? '',
    operative_clause: record.cover_note_dtl.operative_clause ?? '',
    cover_note_type: String(record.cover_note_hdr.cover_note_type) as
      | '1'
      | '2'
      | '3',
    prev_cover_note_reference:
      record.cover_note_dtl.prev_cover_note_reference_number ?? '',
    endorsement_type: String(
      record.cover_note_dtl.endorsement_type ??
        record.cover_note_dtl.fleet_dtls?.[0]?.endorsement_type ??
        '',
    ) as '1' | '2' | '3' | '4' | '',
    endorsement_reason:
      record.cover_note_dtl.endorsement_reason ??
      record.cover_note_dtl.fleet_dtls?.[0]?.endorsement_reason ??
      '',
    endorsement_premium_earned:
      record.cover_note_dtl.endorsement_premium_earned != null
        ? String(record.cover_note_dtl.endorsement_premium_earned)
        : record.cover_note_dtl.fleet_dtls?.[0]?.endorsement_premium_earned !=
            null
          ? String(
              record.cover_note_dtl.fleet_dtls[0].endorsement_premium_earned,
            )
          : '',
    commission_paid: String(
      record.cover_note_dtl.fleet_hdr?.commision_paid ??
        record.cover_note_dtl.commision_paid ??
        0,
    ),
    commission_rate: String(
      record.cover_note_dtl.fleet_hdr?.commision_rate ??
        record.cover_note_dtl.commision_rate ??
        0,
    ),
    officer_name:
      record.cover_note_dtl.fleet_hdr?.officer_name ??
      record.cover_note_dtl.officer_name ??
      '',
    officer_title:
      record.cover_note_dtl.fleet_hdr?.officer_title ??
      record.cover_note_dtl.officer_title ??
      '',
    payment_mode_tira: String(
      record.cover_note_dtl.fleet_hdr?.payment_mode ??
        record.cover_note_dtl.payment_mode ??
        1,
    ) as '1' | '2' | '3',
    addons: mapAddons(
      flow === 'MOTOR_FLEET' ? [] : record.cover_note_dtl.cover_note_addons,
    ),
    motor_mode: 'new' as const,
    motor: createEmptyMotorDetails(),
    fleet: createEmptyFleetDetails(),
    nonMotor: createEmptyNonMotorDetails(),
    risks: mapRiskRows(record.cover_note_dtl.risks_covered),
  };

  if (flow === 'MOTOR_SINGLE' && record.cover_note_dtl.motor_dtl) {
    const motor = record.cover_note_dtl.motor_dtl;
    common.motor = {
      ...createEmptyMotorDetails(),
      motor_category_code: String(motor.motor_category) as '' | '1' | '2',
      motor_type_code: String(motor.motor_type) as '' | '1' | '2',
      registration_no: normalizeMotorTextInput(motor.registration_number),
      chassis_no: normalizeMotorTextInput(motor.chassis_number),
      engine_no: normalizeMotorTextInput(motor.engine_number),
      make: normalizeMotorTextInput(motor.make),
      model: normalizeMotorTextInput(motor.model),
      model_no: normalizeMotorTextInput(motor.model_number),
      body_type: motor.body_type,
      color: motor.color,
      manufacture_year: String(motor.year_of_manufacture),
      usage_type: '',
      motor_usage_code: String(motor.motor_usage) as '' | '1' | '2',
      vehicle_category: '',
      seating_capacity: String(motor.sitting_capacity),
      tonnage: '',
      cubic_capacity: motor.engine_capacity,
      fuel_type: motor.fuel_used,
      number_of_axles: String(motor.number_of_axles),
      axle_distance: String(motor.axle_distance),
      tare_weight: String(motor.tare_weight),
      gross_weight: String(motor.gross_weight),
      owner_name: motor.owner_name,
      owner_category: String(motor.owner_category) as '' | '1' | '2',
      owner_address: motor.owner_address,
      vehicle_value: '',
    };
  }

  if (flow === 'MOTOR_FLEET') {
    const fleetHeader = record.cover_note_dtl.fleet_hdr;
    const fleetItems = record.cover_note_dtl.fleet_dtls ?? [];
    common.fleet = {
      header: {
        fleet_id: fleetHeader?.fleet_id ?? '',
        fleet_no: fleetHeader?.fleet_id ?? '',
        fleet_name: '',
        fleet_type: String(fleetHeader?.fleet_type ?? 1) as '1' | '2',
        fleet_size: String(fleetHeader?.fleet_size ?? fleetItems.length),
        comprehensive_insured: String(
          fleetHeader?.comprehensive_insured ?? fleetItems.length,
        ),
      },
      items: fleetItems.map((item) => ({
        ...createEmptyFleetItemRow(),
        fleet_entry: String(item.fleet_entry),
        prev_cover_note_reference_number:
          item.prev_cover_note_reference_number ?? '',
        cover_note_desc: item.cover_note_desc,
        operative_clause: item.operative_clause,
        endorsement_type: String(item.endorsement_type ?? '') as
          | '1'
          | '2'
          | '3'
          | '4'
          | '',
        endorsement_reason: item.endorsement_reason ?? '',
        endorsement_premium_earned:
          item.endorsement_premium_earned != null
            ? String(item.endorsement_premium_earned)
            : '',
        risks_covered: item.risks_covered.map((risk) => ({
          client_ref: createClientRef('fleet-risk'),
          risk_id: '',
          risk_code: risk.risk_code,
          factor_values: {},
          sum_insured: String(risk.sum_insured),
          sum_insured_equivalent: String(risk.sum_insured_equivalent),
          premium_rate: String(risk.premium_rate),
          premium_before_discount: String(risk.premium_before_discount),
          premium_after_discount: String(risk.premium_after_discount),
          premium_excluding_tax_equivalent: String(
            risk.premium_excluding_tax_equivalent,
          ),
          premium_including_tax: String(risk.premium_including_tax),
          discounts_offered:
            risk.discounts_offered.length > 0
              ? risk.discounts_offered.map((discount) => ({
                  discount_type: String(discount.discount_type),
                  discount_rate: String(discount.discount_rate),
                  discount_amount: String(discount.discount_amount),
                  request_reason_code: discount.request_reason_code ?? '',
                  request_comment: discount.request_comment ?? '',
                  effective_from: discount.effective_from ?? '',
                  effective_to: discount.effective_to ?? '',
                  requested_by: discount.requested_by ?? '',
                  requested_at: discount.requested_at ?? '',
                  max_permitted_rate:
                    discount.max_permitted_rate == null
                      ? ''
                      : String(discount.max_permitted_rate),
                  max_permitted_amount:
                    discount.max_permitted_amount == null
                      ? ''
                      : String(discount.max_permitted_amount),
                  approval_required: discount.approval_required ?? false,
                  approval_status: discount.approval_status ?? '',
                  approved_rate:
                    discount.approved_rate == null
                      ? ''
                      : String(discount.approved_rate),
                  approved_amount:
                    discount.approved_amount == null
                      ? ''
                      : String(discount.approved_amount),
                  approved_by: discount.approved_by ?? '',
                  approval_date: discount.approval_date ?? '',
                  rejection_reason: discount.rejection_reason ?? '',
                }))
              : [createEmptyDiscountRow()],
          taxes_charged:
            risk.taxes_charged.length > 0
              ? risk.taxes_charged.map((tax) => ({
                  tax_code: tax.tax_code,
                  is_tax_exempted: toBooleanTaxFlag(tax.is_tax_exempted),
                  tax_exemption_type: tax.tax_exemption_type ?? '',
                  tax_exemption_reference: tax.tax_exemption_reference ?? '',
                  tax_rate: String(tax.tax_rate),
                  tax_amount: String(tax.tax_amount),
                }))
              : [createEmptyTaxRow()],
          rating_result_metadata: {
            pricing_quote_id: risk.pricing_quote_id ?? null,
          },
        })),
        subject_matters_covered: item.subject_matters_covered.map(
          (subject) => ({
            subject_matter_reference: subject.subject_matter_reference,
            subject_matter_desc: subject.subject_matter_desc,
          }),
        ),
        cover_note_addons: item.cover_note_addons.map((addon) => ({
          addon_reference: addon.addon_reference,
          addon_desc: addon.addon_desc,
          addon_amount: String(addon.addon_amount),
          addon_premium_rate: String(addon.addon_premium_rate),
          premium_excluding_tax: String(addon.premium_excluding_tax),
          premium_excluding_tax_equivalent: String(
            addon.premium_excluding_tax_equivalent,
          ),
          premium_including_tax: String(addon.premium_including_tax),
          taxes: addon.taxes_charged.map((tax) => ({
            tax_code: tax.tax_code,
            is_tax_exempted: toBooleanTaxFlag(tax.is_tax_exempted),
            tax_exemption_type: tax.tax_exemption_type ?? '',
            tax_exemption_reference: tax.tax_exemption_reference ?? '',
            tax_rate: String(tax.tax_rate),
            tax_amount: String(tax.tax_amount),
          })),
        })),
        motor_dtl: {
          motor_category: String(item.motor_dtl.motor_category),
          motor_type: String(item.motor_dtl.motor_type),
          registration_number: normalizeMotorTextInput(
            item.motor_dtl.registration_number,
          ),
          chassis_number: normalizeMotorTextInput(
            item.motor_dtl.chassis_number,
          ),
          make: normalizeMotorTextInput(item.motor_dtl.make),
          model: normalizeMotorTextInput(item.motor_dtl.model),
          model_number: normalizeMotorTextInput(item.motor_dtl.model_number),
          body_type: item.motor_dtl.body_type,
          color: item.motor_dtl.color,
          engine_number: normalizeMotorTextInput(item.motor_dtl.engine_number),
          engine_capacity: item.motor_dtl.engine_capacity,
          fuel_used: item.motor_dtl.fuel_used,
          number_of_axles: String(item.motor_dtl.number_of_axles),
          axle_distance: String(item.motor_dtl.axle_distance),
          sitting_capacity: String(item.motor_dtl.sitting_capacity),
          year_of_manufacture: String(item.motor_dtl.year_of_manufacture),
          tare_weight: String(item.motor_dtl.tare_weight),
          gross_weight: String(item.motor_dtl.gross_weight),
          motor_usage: String(item.motor_dtl.motor_usage),
          owner_name: item.motor_dtl.owner_name,
          owner_category: String(item.motor_dtl.owner_category),
          owner_address: item.motor_dtl.owner_address,
        },
      })),
    };
  }

  if (flow === 'NON_MOTOR') {
    common.nonMotor = {
      items: record.cover_note_dtl.subject_matters_covered?.map((subject) => ({
        subject_matter_reference: subject.subject_matter_reference,
        subject_matter_desc: subject.subject_matter_desc,
      })) ?? [createEmptyNonMotorItemRow()],
    };
  }

  common.risks = common.risks.map((risk) => ({
    ...risk,
    rating_result_metadata: {
      ...(risk.rating_result_metadata ?? {}),
      pricing_input_signature: buildSingleRiskPricingSignature({
        quotation_type: common.quotation_type,
        product_id: common.product_id,
        valid_from: common.valid_from,
        valid_until: common.valid_until,
        currency: common.currency,
        exchange_rate: common.exchange_rate,
        motor: common.motor,
        addons: common.addons,
        risk,
      }),
      pricing_is_stale: false,
      stale_reason: null,
    },
  }));

  common.fleet.items = common.fleet.items.map((item) => ({
    ...item,
    risks_covered: item.risks_covered.map((risk) => ({
      ...risk,
      rating_result_metadata: {
        ...(risk.rating_result_metadata ?? {}),
        pricing_input_signature: buildFleetRiskPricingSignature({
          quotation_type: common.quotation_type,
          product_id: common.product_id,
          valid_from: common.valid_from,
          valid_until: common.valid_until,
          currency: common.currency,
          exchange_rate: common.exchange_rate,
          fleet_header: common.fleet.header,
          item,
          risk,
        }),
        pricing_is_stale: false,
        stale_reason: null,
      },
    })),
  }));

  return common;
}
