import { z } from 'zod';
import {
  customerFormObjectSchema,
  customerFormSchema,
  getCustomerDefaultValues,
} from '../customers/schemas';
import { getCustomerFullName } from '../customers/types';
import type { CustomerRecord } from '../customers/types';
import type { MotorVehicleRecord } from '../motor/types';
import {
  getTaxRateForCode,
  isSupportedTaxCode,
} from './wizard/utils/taxOptions';
import type {
  FlatQuotationPayload,
  MotorCoverNoteQuotationPayload,
  QuotationFormValues,
  QuotationPayload,
  QuotationRiskFormRow,
  QuotationWizardAddonRow,
} from './types';

const optionalText = z.string().trim().optional().or(z.literal(''));

function createClientRef(prefix = 'risk') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyRiskDiscountRow(): QuotationRiskFormRow['discounts_offered'][number] {
  return {
    discount_type: '1',
    discount_rate: '',
    discount_amount: '',
  };
}

export function createEmptyRiskTaxRow(): QuotationRiskFormRow['taxes_charged'][number] {
  return {
    tax_code: '',
    is_tax_exempted: false,
    tax_exemption_type: '',
    tax_exemption_reference: '',
    tax_rate: '',
    tax_amount: '',
  };
}

const quotationRiskRowSchema = z.object({
  // Internal React/payload tracking id, not user input — auto-healed rather
  // than blocking the wizard if it's ever momentarily missing from form state.
  client_ref: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() ? value : createClientRef())),
  risk_id: z.string().min(1, 'Risk is required'),
  risk_code: optionalText,
  subject_matter_id: optionalText,
  motor_vehicle_id: optionalText,
  sum_insured: optionalText,
  // Keyed by factor_id — dynamic shape driven by the risk's required rating factors.
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
    }),
  ),
  taxes_charged: z.array(
    z.object({
      tax_code: optionalText,
      is_tax_exempted: z.boolean().optional().default(false),
      tax_exemption_type: optionalText,
      tax_exemption_reference: optionalText,
      tax_rate: optionalText,
      tax_amount: optionalText,
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
  // Last RiskPremiumResult returned by the rating engine for this row, kept for
  // display and forwarded into QuotationRisk.rating_result_metadata on save.
  rating_result_metadata: z.unknown().nullable(),
});

export function createEmptyRiskRow(): QuotationRiskFormRow {
  return {
    client_ref: createClientRef(),
    risk_id: '',
    risk_code: '',
    subject_matter_id: '',
    motor_vehicle_id: '',
    sum_insured: '',
    sum_insured_equivalent: '',
    premium_rate: '',
    premium_before_discount: '',
    premium_after_discount: '',
    premium_excluding_tax_equivalent: '',
    premium_including_tax: '',
    discounts_offered: [createEmptyRiskDiscountRow()],
    taxes_charged: [createEmptyRiskTaxRow()],
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
  is_tax_exempted: z.boolean().optional().default(false),
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
  motor_category_code: z.enum(['1', '2']).optional().or(z.literal('')),
  motor_type_code: z.enum(['1', '2']).optional().or(z.literal('')),
  registration_no: z.string().trim().max(50).optional().or(z.literal('')),
  chassis_no: z.string().trim().max(50).optional().or(z.literal('')),
  engine_no: z.string().trim().max(50).optional().or(z.literal('')),
  make: z.string().trim().max(100).optional().or(z.literal('')),
  model: z.string().trim().max(100).optional().or(z.literal('')),
  model_no: z.string().trim().max(100).optional().or(z.literal('')),
  body_type: z.string().trim().max(100).optional().or(z.literal('')),
  color: z.string().trim().max(50).optional().or(z.literal('')),
  manufacture_year: optionalText,
  usage_type: z.string().trim().max(100).optional().or(z.literal('')),
  motor_usage_code: z.enum(['1', '2']).optional().or(z.literal('')),
  vehicle_category: z.string().trim().max(100).optional().or(z.literal('')),
  seating_capacity: optionalText,
  tonnage: optionalText,
  cubic_capacity: optionalText,
  fuel_type: z.string().trim().max(50).optional().or(z.literal('')),
  number_of_axles: optionalText,
  axle_distance: optionalText,
  tare_weight: optionalText,
  gross_weight: optionalText,
  owner_name: z.string().trim().max(150).optional().or(z.literal('')),
  owner_category: z.enum(['1', '2']).optional().or(z.literal('')),
  owner_address: z.string().trim().max(255).optional().or(z.literal('')),
  vehicle_value: optionalText,
});

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

const quotationFleetHeaderSchema = z.object({
  fleet_id: optionalText,
  fleet_size: optionalText,
  fleet_type: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .pipe(z.enum(['1', '2'])),
  comprehensive_insured: optionalText,
  sale_point_code: optionalText,
  product_code: optionalText,
  cover_note_type: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .pipe(z.enum(['1', '2', '3'])),
  cover_note_start_date: z.string().trim().optional().or(z.literal('')),
  cover_note_end_date: z.string().trim().optional().or(z.literal('')),
  payment_mode: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .pipe(z.enum(['1', '2', '3'])),
  currency_code: z.string().trim().optional().or(z.literal('')),
  exchange_rate: z.string().trim().optional().or(z.literal('')),
  commision_paid: z.string().trim().optional().or(z.literal('')),
  commision_rate: z.string().trim().optional().or(z.literal('')),
  officer_name: optionalText,
  officer_title: optionalText,
  policy_holders: z.array(
    z.object({
      policy_holder_name: optionalText,
      policy_holder_birth_date: z.string().trim().optional().or(z.literal('')),
      policy_holder_type: z.string().trim().optional().or(z.literal('')),
      policy_holder_id_number: optionalText,
      policy_holder_id_type: z.string().trim().optional().or(z.literal('')),
      gender: optionalText,
      country_code: optionalText,
      region: optionalText,
      district: optionalText,
      street: optionalText,
      policy_holder_phone_number: optionalText,
      policy_holder_fax: optionalText,
      postal_address: optionalText,
      email_address: optionalText,
    }),
  ),
});

const quotationFleetItemRowSchema = z.object({
  fleet_entry: optionalText,
  cover_note_number: optionalText,
  prev_cover_note_reference_number: optionalText,
  cover_note_desc: optionalText,
  operative_clause: optionalText,
  endorsement_type: z.enum(['1', '2', '3', '4']).optional().or(z.literal('')),
  endorsement_reason: optionalText,
  endorsement_premium_earned: optionalText,
  risks_covered: z
    .array(
      z.object({
        risk_code: z.string().trim().min(1, 'Risk is required'),
        sum_insured: z.string().trim().min(1, 'Sum insured is required'),
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
          }),
        ),
        taxes_charged: z.array(
          z.object({
            tax_code: optionalText,
            is_tax_exempted: z.boolean().optional().default(false),
            tax_exemption_type: optionalText,
            tax_exemption_reference: optionalText,
            tax_rate: optionalText,
            tax_amount: optionalText,
          }),
        ),
      }),
    )
    .min(1, 'At least one risk is required'),
  subject_matters_covered: z
    .array(
      z.object({
        subject_matter_reference: optionalText,
        subject_matter_desc: optionalText,
      }),
    )
    .min(1),
  cover_note_addons: z.array(
    z.object({
      addon_reference: optionalText,
      addon_desc: optionalText,
      addon_amount: optionalText,
      addon_premium_rate: optionalText,
      premium_excluding_tax: optionalText,
      premium_excluding_tax_equivalent: optionalText,
      premium_including_tax: optionalText,
      taxes: z.array(
        z.object({
          tax_code: optionalText,
          is_tax_exempted: z.boolean().optional().default(false),
          tax_exemption_type: optionalText,
          tax_exemption_reference: optionalText,
          tax_rate: optionalText,
          tax_amount: optionalText,
        }),
      ),
    }),
  ),
  motor_dtl: z.object({
    motor_category: z.enum(['1', '2']).optional().or(z.literal('')),
    motor_type: z.enum(['1', '2']).optional().or(z.literal('')),
    registration_number: z.string().trim().max(50).optional().or(z.literal('')),
    chassis_number: z.string().trim().max(50).optional().or(z.literal('')),
    make: z.string().trim().max(100).optional().or(z.literal('')),
    model: z.string().trim().max(100).optional().or(z.literal('')),
    model_number: z.string().trim().max(100).optional().or(z.literal('')),
    body_type: z.string().trim().max(100).optional().or(z.literal('')),
    color: z.string().trim().max(50).optional().or(z.literal('')),
    engine_number: z.string().trim().max(50).optional().or(z.literal('')),
    engine_capacity: optionalText,
    fuel_used: z.string().trim().max(50).optional().or(z.literal('')),
    number_of_axles: optionalText,
    axle_distance: optionalText,
    sitting_capacity: optionalText,
    year_of_manufacture: optionalText,
    tare_weight: optionalText,
    gross_weight: optionalText,
    motor_usage: z.enum(['1', '2']).optional().or(z.literal('')),
    owner_name: z.string().trim().max(150).optional().or(z.literal('')),
    owner_category: z.enum(['1', '2']).optional().or(z.literal('')),
    owner_address: z.string().trim().max(255).optional().or(z.literal('')),
  }),
});

