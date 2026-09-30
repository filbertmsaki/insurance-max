import { z } from 'zod';
import type {
  AssessmentPayload,
  ClaimAssessment,
  ClaimIntimation,
  IntimationPayload,
  ReservePayload,
} from './types';
import { fromDateTimeLocal, toDateTimeLocal } from './utils';

const AMOUNT = /^\d+(\.\d{1,2})?$/;

const requiredAmount = (label: string, { positive = false } = {}) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .refine(
      (value) => AMOUNT.test(value),
      'Enter an amount with up to 2 decimals',
    )
    .refine(
      (value) => !positive || Number(value) > 0,
      `The ${label} must be greater than zero`,
    );

const optionalAmount = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || AMOUNT.test(value),
    'Enter an amount with up to 2 decimals',
  );

const blank = (value?: string | null) => value?.trim() || undefined;
const text = (value: unknown) => (value == null ? '' : String(value));
const amountText = (value: unknown) =>
  value == null || Number(value) === 0 ? '' : String(value);

// ---------------------------------------------------------------------------
// Intimation (§10.1). The assessor is mandatory for both assessment options.
// ---------------------------------------------------------------------------

export const intimationSchema = z.object({
  claim_intimation_date: z.string().min(1, 'Enter the intimation date'),
  claim_reserve_amount: requiredAmount('reserve amount', { positive: true }),
  claim_reserve_method: z
    .string()
    .trim()
    .min(1, 'Enter how the reserve was estimated')
    .max(100),
  claim_estimated_amount: optionalAmount,
  exchange_rate: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value || (/^\d+(\.\d{1,6})?$/.test(value) && Number(value) > 0),
      'Enter a positive exchange rate',
    ),
  loss_assessment_option: z.enum(['1', '2'], {
    message: 'Choose who assesses the loss',
  }),
  assessor_name: z.string().trim().min(1, 'Enter the assessor name').max(100),
  assessor_id_type: z.string().min(1, 'Choose the assessor ID type'),
  assessor_id_number: z
    .string()
    .trim()
    .min(1, 'Enter the assessor ID number')
    .max(50),
});

export type IntimationFormValues = z.infer<typeof intimationSchema>;

export function intimationDefaults(
  intimation?: ClaimIntimation | null,
  estimated?: unknown,
): IntimationFormValues {
  return {
    claim_intimation_date: toDateTimeLocal(
      intimation?.claim_intimation_date ?? new Date().toISOString(),
    ),
    claim_reserve_amount: amountText(intimation?.claim_reserve_amount),
    claim_reserve_method:
      text(intimation?.claim_reserve_method) || 'Case estimate',
    claim_estimated_amount: amountText(
      intimation?.claim_estimated_amount ?? estimated,
    ),
    exchange_rate: intimation?.exchange_rate
      ? String(Number(intimation.exchange_rate))
      : '',
    loss_assessment_option: (text(intimation?.loss_assessment_option) ||
      '1') as '1' | '2',
    assessor_name: text(intimation?.assessor_name),
    assessor_id_type: text(intimation?.assessor_id_type),
    assessor_id_number: text(intimation?.assessor_id_number),
  };
}

export function toIntimationPayload(
  values: IntimationFormValues,
): IntimationPayload {
  return {
    claim_intimation_date: fromDateTimeLocal(values.claim_intimation_date),
    claim_reserve_amount: values.claim_reserve_amount,
    claim_reserve_method: values.claim_reserve_method.trim(),
    claim_estimated_amount: blank(values.claim_estimated_amount),
    exchange_rate: blank(values.exchange_rate),
    loss_assessment_option: Number(values.loss_assessment_option),
    assessor_name: values.assessor_name.trim(),
    assessor_id_type: Number(values.assessor_id_type),
    assessor_id_number: values.assessor_id_number.trim(),
  };
}

// ---------------------------------------------------------------------------
// Reserve change request (goes through approval before the ledger moves).
// ---------------------------------------------------------------------------

export const reserveSchema = z.object({
  reserve_type: z.enum(['INITIAL', 'INCREASE', 'DECREASE']),
  amount: requiredAmount('amount', { positive: true }),
  reason: z.string().trim().min(1, 'Explain the change').max(2000),
});

export type ReserveFormValues = z.infer<typeof reserveSchema>;

