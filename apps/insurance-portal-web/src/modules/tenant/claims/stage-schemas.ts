import { z } from 'zod';
import type {
  AssessmentPayload,
  ClaimAssessment,
  ClaimDischargeVoucher,
  ClaimIntimation,
  IntimationPayload,
  PaymentPayload,
  RejectionPayload,
  ReservePayload,
  VoucherAdjustPayload,
  VoucherPayload,
  VoucherResponsePayload,
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

// ---------------------------------------------------------------------------
// Discharge voucher (§12.1)
// ---------------------------------------------------------------------------

export const voucherSchema = z.object({
  claim_offer_amount: requiredAmount('offer amount', { positive: true }),
  claim_offer_communication_date: z
    .string()
    .min(1, 'Enter when the offer was communicated'),
  claimant_id: z.string().optional(),
});

export type VoucherFormValues = z.infer<typeof voucherSchema>;

export function voucherDefaults(
  voucher?: ClaimDischargeVoucher | null,
  offer?: unknown,
): VoucherFormValues {
  return {
    claim_offer_amount: amountText(voucher?.claim_offer_amount ?? offer),
    claim_offer_communication_date: toDateTimeLocal(
      voucher?.claim_offer_communication_date ?? new Date().toISOString(),
    ),
    claimant_id: voucher?.claimant_id ?? ALL_CLAIMANTS,
  };
}

/** Sentinel for "every claimant" in the voucher claimant select. */
export const ALL_CLAIMANTS = '__all__';

export function toVoucherPayload(values: VoucherFormValues): VoucherPayload {
  return {
    claim_offer_amount: values.claim_offer_amount,
    claim_offer_communication_date: fromDateTimeLocal(
      values.claim_offer_communication_date,
    ),
    claimant_id:
      values.claimant_id && values.claimant_id !== ALL_CLAIMANTS
        ? values.claimant_id
        : undefined,
  };
}

export const voucherResponseSchema = z.object({
  response: z.enum(['ACCEPT', 'REJECT']),
  claimant_response_date: z
    .string()
    .min(1, 'Enter when the claimant responded'),
  reason: z.string().trim().max(2000).optional(),
});

export type VoucherResponseFormValues = z.infer<typeof voucherResponseSchema>;

export function toVoucherResponsePayload(
  values: VoucherResponseFormValues,
): VoucherResponsePayload {
  return {
    response: values.response,
    claimant_response_date: fromDateTimeLocal(values.claimant_response_date),
    reason: blank(values.reason),
  };
}

/**
 * Adjustment and reconciliation are optional, but TIRA needs each one in
 * full when recorded (the shared claim rules check the same).
 */
export const voucherAdjustSchema = z
  .object({
    adjustment_date: z.string().optional(),
    adjustment_reason: z.string().trim().max(1000).optional(),
    adjustment_amount: optionalAmount,
    reconciliation_date: z.string().optional(),
    reconciliation_summary: z.string().trim().max(1000).optional(),
    reconciled_amount: optionalAmount,
  })
  .superRefine((values, ctx) => {
    const groups = [
      [
        ['adjustment_date', 'Enter the adjustment date'],
        ['adjustment_reason', 'Give the adjustment reason'],
        ['adjustment_amount', 'Enter the adjustment amount'],
      ],
      [
        ['reconciliation_date', 'Enter the reconciliation date'],
        ['reconciliation_summary', 'Summarise the reconciliation'],
        ['reconciled_amount', 'Enter the reconciled amount'],
      ],
    ] as const;

    for (const group of groups) {
      if (!group.some(([field]) => values[field]?.trim())) continue;
      for (const [field, message] of group) {
        if (!values[field]?.trim()) {
          ctx.addIssue({ code: 'custom', path: [field], message });
        }
      }
    }

    if (!groups.flat().some(([field]) => values[field]?.trim())) {
      ctx.addIssue({
        code: 'custom',
        path: ['adjustment_reason'],
        message: 'Record an adjustment, a reconciliation, or both',
      });
    }
  });

export type VoucherAdjustFormValues = z.infer<typeof voucherAdjustSchema>;

export function voucherAdjustDefaults(
  voucher: ClaimDischargeVoucher,
): VoucherAdjustFormValues {
  return {
    adjustment_date: toDateTimeLocal(voucher.adjustment_date),
    adjustment_reason: text(voucher.adjustment_reason),
    adjustment_amount: amountText(voucher.adjustment_amount),
    reconciliation_date: toDateTimeLocal(voucher.reconciliation_date),
    reconciliation_summary: text(voucher.reconciliation_summary),
    reconciled_amount: amountText(voucher.reconciled_amount),
  };
}

export function toVoucherAdjustPayload(
  values: VoucherAdjustFormValues,
): VoucherAdjustPayload {
  return {
    adjustment_date: fromDateTimeLocal(values.adjustment_date),
    adjustment_reason: blank(values.adjustment_reason),
    adjustment_amount: blank(values.adjustment_amount),
    reconciliation_date: fromDateTimeLocal(values.reconciliation_date),
    reconciliation_summary: blank(values.reconciliation_summary),
    reconciled_amount: blank(values.reconciled_amount),
  };
}

// ---------------------------------------------------------------------------
// Claim payment (§13.1)
// ---------------------------------------------------------------------------

export const paymentSchema = z
  .object({
    paid_amount: requiredAmount('payment amount', { positive: true }),
    payment_mode: z.enum(['1', '2', '3'], { message: 'Choose how it is paid' }),
    claimant_id: z.string().optional(),
    payee_type: z.enum(['CLAIMANT', 'GARAGE', 'HOSPITAL', 'ASSESSOR', 'OTHER']),
    payee_name: z.string().trim().max(180).optional(),
    payment_method: z.string().trim().max(100).optional(),
    payment_reference: z.string().trim().max(120).optional(),
    bank_name: z.string().trim().max(120).optional(),
    account_name: z.string().trim().max(180).optional(),
    account_number: z.string().trim().max(60).optional(),
    parties_notified: z.enum(['Y', 'N']),
    claim_resulted_litigation: z.enum(['Y', 'N']),
    litigation_reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((values, ctx) => {
    if (
      values.claim_resulted_litigation === 'Y' &&
      !values.litigation_reason?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['litigation_reason'],
        message: 'Give the litigation reason (TIRA094)',
      });
    }
    if (values.payee_type !== 'CLAIMANT' && !values.payee_name?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['payee_name'],
        message: 'Name who receives the payment',
      });
    }
  });

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export function paymentDefaults(
  amount: number,
  claimantId?: string,
): PaymentFormValues {
  return {
    paid_amount: amount > 0 ? amount.toFixed(2) : '',
    payment_mode: '3',
    claimant_id: claimantId ?? '',
    payee_type: 'CLAIMANT',
    payee_name: '',
    payment_method: '',
    payment_reference: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    parties_notified: 'Y',
    claim_resulted_litigation: 'N',
    litigation_reason: '',
  };
}