export function createEmptyFleetItemRow(): QuotationFormValues['fleet']['items'][number] {
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
    cover_note_desc: '',
    operative_clause: '',
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

function createEmptyFleetRiskRow(): QuotationFormValues['fleet']['items'][number]['risks_covered'][number] {
  return {
    risk_code: '',
    sum_insured: '',
    sum_insured_equivalent: '',
    premium_rate: '',
    premium_before_discount: '',
    premium_after_discount: '',
    premium_excluding_tax_equivalent: '',
    premium_including_tax: '',
    discounts_offered: [createEmptyRiskDiscountRow()],
    taxes_charged: [createEmptyRiskTaxRow()],
  };
}

function createEmptyFleetAddonRow(): QuotationFormValues['fleet']['items'][number]['cover_note_addons'][number] {
  return {
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

export function createEmptyFleetDetails(): QuotationFormValues['fleet'] {
  return {
    header: {
      fleet_id: '',
      fleet_no: '',
      fleet_name: '',
      fleet_size: '',
      fleet_type: '1',
      comprehensive_insured: '',
      sale_point_code: '',
      product_code: '',
      cover_note_type: '1',
      cover_note_start_date: '',
      cover_note_end_date: '',
      payment_mode: '1',
      currency_code: '',
      exchange_rate: '',
      commision_paid: '',
      commision_rate: '',
      officer_name: '',
      officer_title: '',
      policy_holders: [
        {
          policy_holder_name: '',
          policy_holder_birth_date: '',
          policy_holder_type: '',
          policy_holder_id_number: '',
          policy_holder_id_type: '',
          gender: '',
          country_code: '',
          region: '',
          district: '',
          street: '',
          policy_holder_phone_number: '',
          policy_holder_fax: '',
          postal_address: '',
          email_address: '',
        },
      ],
    },
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
  subject_matter_reference: z.string().trim().max(100).optional().or(z.literal('')),
  subject_matter_desc: optionalText,
});

export function createEmptyNonMotorItemRow(): QuotationFormValues['nonMotor']['items'][number] {
  return {
    subject_matter_id: '',
    detail_id: '',
    subject_matter_reference: '',
    subject_matter_desc: '',
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
  risks: z.array(quotationRiskRowSchema),
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
  quotation_flow: z.enum(['NON_MOTOR', 'MOTOR_SINGLE', 'MOTOR_FLEET']),
  quotation_type: z.enum(['MOTOR', 'NON_MOTOR']),
  is_fleet: z.boolean(),
  channel_type: z.enum(['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API']),
  status: z.enum([
    'DRAFT',
    'RATED',
    'REFERRED',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'CONVERTED',
    'EXPIRED',
    'CANCELLED',
  ]),
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
  endorsement_type: z.enum(['1', '2', '3', '4']).or(z.literal('')).optional(),
  endorsement_reason: optionalText,
  endorsement_premium_earned: z.string().trim().optional().or(z.literal('')),
  officer_name: optionalText,
  officer_title: optionalText,
  payment_mode_tira: z.enum(['1', '2', '3']),
});

export const quotationFormSchema = quotationFormObjectSchema.superRefine(
  (values, ctx) => {
    const quotationFlow = values.quotation_flow;

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

    const today = new Date().toISOString().slice(0, 10);
    if (values.valid_from && values.valid_from < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valid_from'],
        message: 'Cover start date cannot be in the past',
      });
    }

    if (
      values.valid_from &&
      values.valid_until &&
      values.valid_until <= values.valid_from
    ) {
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

    if (
      values.channel_type !== 'DIRECT' &&
      !values.intermediary_company_id?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['intermediary_company_id'],
        message: 'Intermediary company is required for non-direct channels',
      });
    }

    if (quotationFlow !== 'MOTOR_FLEET' && values.risks.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['risks'],
        message: 'At least one risk is required',
      });
    }

    if (quotationFlow !== 'MOTOR_FLEET') {
      values.risks.forEach((row, index) => {
        const sumInsured = Number(row.sum_insured);
        if (!row.sum_insured?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['risks', index, 'sum_insured'],
            message: 'Sum insured is required',
          });
        } else if (!Number.isFinite(sumInsured) || sumInsured < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['risks', index, 'sum_insured'],
            message: 'Sum insured must be zero or a positive number',
          });
        }

        row.discounts_offered.forEach((discount, discountIndex) => {
          if (!discount.discount_type?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [
                'risks',
                index,
                'discounts_offered',
                discountIndex,
                'discount_type',
              ],
              message: 'Discount type is required',
            });
            return;
          }

          if (discount.discount_type !== '1') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [
                'risks',
                index,
                'discounts_offered',
                discountIndex,
                'discount_type',
              ],
              message: 'Only Fleet discount is currently supported',
            });
          }
        });

        row.taxes_charged.forEach((tax, taxIndex) => {
          if (!tax.tax_code?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['risks', index, 'taxes_charged', taxIndex, 'tax_code'],
              message: 'Tax code is required',
            });
            return;
          }

          if (!isSupportedTaxCode(tax.tax_code)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['risks', index, 'taxes_charged', taxIndex, 'tax_code'],
              message: 'Select a supported tax code',
            });
            return;
          }

          const expectedRate = getTaxRateForCode(tax.tax_code);
          if (tax.tax_rate !== expectedRate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['risks', index, 'taxes_charged', taxIndex, 'tax_rate'],
              message: `Tax rate must be ${expectedRate} for ${tax.tax_code}`,
            });
          }
        });
      });
    }

    if (
      values.cover_note_type !== '1' &&
      !values.prev_cover_note_reference?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prev_cover_note_reference'],
        message:
          'Previous cover note reference is required for renewals and endorsements',
      });
    }

    if (values.cover_note_type === '3') {
      if (!values.endorsement_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endorsement_type'],
          message: 'Endorsement type is required for endorsements',
        });
      }
      if (!values.endorsement_reason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endorsement_reason'],
          message: 'Endorsement reason is required for endorsements',
        });
      }
      if (!values.endorsement_premium_earned?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endorsement_premium_earned'],
          message: 'Endorsement premium earned is required for endorsements',
        });
      }
    }

    values.addons.forEach((addon, index) => {
      // Disabled add-ons are dropped before the TIRA payload is built (Phase 13),
      // so there's nothing to validate for them here.
      if (!addon.enabled) return;

      if (!addon.addon_reference?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addons', index, 'addon_reference'],
          message: 'Add-on reference is required',
        });
      }
      if (!addon.addon_desc?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addons', index, 'addon_desc'],
          message: 'Add-on description is required',
        });
      }
      const amount = Number(addon.addon_amount);
      if (!addon.addon_amount || !Number.isFinite(amount) || amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addons', index, 'addon_amount'],
          message: 'Add-on amount must be a positive number',
        });
      }
      const excludingTax = Number(addon.premium_excluding_tax);
      if (
        !addon.premium_excluding_tax ||
        !Number.isFinite(excludingTax) ||
        excludingTax < 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addons', index, 'premium_excluding_tax'],
          message: 'Premium excluding tax must be a non-negative number',
        });
      }

      addon.taxes.forEach((tax, taxIndex) => {
        if (!tax.tax_code?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['addons', index, 'taxes', taxIndex, 'tax_code'],
            message: 'Tax code is required',
          });
          return;
        }
        if (!isSupportedTaxCode(tax.tax_code)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['addons', index, 'taxes', taxIndex, 'tax_code'],
            message: 'Select a supported tax code',
          });
          return;
        }

        const expectedRate = getTaxRateForCode(tax.tax_code);
        if (tax.tax_rate !== expectedRate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['addons', index, 'taxes', taxIndex, 'tax_rate'],
            message: `Tax rate must be ${expectedRate} for ${tax.tax_code}`,
          });
        }
        if (!tax.is_tax_exempted) {
          const rate = Number(tax.tax_rate);
          if (!tax.tax_rate || !Number.isFinite(rate) || rate < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['addons', index, 'taxes', taxIndex, 'tax_rate'],
              message: 'Tax rate is required unless the tax is exempted',
            });
          }
        }
      });
    });

    if (quotationFlow === 'MOTOR_SINGLE') {
      if (values.motor_mode === 'existing') {
        if (!values.motor.vehicle_id?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'vehicle_id'],
            message: 'Select an existing vehicle',
          });
        }
      } else {
        const currentYear = new Date().getFullYear();
        if (!values.motor.registration_no?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'registration_no'],
            message: 'Registration number is required',
          });
        }
        if (!values.motor.chassis_no?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'chassis_no'],
            message: 'Chassis number is required',
          });
        }
        if (!values.motor.motor_category_code?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'motor_category_code'],
            message: 'Motor category is required',
          });
        }
        if (!values.motor.motor_type_code?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'motor_type_code'],
            message: 'Motor type is required',
          });
        }
        if (!values.motor.make?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'make'],
            message: 'Make is required',
          });
        }
        if (!values.motor.model?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'model'],
            message: 'Model is required',
          });
        }
        if (!values.motor.usage_type?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'usage_type'],
            message: 'Vehicle usage is required',
          });
        }
        if (!values.motor.vehicle_category?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'vehicle_category'],
            message: 'Vehicle category is required',
          });
        }
        const year = Number(values.motor.manufacture_year);
        if (
          !values.motor.manufacture_year ||
          !Number.isInteger(year) ||
          year < 1900 ||
          year > currentYear
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'manufacture_year'],
            message: `Year of manufacture must be between 1900 and ${currentYear}`,
          });
        }
        const seating = values.motor.seating_capacity;
        if (
          seating &&
          (!Number.isInteger(Number(seating)) || Number(seating) < 0)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['motor', 'seating_capacity'],
            message: 'Seating capacity must be a whole number',
          });
        }
      }
    }

    if (quotationFlow === 'MOTOR_FLEET') {
      if (!values.fleet.header.fleet_id?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'fleet_id'],
          message: 'Fleet ID is required',
        });
      }
      if (!values.fleet.header.fleet_type?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'fleet_type'],
          message: 'Fleet type is required',
        });
      }
      if (!values.fleet.header.cover_note_type?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'cover_note_type'],
          message: 'Cover note type is required',
        });
      }
      if (!values.fleet.header.cover_note_start_date?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'cover_note_start_date'],
          message: 'Start date is required',
        });
      }
      if (!values.fleet.header.cover_note_end_date?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'cover_note_end_date'],
          message: 'End date is required',
        });
      }
      if (!values.fleet.header.payment_mode?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'payment_mode'],
          message: 'Payment mode is required',
        });
      }
      if (!values.fleet.header.currency_code?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'currency_code'],
          message: 'Currency is required',
        });
      }
      if (!values.fleet.header.exchange_rate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'exchange_rate'],
          message: 'Exchange rate is required',
        });
      } else if (Number(values.fleet.header.exchange_rate) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'exchange_rate'],
          message: 'Exchange rate must be greater than zero',
        });
      }
      if (!values.fleet.header.sale_point_code?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'sale_point_code'],
          message: 'Sale point code is required',
        });
      }
      if (!values.fleet.header.product_code?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'product_code'],
          message: 'Product code is required',
        });
      }
      if (!values.fleet.items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'items'],
          message: 'At least one fleet vehicle is required',
        });
      }
      if (values.fleet.header.fleet_size && Number(values.fleet.header.fleet_size) !== values.fleet.items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fleet', 'header', 'fleet_size'],
          message: 'Fleet size must equal the number of vehicles',
        });
      }

      const seenRegistrations = new Map<string, number>();
      const seenChassis = new Map<string, number>();
      const seenEngines = new Map<string, number>();

      values.fleet.items.forEach((item, index) => {
        const motor = item.motor_dtl;
        const registrationValue =
          normalizeText(motor.registration_number) ??
          normalizeText(item.registration_no) ??
          '';
        const chassisValue =
          normalizeText(motor.chassis_number) ??
          normalizeText(item.chassis_no) ??
          '';
        const makeValue = normalizeText(motor.make) ?? normalizeText(item.make) ?? '';
        const modelValue = normalizeText(motor.model) ?? normalizeText(item.model) ?? '';
        const engineValue =
          normalizeText(motor.engine_number) ??
          normalizeText(item.engine_no) ??
          '';
        if (!registrationValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleet', 'items', index, 'motor_dtl', 'registration_number'],
            message: 'Registration number is required',
          });
        }
        if (!chassisValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleet', 'items', index, 'motor_dtl', 'chassis_number'],
            message: 'Chassis number is required',
          });
        }
        if (!makeValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleet', 'items', index, 'motor_dtl', 'make'],
            message: 'Make is required',
          });
        }
        if (!modelValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleet', 'items', index, 'motor_dtl', 'model'],
            message: 'Model is required',
          });
        }
        const hasRiskRows =
          item.risks_covered.length > 0 ||
          Boolean(item.sum_insured && item.premium);
        if (!hasRiskRows) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleet', 'items', index, 'risks_covered'],
            message: 'At least one risk is required for each vehicle',
          });
        }
        if (!item.subject_matters_covered.length && !registrationValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fleet', 'items', index, 'subject_matters_covered'],
            message: 'At least one subject matter is required',
          });
        }
        const registration = registrationValue.toUpperCase();
        if (registration) {
          const firstIndex = seenRegistrations.get(registration);
          if (firstIndex !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fleet', 'items', index, 'motor_dtl', 'registration_number'],
              message: `Duplicate registration number (also used in row ${firstIndex + 1})`,
            });
          } else {
            seenRegistrations.set(registration, index);
          }
        }
        const chassis = chassisValue.toUpperCase();
        if (chassis) {
          const firstIndex = seenChassis.get(chassis);
          if (firstIndex !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fleet', 'items', index, 'motor_dtl', 'chassis_number'],
              message: `Duplicate chassis number (also used in row ${firstIndex + 1})`,
            });
          } else {
            seenChassis.set(chassis, index);
          }
        }
        const engine = engineValue.toUpperCase();
        if (engine) {
          const firstIndex = seenEngines.get(engine);
          if (firstIndex !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fleet', 'items', index, 'motor_dtl', 'engine_number'],
              message: `Duplicate engine number (also used in row ${firstIndex + 1})`,
            });
          } else {
            seenEngines.set(engine, index);
          }
        }
        const risks = item.risks_covered.length
          ? item.risks_covered
          : [
              {
                ...createEmptyRiskRow(),
                risk_code: '',
                sum_insured: item.sum_insured ?? '',
                sum_insured_equivalent: item.sum_insured ?? '',
                premium_rate: '',
                premium_before_discount: '',
                premium_after_discount: item.premium ?? '',
                premium_excluding_tax_equivalent: item.premium ?? '',
                premium_including_tax: item.premium ?? '',
              },
            ];
        risks.forEach((risk, riskIndex) => {
          const sumInsured = Number(risk.sum_insured);
          if (!risk.risk_code?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fleet', 'items', index, 'risks_covered', riskIndex, 'risk_code'],
              message: 'Risk code is required',
            });
          }
          if (!risk.sum_insured?.trim() || !Number.isFinite(sumInsured) || sumInsured <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fleet', 'items', index, 'risks_covered', riskIndex, 'sum_insured'],
              message: 'Sum insured must be greater than zero',
            });
          }
        });
      });
    }

    // Non-motor subject matters are generated automatically per risk row
    // (product code + timestamp / product name) rather than entered in the
    // wizard — see resolveNonMotor in QuotationWizardPage — so no validation
    // is needed here.
  },
);