export function toReservePayload(values: ReserveFormValues): ReservePayload {
  return {
    reserve_type: values.reserve_type,
    amount: values.amount,
    reason: values.reason.trim(),
  };
}

// ---------------------------------------------------------------------------
// Assessment (§11.1). TIRA receives the assessed and approved amounts; the
// breakdown stays on the claim file.
// ---------------------------------------------------------------------------

export const assessmentSchema = z
  .object({
    assessment_received_date: z
      .string()
      .min(1, 'Enter when the report was received'),
    assessment_report_summary: z
      .string()
      .trim()
      .min(1, 'Summarise the assessment report')
      .max(1000),
    assessment_amount: requiredAmount('assessed loss amount'),
    approved_claim_amount: requiredAmount('recommended claim amount'),
    assessor_name: z.string().trim().max(180).optional(),
    assessor_company: z.string().trim().max(180).optional(),
    inspection_date: z.string().optional(),
    recommended_amount: optionalAmount,
    deductible_amount: optionalAmount,
    salvage_amount: optionalAmount,
    contribution_amount: optionalAmount,
    betterment_amount: optionalAmount,
    recovery_amount: optionalAmount,
    remarks: z.string().trim().max(5000).optional(),
  })
  .superRefine((values, ctx) => {
    if (
      AMOUNT.test(values.assessment_amount) &&
      AMOUNT.test(values.approved_claim_amount) &&
      Number(values.approved_claim_amount) > Number(values.assessment_amount)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['approved_claim_amount'],
        message: 'The claim amount cannot exceed the assessed loss',
      });
    }
  });

export type AssessmentFormValues = z.infer<typeof assessmentSchema>;

export const ASSESSMENT_DEDUCTIONS = [
  { key: 'deductible_amount', label: 'Deductible / excess' },
  { key: 'salvage_amount', label: 'Salvage' },
  { key: 'betterment_amount', label: 'Betterment' },
  { key: 'contribution_amount', label: 'Contribution' },
  { key: 'recovery_amount', label: 'Expected recovery' },
] as const;

/** Assessed loss less the deductions entered, as a suggested claim amount. */
export function netOfDeductions(values: Partial<AssessmentFormValues>) {
  const assessed = Number(values.assessment_amount);
  if (!Number.isFinite(assessed) || !values.assessment_amount) return null;
  const deductions = ASSESSMENT_DEDUCTIONS.reduce(
    (sum, item) => sum + (Number(values[item.key]) || 0),
    0,
  );
  return Math.max(assessed - deductions, 0);
}

export function assessmentDefaults(
  assessment?: ClaimAssessment | null,
): AssessmentFormValues {
  return {
    assessment_received_date: toDateTimeLocal(
      assessment?.assessment_received_date ?? new Date().toISOString(),
    ),
    assessment_report_summary: text(assessment?.assessment_report_summary),
    assessment_amount: amountText(assessment?.assessment_amount),
    approved_claim_amount: amountText(assessment?.approved_claim_amount),
    assessor_name: text(assessment?.assessor_name),
    assessor_company: text(assessment?.assessor_company),
    inspection_date: text(assessment?.inspection_date).slice(0, 10),
    recommended_amount: amountText(assessment?.recommended_amount),
    deductible_amount: amountText(assessment?.deductible_amount),
    salvage_amount: amountText(assessment?.salvage_amount),
    contribution_amount: amountText(assessment?.contribution_amount),
    betterment_amount: amountText(assessment?.betterment_amount),
    recovery_amount: amountText(assessment?.recovery_amount),
    remarks: text(assessment?.remarks),
  };
}

export function toAssessmentPayload(
  values: AssessmentFormValues,
): AssessmentPayload {
  return {
    assessment_received_date: fromDateTimeLocal(
      values.assessment_received_date,
    )!,
    assessment_report_summary: values.assessment_report_summary.trim(),
    assessment_amount: values.assessment_amount,
    approved_claim_amount: values.approved_claim_amount,
    assessor_name: blank(values.assessor_name),
    assessor_company: blank(values.assessor_company),
    inspection_date: blank(values.inspection_date),
    recommended_amount: blank(values.recommended_amount),
    deductible_amount: blank(values.deductible_amount),
    salvage_amount: blank(values.salvage_amount),
    contribution_amount: blank(values.contribution_amount),
    betterment_amount: blank(values.betterment_amount),
    recovery_amount: blank(values.recovery_amount),
    remarks: blank(values.remarks),
  };
}