export function toPaymentPayload(values: PaymentFormValues): PaymentPayload {
  const bank = {
    bank_name: blank(values.bank_name),
    account_name: blank(values.account_name),
    account_number: blank(values.account_number),
  };
  const hasBank = Object.values(bank).some(Boolean);

  return {
    paid_amount: values.paid_amount,
    payment_mode: Number(values.payment_mode),
    claimant_id: blank(values.claimant_id),
    payee_type: values.payee_type,
    payee_name: blank(values.payee_name),
    payment_method: blank(values.payment_method),
    payment_reference: blank(values.payment_reference),
    payee_bank_details: hasBank ? bank : undefined,
    parties_notified: values.parties_notified,
    claim_resulted_litigation: values.claim_resulted_litigation === 'Y',
    litigation_reason:
      values.claim_resulted_litigation === 'Y'
        ? blank(values.litigation_reason)
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Claim rejection (§14.1). TIRA gets its own RejectionReason of at most 100
// characters; the full internal reason stays on the claim file.
// ---------------------------------------------------------------------------

export const TIRA_REJECTION_REASON_MAX = 100;

export const rejectionSchema = z.object({
  rejection_reason: z
    .string()
    .trim()
    .min(1, 'Explain why the claim is rejected')
    .max(5000),
  tira_rejection_reason: z
    .string()
    .trim()
    .min(1, 'Give the reason reported to TIRA')
    .max(
      TIRA_REJECTION_REASON_MAX,
      `TIRA accepts at most ${TIRA_REJECTION_REASON_MAX} characters`,
    ),
  recommendation: z.string().trim().max(5000).optional(),
  policy_clause_reference: z.string().trim().max(200).optional(),
  claim_amount: optionalAmount,
  claim_resulted_litigation: z.enum(['Y', 'N']),
});

export type RejectionFormValues = z.infer<typeof rejectionSchema>;

export function rejectionDefaults(estimated?: unknown): RejectionFormValues {
  return {
    rejection_reason: '',
    tira_rejection_reason: '',
    recommendation: '',
    policy_clause_reference: '',
    claim_amount: amountText(estimated),
    claim_resulted_litigation: 'N',
  };
}

export function toRejectionPayload(
  values: RejectionFormValues,
): RejectionPayload {
  return {
    rejection_reason: values.rejection_reason.trim(),
    tira_rejection_reason: values.tira_rejection_reason.trim(),
    recommendation: blank(values.recommendation),
    policy_clause_reference: blank(values.policy_clause_reference),
    claim_amount: blank(values.claim_amount),
    claim_resulted_litigation: values.claim_resulted_litigation === 'Y',
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