export type QuotationFormSchemaValues = z.infer<
  typeof quotationFormObjectSchema
>;

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

function sumRiskRows(
  values: QuotationFormSchemaValues['risks'],
  field:
    | 'sum_insured'
    | 'basic_premium'
    | 'total_premium'
    | 'net_premium'
    | 'charges_amount'
    | 'commission_amount',
) {
  return values.reduce((total, row) => {
    const value = normalizeNumber(row[field]);
    return total + (value ?? 0);
  }, 0);
}

function sumRiskDiscounts(values: QuotationFormSchemaValues['risks']) {
  return values.reduce(
    (total, row) =>
      total +
      row.discounts_offered.reduce(
        (discountTotal, discount) =>
          discountTotal + (normalizeNumber(discount.discount_amount) ?? 0),
        0,
      ),
    0,
  );
}

function sumRiskTaxes(values: QuotationFormSchemaValues['risks']) {
  return values.reduce(
    (total, row) =>
      total +
      row.taxes_charged.reduce(
        (taxTotal, tax) => taxTotal + (normalizeNumber(tax.tax_amount) ?? 0),
        0,
      ),
    0,
  );
}

type MotorQuotationPayloadContext = {
  salePointCode?: string | null;
  productCode?: string | null;
  coverNoteDesc?: string | null;
  operativeClause?: string | null;
  existingCustomer?: CustomerRecord | null;
  existingVehicle?: MotorVehicleRecord | null;
};

function toMotorDateTime(value: string | null | undefined, endOfDay: boolean) {
  if (!value) return '';
  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function toMotorNumber(value: string | number | null | undefined) {
  return normalizeNumber(value) ?? 0;
}

function toMotorNullableNumber(value: string | number | null | undefined) {
  return normalizeNumber(value) ?? null;
}

function buildMotorPolicyHolder(
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
  const policyHolderName = isCorporate
    ? policyholder.company_name || policyholder.full_name || ''
    : policyholder.full_name ||
      [policyholder.first_name, policyholder.middle_name, policyholder.last_name]
        .filter(Boolean)
        .join(' ');

  return {
    policy_holder_name: policyHolderName,
    policy_holder_birth_date: policyholder.date_of_birth || null,
    policy_holder_type: isCorporate ? 2 : 1,
    policy_holder_id_number: policyholder.id_number || '',
    policy_holder_id_type: normalizeNumber(policyholder.id_type) ?? null,
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

function buildMotorVehicleDetails(
  values: QuotationFormSchemaValues,
  existingCustomer?: CustomerRecord | null,
  existingVehicle?: MotorVehicleRecord | null,
) {
  const motor = values.motor;

  if (values.motor_mode === 'existing' && existingVehicle) {
    return {
      motor_category: existingVehicle.motor_category ?? null,
      motor_type: existingVehicle.motor_type ?? null,
      registration_number: existingVehicle.registration_no || '',
      chassis_number: existingVehicle.chassis_no || '',
      make: existingVehicle.make || '',
      model: existingVehicle.model || '',
      model_number: existingVehicle.model_no || null,
      body_type: existingVehicle.body_type || '',
      color: existingVehicle.color || '',
      engine_number: existingVehicle.engine_no || '',
      engine_capacity:
        existingVehicle.cubic_capacity != null
          ? String(existingVehicle.cubic_capacity)
          : null,
      fuel_used: existingVehicle.fuel_type || null,
      number_of_axles: existingVehicle.number_of_axles ?? null,
      axle_distance: toMotorNullableNumber(existingVehicle.axle_distance),
      sitting_capacity: existingVehicle.seating_capacity ?? null,
      year_of_manufacture: existingVehicle.manufacture_year ?? null,
      tare_weight: toMotorNullableNumber(existingVehicle.tare_weight),
      gross_weight: toMotorNullableNumber(existingVehicle.gross_weight),
      motor_usage: existingVehicle.motor_usage ?? null,
      owner_name:
        existingVehicle.owner_name ||
        buildMotorPolicyHolder(values, existingCustomer).policy_holder_name,
      owner_category: existingVehicle.owner_category ?? null,
      owner_address: existingVehicle.owner_address || '',
    };
  }

  return {
    motor_category: toMotorNullableNumber(motor.motor_category_code),
    motor_type: toMotorNullableNumber(motor.motor_type_code),
    registration_number: motor.registration_no || '',
    chassis_number: motor.chassis_no || '',
    make: motor.make || '',
    model: motor.model || '',
    model_number: motor.model_no || null,
    body_type: motor.body_type || '',
    color: motor.color || '',
    engine_number: motor.engine_no || '',
    engine_capacity: motor.cubic_capacity || null,
    fuel_used: motor.fuel_type || null,
    number_of_axles: toMotorNullableNumber(motor.number_of_axles),
    axle_distance: toMotorNullableNumber(motor.axle_distance),
    sitting_capacity: toMotorNullableNumber(motor.seating_capacity),
    year_of_manufacture: toMotorNullableNumber(motor.manufacture_year),
    tare_weight: toMotorNullableNumber(motor.tare_weight),
    gross_weight: toMotorNullableNumber(motor.gross_weight),
    motor_usage: toMotorNullableNumber(motor.motor_usage_code),
    owner_name: motor.owner_name || '',
    owner_category: toMotorNullableNumber(motor.owner_category),
    owner_address: motor.owner_address || '',
  };
}

function buildMotorRisksCovered(values: QuotationFormSchemaValues) {
  return values.risks.map((row) => ({
    risk_code: row.risk_code || '',
    sum_insured: toMotorNumber(row.sum_insured),
    sum_insured_equivalent: toMotorNumber(row.sum_insured_equivalent),
    premium_rate: toMotorNumber(row.premium_rate ?? row.rate),
    premium_before_discount: toMotorNumber(row.premium_before_discount),
    premium_after_discount: toMotorNumber(row.premium_after_discount),
    premium_excluding_tax_equivalent: toMotorNumber(
      row.premium_excluding_tax_equivalent,
    ),
    premium_including_tax: toMotorNumber(
      row.premium_including_tax ?? row.total_premium,
    ),
    discounts_offered: row.discounts_offered
      .filter((discount) => discount.discount_type)
      .map((discount) => ({
        discount_type: toMotorNumber(discount.discount_type),
        discount_rate: toMotorNumber(discount.discount_rate),
        discount_amount: toMotorNumber(discount.discount_amount),
      })),
    taxes_charged: row.taxes_charged
      .filter((tax) => tax.tax_code)
      .map((tax) => ({
        tax_code: tax.tax_code || '',
        is_tax_exempted: (tax.is_tax_exempted ? 'Y' : 'N') as 'Y' | 'N',
        tax_exemption_type: tax.is_tax_exempted
          ? toMotorNullableNumber(tax.tax_exemption_type)
          : null,
        tax_exemption_reference: tax.is_tax_exempted
          ? tax.tax_exemption_reference || null
          : null,
        tax_rate: toMotorNumber(tax.tax_rate),
        tax_amount: toMotorNumber(
          tax.tax_amount ?? toMotorNumber(row.premium_excluding_tax_equivalent) * toMotorNumber(tax.tax_rate),
        ),
      })),
  }));
}

function buildMotorAddons(values: QuotationFormSchemaValues) {
  return values.addons
    .filter((addon) => addon.enabled)
      .map((addon) => ({
        addon_reference: addon.addon_reference || '',
        addon_desc: addon.addon_desc || '',
        addon_amount: toMotorNumber(addon.addon_amount),
        addon_premium_rate: toMotorNumber(addon.addon_premium_rate),
      premium_excluding_tax: toMotorNumber(addon.premium_excluding_tax),
      premium_excluding_tax_equivalent: toMotorNumber(
        addon.premium_excluding_tax,
      ),
      premium_including_tax:
        toMotorNumber(addon.premium_excluding_tax) +
        addon.taxes.reduce((sum, tax) => sum + toMotorNumber(tax.tax_rate), 0),
      taxes_charged: addon.taxes
        .filter((tax) => tax.tax_code)
        .map((tax) => ({
          tax_code: tax.tax_code || '',
          is_tax_exempted: (tax.is_tax_exempted ? 'Y' : 'N') as 'Y' | 'N',
          tax_exemption_type: tax.is_tax_exempted
            ? toMotorNullableNumber(tax.tax_exemption_type)
            : null,
          tax_exemption_reference: tax.is_tax_exempted
            ? tax.tax_exemption_reference || null
            : null,
          tax_rate: toMotorNumber(tax.tax_rate),
          tax_amount:
            toMotorNumber(addon.premium_excluding_tax) *
            toMotorNumber(tax.tax_rate),
        })),
    }));
}

function buildMotorSubjectMatters(
  values: QuotationFormSchemaValues,
  context?: MotorQuotationPayloadContext,
) {
  const existingVehicle = context?.existingVehicle;
  const subjectItems = values.nonMotor.items
    .filter(
      (item) =>
        item.subject_matter_reference || item.subject_matter_desc,
    )
    .map((item) => ({
      subject_matter_reference: item.subject_matter_reference || '',
      subject_matter_desc: item.subject_matter_desc || '',
    }));

  if (subjectItems.length > 0) return subjectItems;

  const reference =
    values.motor.registration_no ||
    existingVehicle?.registration_no ||
    values.motor.vehicle_id ||
    values.product_id ||
    'MOTOR';
  const description =
    values.motor.vehicle_category ||
    existingVehicle?.vehicle_category ||
    values.motor.body_type ||
    existingVehicle?.body_type ||
    'Motor vehicle';

  return [
    {
      subject_matter_reference: reference,
      subject_matter_desc: description,
    },
  ];
}

function buildFlatQuotationPayload(
  values: QuotationFormSchemaValues,
  customerId: string,
): FlatQuotationPayload {
  const isFleet = values.quotation_flow === 'MOTOR_FLEET';

  return {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id:
      normalizeText(values.intermediary_company_id) ?? null,
    branch_id: normalizeText(values.branch_id) ?? null,
    department_id: normalizeText(values.department_id) ?? null,
    customer_id: customerId,
    category_id: values.category_id,
    product_id: values.product_id,
    sub_class_id: normalizeText(values.sub_class_id) ?? null,
    quotation_type:
      values.quotation_flow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
    quotation_flow: values.quotation_flow,
    is_fleet: isFleet,
    channel_type: values.channel_type,
    status: values.status,
    currency: values.currency.trim().toUpperCase(),
    exchange_rate: normalizeNumber(values.exchange_rate) ?? 1,
    cover_note_type: values.cover_note_type,
    prev_cover_note_reference_number:
      normalizeText(values.prev_cover_note_reference) ?? null,
    endorsement_type: normalizeText(values.endorsement_type) ?? null,
    endorsement_reason: normalizeText(values.endorsement_reason) ?? null,
    endorsement_premium_earned:
      normalizeNumber(values.endorsement_premium_earned) ?? null,
    payment_mode_tira: values.payment_mode_tira,
    officer_name: normalizeText(values.officer_name) ?? null,
    officer_title: normalizeText(values.officer_title) ?? null,
    sum_insured:
      normalizeNumber(values.sum_insured) ??
      sumRiskRows(values.risks, 'sum_insured'),
    basic_premium:
      (normalizeNumber(values.basic_premium) ??
        sumRiskRows(values.risks, 'basic_premium')) ||
      sumRiskRows(values.risks, 'net_premium'),
    total_discount:
      normalizeNumber(values.total_discount) ?? sumRiskDiscounts(values.risks),
    total_tax: normalizeNumber(values.total_tax) ?? sumRiskTaxes(values.risks),
    total_charges: normalizeNumber(values.total_charges) ?? 0,
    total_commission: normalizeNumber(values.total_commission) ?? 0,
    total_premium:
      (normalizeNumber(values.total_premium) ??
        sumRiskRows(values.risks, 'total_premium')) ||
      sumRiskRows(values.risks, 'net_premium'),
    net_premium:
      (normalizeNumber(values.net_premium) ??
        sumRiskRows(values.risks, 'net_premium')) ||
      sumRiskRows(values.risks, 'total_premium'),
    valid_from: values.valid_from,
    valid_until: values.valid_until,
    rating_version: normalizeText(values.rating_version) ?? null,
    rating_metadata: {
      quotation_flow: values.quotation_flow,
    },
    rejection_reason: normalizeText(values.rejection_reason) ?? null,
    risks: values.risks.map((row) => {
      const discountsOffered = row.discounts_offered.map((discount) => ({
        discount_type: normalizeText(discount.discount_type) ?? '1',
        discount_rate: normalizeNumber(discount.discount_rate) ?? 0,
        discount_amount: normalizeNumber(discount.discount_amount) ?? 0,
      }));
      const taxesCharged = row.taxes_charged.map((tax) => ({
        tax_code: normalizeText(tax.tax_code) ?? '',
        is_tax_exempted: tax.is_tax_exempted,
        tax_exemption_type: normalizeText(tax.tax_exemption_type) ?? null,
        tax_exemption_reference:
          normalizeText(tax.tax_exemption_reference) ?? null,
        tax_rate: normalizeNumber(tax.tax_rate) ?? 0,
        tax_amount: normalizeNumber(tax.tax_amount) ?? 0,
      }));

      return {
        client_ref: row.client_ref,
        risk_id: row.risk_id,
        subject_matter_id: normalizeText(row.subject_matter_id) ?? null,
        motor_vehicle_id: normalizeText(row.motor_vehicle_id) ?? null,
        sum_insured: normalizeNumber(row.sum_insured) ?? 0,
        rate: normalizeNumber(row.premium_rate ?? row.rate) ?? 0,
        basic_premium:
          normalizeNumber(row.premium_after_discount ?? row.basic_premium) ?? 0,
        discount_amount:
          discountsOffered.reduce(
            (sum, discount) => sum + discount.discount_amount,
            0,
          ) ||
          normalizeNumber(row.discount_amount) ||
          0,
        tax_amount:
          taxesCharged.reduce((sum, tax) => sum + tax.tax_amount, 0) ||
          normalizeNumber(row.tax_amount) ||
          0,
        charges_amount: normalizeNumber(row.charges_amount) ?? 0,
        commission_amount: normalizeNumber(row.commission_amount) ?? 0,
        total_premium:
          normalizeNumber(row.premium_including_tax ?? row.total_premium) ?? 0,
        net_premium: normalizeNumber(row.net_premium) ?? 0,
        rating_result_metadata: {
          risk_code: normalizeText(row.risk_code) ?? '',
          sum_insured_equivalent:
            normalizeNumber(row.sum_insured_equivalent) ?? 0,
          premium_rate: normalizeNumber(row.premium_rate) ?? 0,
          premium_before_discount:
            normalizeNumber(row.premium_before_discount) ?? 0,
          premium_after_discount:
            normalizeNumber(row.premium_after_discount) ?? 0,
          premium_excluding_tax_equivalent:
            normalizeNumber(row.premium_excluding_tax_equivalent) ?? 0,
          premium_including_tax:
            normalizeNumber(row.premium_including_tax) ?? 0,
          discounts_offered: discountsOffered,
          taxes_charged: taxesCharged,
        },
      };
    }),
    addons: values.addons
      .filter((addon) => addon.enabled)
      .map((addon) => ({
        addon_reference: addon.addon_reference ?? '',
        addon_desc: addon.addon_desc ?? '',
        addon_amount: normalizeNumber(addon.addon_amount) ?? 0,
        addon_premium_rate: normalizeNumber(addon.addon_premium_rate) ?? 0,
        premium_excluding_tax:
          normalizeNumber(addon.premium_excluding_tax) ?? 0,
        premium_excluding_tax_equivalent:
          normalizeNumber(addon.premium_excluding_tax) ?? 0,
        premium_including_tax:
          (normalizeNumber(addon.premium_excluding_tax) ?? 0) +
          addon.taxes.reduce(
            (sum, tax) => sum + (normalizeNumber(tax.tax_rate) ?? 0),
            0,
          ),
        taxes: addon.taxes.map((tax) => ({
          tax_code: tax.tax_code ?? '',
          is_tax_exempted: tax.is_tax_exempted,
          tax_exemption_type: normalizeText(tax.tax_exemption_type) ?? null,
          tax_exemption_reference:
            normalizeText(tax.tax_exemption_reference) ?? null,
          tax_rate: normalizeNumber(tax.tax_rate) ?? 0,
          tax_amount: 0,
        })),
      })),
  };
}

function buildMotorCoverNotePayload(
  values: QuotationFormSchemaValues,
  customerId: string,
  context: MotorQuotationPayloadContext = {},
): MotorCoverNoteQuotationPayload {
  return {
    cover_note_payload: {
      internal_quotation: {
        insurer_company_id: values.insurer_company_id,
        intermediary_company_id:
          normalizeText(values.intermediary_company_id) ?? null,
        branch_id: normalizeText(values.branch_id) ?? null,
        department_id: normalizeText(values.department_id) ?? null,
        category_id: values.category_id,
        product_id: values.product_id,
        sub_class_id: normalizeText(values.sub_class_id) ?? null,
        quotation_type: 'MOTOR',
        quotation_flow: 'MOTOR_SINGLE',
        channel_type: values.channel_type,
        is_fleet: false,
      },
      cover_note_hdr: {
        cover_note_type: Number(values.cover_note_type),
      },
      cover_note_dtl: {
        sale_point_code: context.salePointCode ?? null,
        cover_note_start_date: toMotorDateTime(values.valid_from, false),
        cover_note_end_date: toMotorDateTime(values.valid_until, true),
        cover_note_desc: context.coverNoteDesc ?? 'Motor cover note',
        operative_clause:
          context.operativeClause ?? 'Motor Comprehensive Cover',
        endorsement_type: values.endorsement_type
          ? Number(values.endorsement_type)
          : null,
        endorsement_reason: normalizeText(values.endorsement_reason) ?? null,
        endorsement_premium_earned:
          normalizeNumber(values.endorsement_premium_earned) ?? null,
        payment_mode: toMotorNumber(values.payment_mode_tira),
        currency_code: values.currency.trim().toUpperCase(),
        exchange_rate: toMotorNumber(values.exchange_rate),
        total_premium_excluding_tax: toMotorNumber(values.basic_premium),
        total_premium_including_tax: toMotorNumber(values.total_premium),
        commision_paid: toMotorNumber(values.total_commission),
        commision_rate: 0,
        officer_name: normalizeText(values.officer_name) ?? null,
        officer_title: normalizeText(values.officer_title) ?? null,
        product_code:
          context.productCode ?? values.product_id,
        risks_covered: buildMotorRisksCovered(values),
        subject_matters_covered: buildMotorSubjectMatters(values, context),
        cover_note_addons: buildMotorAddons(values),
        policy_holders: [
          buildMotorPolicyHolder(values, context.existingCustomer),
        ],
        motor_dtl: buildMotorVehicleDetails(
          values,
          context.existingCustomer,
          context.existingVehicle,
        ),
      },
    },
  };
}

/**
 * `customerIdOverride` lets callers pass the freshly-created customer id when
 * `policyholder_mode === 'new'` without waiting on a form.setValue re-render —
 * the wizard resolves that id synchronously right before calling this function.
 */
export function buildQuotationPayload(
  values: QuotationFormSchemaValues,
  customerIdOverride?: string,
  context?: MotorQuotationPayloadContext,
): QuotationPayload {
  const customerId = customerIdOverride ?? values.customer_id;

  if (!customerId) {
    throw new Error('A policyholder is required before saving a quotation');
  }

  if (values.quotation_flow === 'MOTOR_SINGLE') {
    return buildMotorCoverNotePayload(values, customerId, context);
  }

  const isFleet = values.quotation_flow === 'MOTOR_FLEET';

  if (isFleet) {
    const fleetHeader = values.fleet.header;
    const selectedPolicyHolder = fleetHeader.policy_holders[0];
    const policyHolderName =
      normalizeText(selectedPolicyHolder.policy_holder_name) ??
      normalizeText(values.policyholder.full_name) ??
      normalizeText(values.policyholder.company_name) ??
      null;
    const policyHolderType =
      normalizeNumber(selectedPolicyHolder.policy_holder_type) ??
      (values.policyholder.customer_type === 'CORPORATE' ? 2 : 1);
    const fleetDetails = values.fleet.items.map((item, index) => {
      const motor = item.motor_dtl;
      const fallbackRisk = {
        ...createEmptyRiskRow(),
        risk_code: '',
        sum_insured: item.sum_insured ?? '',
        sum_insured_equivalent: item.sum_insured ?? '',
        premium_rate: '',
        premium_before_discount: '',
        premium_after_discount: item.premium ?? '',
        premium_excluding_tax_equivalent: item.premium ?? '',
        premium_including_tax: item.premium ?? '',
      };
      const risksCoveredSource =
        item.risks_covered.length > 0 &&
        item.risks_covered.some(
          (risk) =>
            risk.risk_code?.trim() ||
            risk.sum_insured?.trim() ||
            risk.premium_including_tax?.trim(),
        )
          ? item.risks_covered
          : [fallbackRisk];
      const risksCovered = risksCoveredSource.map((risk) => {
        const discounts = risk.discounts_offered.map((discount) => ({
          discount_type: normalizeNumber(discount.discount_type) ?? 0,
          discount_rate: normalizeNumber(discount.discount_rate) ?? 0,
          discount_amount: normalizeNumber(discount.discount_amount) ?? 0,
        }));
        const taxes = risk.taxes_charged.map((tax) => ({
          tax_code: normalizeText(tax.tax_code) ?? '',
          is_tax_exempted: tax.is_tax_exempted ? 'Y' : 'N',
          tax_exemption_type: tax.is_tax_exempted
            ? normalizeNumber(tax.tax_exemption_type) ?? null
            : null,
          tax_exemption_reference: tax.is_tax_exempted
            ? normalizeText(tax.tax_exemption_reference) ?? null
            : null,
          tax_rate: normalizeNumber(tax.tax_rate) ?? 0,
          tax_amount: normalizeNumber(tax.tax_amount) ?? 0,
        }));

        return {
          risk_code: normalizeText(risk.risk_code) ?? '',
          sum_insured: normalizeNumber(risk.sum_insured) ?? 0,
          sum_insured_equivalent:
            normalizeNumber(risk.sum_insured_equivalent) ??
            (normalizeNumber(risk.sum_insured) ?? 0) *
              (normalizeNumber(fleetHeader.exchange_rate) ?? 1),
          premium_rate: normalizeNumber(risk.premium_rate) ?? 0,
          premium_before_discount:
            normalizeNumber(risk.premium_before_discount) ??
            (normalizeNumber(risk.sum_insured) ?? 0) *
              (normalizeNumber(risk.premium_rate) ?? 0),
          premium_after_discount:
            normalizeNumber(risk.premium_after_discount) ?? 0,
          premium_excluding_tax_equivalent:
            normalizeNumber(risk.premium_excluding_tax_equivalent) ?? 0,
          premium_including_tax: normalizeNumber(risk.premium_including_tax) ?? 0,
          discounts_offered: discounts,
          taxes_charged: taxes,
        };
      });
      const subjectMatters = item.subject_matters_covered
        .filter((subjectMatter) => subjectMatter.subject_matter_reference || subjectMatter.subject_matter_desc)
        .map((subjectMatter) => ({
          subject_matter_reference:
            normalizeText(subjectMatter.subject_matter_reference) ?? '',
          subject_matter_desc:
            normalizeText(subjectMatter.subject_matter_desc) ?? '',
        }));
      const addons = item.cover_note_addons.map((addon) => ({
        addon_reference: normalizeText(addon.addon_reference) ?? '',
        addon_desc: normalizeText(addon.addon_desc) ?? '',
        addon_amount: normalizeNumber(addon.addon_amount) ?? 0,
        addon_premium_rate: normalizeNumber(addon.addon_premium_rate) ?? 0,
        premium_excluding_tax:
          normalizeNumber(addon.premium_excluding_tax) ?? 0,
        premium_excluding_tax_equivalent:
          normalizeNumber(addon.premium_excluding_tax_equivalent) ?? 0,
        premium_including_tax:
          normalizeNumber(addon.premium_including_tax) ?? 0,
        taxes_charged: addon.taxes.map((tax) => ({
          tax_code: normalizeText(tax.tax_code) ?? '',
          is_tax_exempted: tax.is_tax_exempted ? 'Y' : 'N',
          tax_exemption_type: tax.is_tax_exempted
            ? normalizeNumber(tax.tax_exemption_type) ?? null
            : null,
          tax_exemption_reference: tax.is_tax_exempted
            ? normalizeText(tax.tax_exemption_reference) ?? null
            : null,
          tax_rate: normalizeNumber(tax.tax_rate) ?? 0,
          tax_amount: normalizeNumber(tax.tax_amount) ?? 0,
        })),
      }));

      const registrationValue =
        normalizeText(motor.registration_number) ??
        normalizeText(item.registration_no) ??
        '';
      const chassisValue =
        normalizeText(motor.chassis_number) ??
        normalizeText(item.chassis_no) ??
        '';
      const makeValue =
        normalizeText(motor.make) ?? normalizeText(item.make) ?? '';
      const modelValue =
        normalizeText(motor.model) ?? normalizeText(item.model) ?? '';
      const engineValue =
        normalizeText(motor.engine_number) ??
        normalizeText(item.engine_no) ??
        '';

      return {
        fleet_entry: Number(item.fleet_entry) || index + 1,
        cover_note_number:
          normalizeText(item.cover_note_number) ??
          `${fleetHeader.fleet_id || 'FLEET'}-${String(index + 1).padStart(2, '0')}`,
        prev_cover_note_reference_number:
          normalizeText(item.prev_cover_note_reference_number) ?? null,
        cover_note_desc:
          normalizeText(item.cover_note_desc) ??
          `Fleet vehicle ${motor.registration_number || index + 1}`,
        operative_clause:
          normalizeText(item.operative_clause) ?? 'Motor Comprehensive Cover',
        endorsement_type: normalizeText(item.endorsement_type) ?? null,
        endorsement_reason: normalizeText(item.endorsement_reason) ?? null,
        endorsement_premium_earned:
          normalizeNumber(item.endorsement_premium_earned) ?? null,
        risks_covered: risksCovered,
        subject_matters_covered: subjectMatters.length
          ? subjectMatters
          : [
              {
                subject_matter_reference: registrationValue,
                subject_matter_desc:
                  makeValue ||
                  modelValue ||
                  'Motor vehicle',
              },
            ],
        cover_note_addons: addons,
        motor_dtl: {
          motor_category: normalizeNumber(motor.motor_category) ?? null,
          motor_type: normalizeNumber(motor.motor_type) ?? null,
          registration_number: registrationValue,
          chassis_number: chassisValue,
          make: makeValue,
          model: modelValue,
          model_number: normalizeText(motor.model_number) ?? null,
          body_type: normalizeText(motor.body_type) ?? '',
          color: normalizeText(motor.color) ?? '',
          engine_number: engineValue,
          engine_capacity: normalizeText(motor.engine_capacity) ?? null,
          fuel_used: normalizeText(motor.fuel_used) ?? null,
          number_of_axles: normalizeNumber(motor.number_of_axles) ?? null,
          axle_distance: normalizeNumber(motor.axle_distance) ?? null,
          sitting_capacity: normalizeNumber(motor.sitting_capacity) ?? null,
          year_of_manufacture:
            normalizeNumber(motor.year_of_manufacture) ?? null,
          tare_weight: normalizeNumber(motor.tare_weight) ?? null,
          gross_weight: normalizeNumber(motor.gross_weight) ?? null,
          motor_usage: normalizeNumber(motor.motor_usage) ?? null,
          owner_name: normalizeText(motor.owner_name) ?? '',
          owner_category: normalizeNumber(motor.owner_category) ?? null,
          owner_address: normalizeText(motor.owner_address) ?? '',
        },
      };
    });

    const totalPremiumExcludingTax = fleetDetails.reduce(
      (sum, item) =>
        sum +
        item.risks_covered.reduce(
          (riskSum, risk) => riskSum + risk.premium_excluding_tax_equivalent,
          0,
        ),
      0,
    );
    const totalPremiumIncludingTax = fleetDetails.reduce(
      (sum, item) =>
        sum +
        item.risks_covered.reduce(
          (riskSum, risk) => riskSum + risk.premium_including_tax,
          0,
        ),
      0,
    );

    return {
      internal_quotation: {
        insurer_company_id: values.insurer_company_id,
        intermediary_company_id:
          normalizeText(values.intermediary_company_id) ?? null,
        branch_id: normalizeText(values.branch_id) ?? null,
        department_id: normalizeText(values.department_id) ?? null,
        category_id: values.category_id,
        product_id: values.product_id,
        sub_class_id: normalizeText(values.sub_class_id) ?? null,
        quotation_type: 'MOTOR',
        quotation_flow: 'MOTOR_FLEET',
        channel_type: values.channel_type,
        is_fleet: true,
      },
      cover_note_hdr: {
        cover_note_type: normalizeNumber(fleetHeader.cover_note_type) ?? 1,
      },
      cover_note_dtl: {
        fleet_hdr: {
          fleet_id: normalizeText(fleetHeader.fleet_id) ?? '',
          fleet_type: normalizeNumber(fleetHeader.fleet_type) ?? 1,
          fleet_size: fleetDetails.length,
          comprehensive_insured:
            normalizeNumber(fleetHeader.comprehensive_insured) ??
            fleetDetails.filter((item) =>
              item.risks_covered.some(
                (risk) => Number(risk.sum_insured) > 0,
              ),
            ).length,
          sale_point_code:
            normalizeText(fleetHeader.sale_point_code) ?? null,
          cover_note_start_date:
            normalizeText(fleetHeader.cover_note_start_date) ?? null,
          cover_note_end_date:
            normalizeText(fleetHeader.cover_note_end_date) ?? null,
          payment_mode: normalizeNumber(fleetHeader.payment_mode) ?? 1,
          currency_code:
            normalizeText(fleetHeader.currency_code)?.toUpperCase() ?? '',
          exchange_rate: normalizeNumber(fleetHeader.exchange_rate) ?? 1,
          total_premium_excluding_tax: totalPremiumExcludingTax,
          total_premium_including_tax: totalPremiumIncludingTax,
          commision_paid: normalizeNumber(fleetHeader.commision_paid) ?? 0,
          commision_rate: normalizeNumber(fleetHeader.commision_rate) ?? 0,
          officer_name: normalizeText(fleetHeader.officer_name) ?? null,
          officer_title: normalizeText(fleetHeader.officer_title) ?? null,
          product_code:
            normalizeText(fleetHeader.product_code) ??
            normalizeText(values.product_id) ??
            '',
          policy_holders: [
            {
              policy_holder_name: policyHolderName ?? '',
              policy_holder_birth_date:
                normalizeText(selectedPolicyHolder.policy_holder_birth_date) ??
                null,
              policy_holder_type: policyHolderType,
              policy_holder_id_number:
                normalizeText(selectedPolicyHolder.policy_holder_id_number) ??
                '',
              policy_holder_id_type:
                normalizeNumber(selectedPolicyHolder.policy_holder_id_type) ??
                null,
              gender:
                normalizeText(selectedPolicyHolder.gender) ??
                null,
              country_code:
                normalizeText(selectedPolicyHolder.country_code) ?? '',
              region: normalizeText(selectedPolicyHolder.region) ?? '',
              district: normalizeText(selectedPolicyHolder.district) ?? '',
              street: normalizeText(selectedPolicyHolder.street) ?? null,
              policy_holder_phone_number:
                normalizeText(
                  selectedPolicyHolder.policy_holder_phone_number,
                ) ?? '',
              policy_holder_fax:
                normalizeText(selectedPolicyHolder.policy_holder_fax) ?? null,
              postal_address:
                normalizeText(selectedPolicyHolder.postal_address) ?? null,
              email_address:
                normalizeText(selectedPolicyHolder.email_address) ?? null,
            },
          ],
        },
        fleet_dtls: fleetDetails,
      },
    };
  }

  return {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id:
      normalizeText(values.intermediary_company_id) ?? null,
    branch_id: normalizeText(values.branch_id) ?? null,
    department_id: normalizeText(values.department_id) ?? null,
    customer_id: customerId,
    category_id: values.category_id,
    product_id: values.product_id,
    sub_class_id: normalizeText(values.sub_class_id) ?? null,

    quotation_type:
      values.quotation_flow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
    quotation_flow: values.quotation_flow,
    is_fleet: isFleet,

    channel_type: values.channel_type,
    status: values.status,
    currency: values.currency.trim().toUpperCase(),
    exchange_rate: normalizeNumber(values.exchange_rate) ?? 1,
    cover_note_type: values.cover_note_type,
    prev_cover_note_reference_number:
      normalizeText(values.prev_cover_note_reference) ?? null,
    endorsement_type: normalizeText(values.endorsement_type) ?? null,
    endorsement_reason: normalizeText(values.endorsement_reason) ?? null,
    endorsement_premium_earned:
      normalizeNumber(values.endorsement_premium_earned) ?? null,
    payment_mode_tira: values.payment_mode_tira,
    officer_name: normalizeText(values.officer_name) ?? null,
    officer_title: normalizeText(values.officer_title) ?? null,
    sum_insured:
      normalizeNumber(values.sum_insured) ??
      sumRiskRows(values.risks, 'sum_insured'),
    basic_premium:
      (normalizeNumber(values.basic_premium) ??
        sumRiskRows(values.risks, 'basic_premium')) ||
      sumRiskRows(values.risks, 'net_premium'),
    total_discount:
      normalizeNumber(values.total_discount) ?? sumRiskDiscounts(values.risks),
    total_tax: normalizeNumber(values.total_tax) ?? sumRiskTaxes(values.risks),
    total_charges: normalizeNumber(values.total_charges) ?? 0,
    total_commission: normalizeNumber(values.total_commission) ?? 0,
    total_premium:
      (normalizeNumber(values.total_premium) ??
        sumRiskRows(values.risks, 'total_premium')) ||
      sumRiskRows(values.risks, 'net_premium'),
    net_premium:
      (normalizeNumber(values.net_premium) ??
        sumRiskRows(values.risks, 'net_premium')) ||
      sumRiskRows(values.risks, 'total_premium'),
    valid_from: values.valid_from,
    valid_until: values.valid_until,
    rating_version: normalizeText(values.rating_version) ?? null,
    rating_metadata: {
      quotation_flow: values.quotation_flow,
    },
    rejection_reason: normalizeText(values.rejection_reason) ?? null,
    risks: values.risks.map((row) => {
      const discountsOffered = row.discounts_offered.map((discount) => ({
        discount_type: normalizeText(discount.discount_type) ?? '1',
        discount_rate: normalizeNumber(discount.discount_rate) ?? 0,
        discount_amount: normalizeNumber(discount.discount_amount) ?? 0,
      }));
      const taxesCharged = row.taxes_charged.map((tax) => ({
        tax_code: normalizeText(tax.tax_code) ?? '',
        is_tax_exempted: tax.is_tax_exempted,
        tax_exemption_type: normalizeText(tax.tax_exemption_type) ?? null,
        tax_exemption_reference:
          normalizeText(tax.tax_exemption_reference) ?? null,
        tax_rate: normalizeNumber(tax.tax_rate) ?? 0,
        tax_amount: normalizeNumber(tax.tax_amount) ?? 0,
      }));

      return {
        client_ref: row.client_ref,
        risk_id: row.risk_id,
        subject_matter_id: normalizeText(row.subject_matter_id) ?? null,
        motor_vehicle_id: normalizeText(row.motor_vehicle_id) ?? null,
        sum_insured: normalizeNumber(row.sum_insured) ?? 0,
        rate: normalizeNumber(row.premium_rate ?? row.rate) ?? 0,
        basic_premium:
          normalizeNumber(row.premium_after_discount ?? row.basic_premium) ?? 0,
        discount_amount:
          discountsOffered.reduce(
            (sum, discount) => sum + discount.discount_amount,
            0,
          ) ||
          normalizeNumber(row.discount_amount) ||
          0,
        tax_amount:
          taxesCharged.reduce((sum, tax) => sum + tax.tax_amount, 0) ||
          normalizeNumber(row.tax_amount) ||
          0,
        charges_amount: normalizeNumber(row.charges_amount) ?? 0,
        commission_amount: normalizeNumber(row.commission_amount) ?? 0,
        total_premium:
          normalizeNumber(row.premium_including_tax ?? row.total_premium) ?? 0,
        net_premium: normalizeNumber(row.net_premium) ?? 0,
        rating_result_metadata: {
          risk_code: normalizeText(row.risk_code) ?? '',
          sum_insured_equivalent:
            normalizeNumber(row.sum_insured_equivalent) ?? 0,
          premium_rate: normalizeNumber(row.premium_rate) ?? 0,
          premium_before_discount:
            normalizeNumber(row.premium_before_discount) ?? 0,
          premium_after_discount:
            normalizeNumber(row.premium_after_discount) ?? 0,
          premium_excluding_tax_equivalent:
            normalizeNumber(row.premium_excluding_tax_equivalent) ?? 0,
          premium_including_tax:
            normalizeNumber(row.premium_including_tax) ?? 0,
          discounts_offered: discountsOffered,
          taxes_charged: taxesCharged,
        },
      };
    }),
    addons: values.addons
      .filter((addon) => addon.enabled)
      .map((addon) => ({
        addon_reference: addon.addon_reference ?? '',
        addon_desc: addon.addon_desc ?? '',
        addon_amount: normalizeNumber(addon.addon_amount) ?? 0,
        addon_premium_rate: normalizeNumber(addon.addon_premium_rate) ?? 0,
        premium_excluding_tax:
          normalizeNumber(addon.premium_excluding_tax) ?? 0,
        premium_excluding_tax_equivalent:
          normalizeNumber(addon.premium_excluding_tax) ?? 0,
        premium_including_tax:
          (normalizeNumber(addon.premium_excluding_tax) ?? 0) +
          addon.taxes.reduce(
            (sum, tax) => sum + (normalizeNumber(tax.tax_rate) ?? 0),
            0,
          ),
        taxes: addon.taxes.map((tax) => ({
          tax_code: tax.tax_code ?? '',
          is_tax_exempted: tax.is_tax_exempted,
          tax_exemption_type: normalizeText(tax.tax_exemption_type) ?? null,
          tax_exemption_reference:
            normalizeText(tax.tax_exemption_reference) ?? null,
          tax_rate: normalizeNumber(tax.tax_rate) ?? 0,
          tax_amount: 0,
        })),
      })),
  };
}

export function quotationRecordToFormValues(
  record: any,
): Partial<QuotationFormValues> {
  const quotationFlow =
    record.quotation_flow ??
    (record.quotation_type === 'MOTOR'
      ? record.is_fleet || record.rating_metadata?.is_fleet
        ? 'MOTOR_FLEET'
        : 'MOTOR_SINGLE'
      : 'NON_MOTOR');

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
    quotation_flow: quotationFlow,
    quotation_type: quotationFlow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
    is_fleet: quotationFlow === 'MOTOR_FLEET',
    channel_type:
      (record.channel_type as QuotationFormValues['channel_type']) ?? 'DIRECT',
    status: (record.status as QuotationFormValues['status']) ?? 'DRAFT',
    currency: record.currency ?? 'TZS',
    exchange_rate: record.exchange_rate ?? '1',
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
    cover_note_type: String(record.cover_note_type ?? '1') as
      | '1'
      | '2'
      | '3',
    prev_cover_note_reference: record.prev_cover_note_reference_number ?? '',
    endorsement_type: record.endorsement_type ?? '',
    endorsement_reason: record.endorsement_reason ?? '',
    endorsement_premium_earned:
      record.endorsement_premium_earned != null
        ? String(record.endorsement_premium_earned)
        : '',
    officer_name: record.officer_name ?? '',
    officer_title: record.officer_title ?? '',
    payment_mode_tira: String(record.payment_mode_tira ?? '1') as
      | '1'
      | '2'
      | '3',
    sale_point_id: '',
    addons: (record.addons ?? []).map((addon: Record<string, unknown>) => ({
      enabled: Boolean(addon.is_active ?? true),
      addon_reference: String(addon.addon_reference ?? ''),
      addon_desc: String(addon.addon_desc ?? ''),
      addon_amount:
        addon.addon_amount != null ? String(addon.addon_amount) : '',
      addon_premium_rate:
        addon.addon_premium_rate != null
          ? String(addon.addon_premium_rate)
          : '',
      premium_excluding_tax:
        addon.premium_excluding_tax != null
          ? String(addon.premium_excluding_tax)
          : '',
      taxes: ((addon.taxes ?? []) as Record<string, unknown>[]).map((tax) => ({
        tax_code: String(tax.tax_code ?? ''),
        is_tax_exempted:
          tax.is_tax_exempted === true || tax.is_tax_exempted === 'Y',
        tax_exemption_type: String(tax.tax_exemption_type ?? ''),
        tax_exemption_reference: String(tax.tax_exemption_reference ?? ''),
        tax_rate: tax.tax_rate != null ? String(tax.tax_rate) : '',
      })),
    })),
    motor_mode: 'existing',
    motor: {
      ...createEmptyMotorDetails(),
      vehicle_id: String(record.risks?.[0]?.motor_vehicle_id ?? ''),
    },
    fleet: createEmptyFleetDetails(),
    nonMotor: createEmptyNonMotorDetails(),
    risks: (record.risks?.length ? record.risks : []).map(
      (risk: Record<string, unknown>) => {
        const riskRecord = risk as Record<string, any>;
        const metadata = (riskRecord.rating_result_metadata ?? null) as Record<
          string,
          unknown
        > | null;
        const discountsOffered = (metadata?.discounts_offered ?? []) as Record<
          string,
          unknown
        >[];
        const taxesCharged = (metadata?.taxes_charged ?? []) as Record<
          string,
          unknown
        >[];

        return {
          client_ref:
            riskRecord.client_ref != null
              ? String(riskRecord.client_ref)
              : createClientRef(),
          risk_id: String(riskRecord.risk_id ?? ''),
          risk_code: String(
            metadata?.risk_code ?? riskRecord.risk?.risk_code ?? '',
          ),
          subject_matter_id: riskRecord.subject_matter_id
            ? String(riskRecord.subject_matter_id)
            : '',
          motor_vehicle_id: riskRecord.motor_vehicle_id
            ? String(riskRecord.motor_vehicle_id)
            : '',
          sum_insured:
            riskRecord.sum_insured != null
              ? String(riskRecord.sum_insured)
              : '',
          sum_insured_equivalent:
            metadata?.sum_insured_equivalent != null
              ? String(metadata.sum_insured_equivalent)
              : riskRecord.sum_insured != null
                ? String(riskRecord.sum_insured)
                : '',
          premium_rate:
            metadata?.premium_rate != null
              ? String(metadata.premium_rate)
              : riskRecord.rate != null
                ? String(riskRecord.rate)
                : '',
          premium_before_discount:
            metadata?.premium_before_discount != null
              ? String(metadata.premium_before_discount)
              : '',
          premium_after_discount:
            metadata?.premium_after_discount != null
              ? String(metadata.premium_after_discount)
              : riskRecord.basic_premium != null
                ? String(riskRecord.basic_premium)
                : '',
          premium_excluding_tax_equivalent:
            metadata?.premium_excluding_tax_equivalent != null
              ? String(metadata.premium_excluding_tax_equivalent)
              : riskRecord.basic_premium != null
                ? String(riskRecord.basic_premium)
                : '',
          premium_including_tax:
            metadata?.premium_including_tax != null
              ? String(metadata.premium_including_tax)
              : riskRecord.total_premium != null
                ? String(riskRecord.total_premium)
                : '',
          discounts_offered: discountsOffered.length
            ? discountsOffered.map((discount) => ({
                discount_type: String(discount.discount_type ?? '1'),
                discount_rate:
                  discount.discount_rate != null
                    ? String(discount.discount_rate)
                    : '',
                discount_amount:
                  discount.discount_amount != null
                    ? String(discount.discount_amount)
                    : '',
              }))
            : [createEmptyRiskDiscountRow()],
          taxes_charged: taxesCharged.length
            ? taxesCharged.map((tax) => ({
                tax_code: String(tax.tax_code ?? ''),
                is_tax_exempted:
                  tax.is_tax_exempted === true || tax.is_tax_exempted === 'Y',
                tax_exemption_type: String(tax.tax_exemption_type ?? ''),
                tax_exemption_reference: String(
                  tax.tax_exemption_reference ?? '',
                ),
                tax_rate: tax.tax_rate != null ? String(tax.tax_rate) : '',
                tax_amount:
                  tax.tax_amount != null ? String(tax.tax_amount) : '',
              }))
            : [createEmptyRiskTaxRow()],
          rate: riskRecord.rate != null ? String(riskRecord.rate) : '',
          basic_premium:
            riskRecord.basic_premium != null
              ? String(riskRecord.basic_premium)
              : '',
          discount_amount:
            riskRecord.discount_amount != null
              ? String(riskRecord.discount_amount)
              : '',
          tax_amount:
            riskRecord.tax_amount != null ? String(riskRecord.tax_amount) : '',
          charges_amount:
            riskRecord.charges_amount != null
              ? String(riskRecord.charges_amount)
              : '',
          commission_amount:
            riskRecord.commission_amount != null
              ? String(riskRecord.commission_amount)
              : '',
          total_premium:
            riskRecord.total_premium != null
              ? String(riskRecord.total_premium)
              : '',
          net_premium:
            riskRecord.net_premium != null
              ? String(riskRecord.net_premium)
              : '',
          rating_result_metadata: metadata ?? null,
        };
      },
    ),
  };
}
