import { z } from 'zod';
import type {
  CommissionPaymentPayload,
  CommissionTransactionPayload,
  InvoicePayload,
  PaymentTransactionPayload,
  ReceiptPayload,
} from './types';

const optionalText = z.string().trim().optional().or(z.literal(''));
const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .or(z.literal(''));

function normalizeText(value: string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export const invoiceFormSchema = z.object({
  insurer_company_id: z.string().min(1),
  intermediary_company_id: optionalText,
  customer_id: z.string().min(1),
  quotation_id: optionalText,
  policy_id: optionalText,
  endorsement_id: optionalText,
  cancellation_id: optionalText,
  renewal_id: optionalText,
  invoice_type: z.string().min(1),
  currency: z.string().trim().min(1).max(10),
  gross_amount: optionalNumber,
  discount_amount: optionalNumber,
  tax_amount: optionalNumber,
  charges_amount: optionalNumber,
  total_amount: optionalNumber,
  paid_amount: optionalNumber,
  balance_amount: optionalNumber,
  status: z.string().trim().optional().or(z.literal('')),
  due_date: optionalText,
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export function buildInvoicePayload(values: InvoiceFormValues): InvoicePayload {
  return {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id:
      normalizeText(values.intermediary_company_id) ?? null,
    customer_id: values.customer_id,
    quotation_id: normalizeText(values.quotation_id) ?? null,
    policy_id: normalizeText(values.policy_id) ?? null,
    endorsement_id: normalizeText(values.endorsement_id) ?? null,
    cancellation_id: normalizeText(values.cancellation_id) ?? null,
    renewal_id: normalizeText(values.renewal_id) ?? null,
    invoice_type: values.invoice_type,
    currency: values.currency.trim().toUpperCase(),
    gross_amount: normalizeNumber(values.gross_amount) ?? 0,
    discount_amount: normalizeNumber(values.discount_amount) ?? 0,
    tax_amount: normalizeNumber(values.tax_amount) ?? 0,
    charges_amount: normalizeNumber(values.charges_amount) ?? 0,
    total_amount: normalizeNumber(values.total_amount) ?? 0,
    paid_amount: normalizeNumber(values.paid_amount) ?? 0,
    balance_amount: normalizeNumber(values.balance_amount) ?? 0,
    status: normalizeText(values.status) ?? undefined,
    due_date: normalizeText(values.due_date) ?? null,
  };
}

export const receiptFormSchema = z.object({
  customer_id: z.string().min(1),
  invoice_id: z.string().min(1),
  payment_method: z.string().min(1),
  amount: optionalNumber,
  currency: z.string().trim().min(1).max(10),
  payment_reference: optionalText,
  received_by: optionalText,
  received_at: optionalText,
  status: z.string().trim().optional().or(z.literal('')),
});

export type ReceiptFormValues = z.infer<typeof receiptFormSchema>;

export function buildReceiptPayload(values: ReceiptFormValues): ReceiptPayload {
  return {
    customer_id: values.customer_id,
    invoice_id: values.invoice_id,
    payment_method: values.payment_method,
    amount: normalizeNumber(values.amount) ?? 0,
    currency: values.currency.trim().toUpperCase(),
    payment_reference: normalizeText(values.payment_reference) ?? null,
    received_by: normalizeText(values.received_by) ?? null,
    received_at: normalizeText(values.received_at) ?? null,
    status: normalizeText(values.status) ?? undefined,
  };
}

export const paymentTransactionFormSchema = z.object({
  invoice_id: optionalText,
  receipt_id: optionalText,
  provider: z.string().min(1),
  provider_reference: z.string().min(1),
  internal_reference: z.string().min(1),
  amount: optionalNumber,
  currency: z.string().trim().min(1).max(10),
  status: z.string().trim().optional().or(z.literal('')),
  request_payload: z.string().optional().or(z.literal('')),
  response_payload: z.string().optional().or(z.literal('')),
});

export type PaymentTransactionFormValues = z.infer<
  typeof paymentTransactionFormSchema
>;

export function buildPaymentTransactionPayload(
  values: PaymentTransactionFormValues,
): PaymentTransactionPayload {
  const parseJson = (raw: string | undefined | null) => {
    if (!raw || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  return {
    invoice_id: normalizeText(values.invoice_id) ?? null,
    receipt_id: normalizeText(values.receipt_id) ?? null,
    provider: values.provider,
    provider_reference: values.provider_reference,
    internal_reference: values.internal_reference,
    amount: normalizeNumber(values.amount) ?? 0,
    currency: values.currency.trim().toUpperCase(),
    status: normalizeText(values.status) ?? undefined,
    request_payload: parseJson(values.request_payload) as Record<
      string,
      unknown
    > | null,
    response_payload: parseJson(values.response_payload) as Record<
      string,
      unknown
    > | null,
  };
}

export const commissionTransactionFormSchema = z.object({
  insurer_company_id: z.string().min(1),
  intermediary_company_id: z.string().min(1),
  policy_id: z.string().min(1),
  invoice_id: optionalText,
  receipt_id: optionalText,
  commission_rule_id: optionalText,
  commission_type: z.string().min(1),
  calculation_base: z.string().min(1),
  gross_premium: optionalNumber,
  net_premium: optionalNumber,
  commission_rate: optionalNumber,
  commission_amount: optionalNumber,
  status: z.string().trim().optional().or(z.literal('')),
  earned_at: optionalText,
  paid_at: optionalText,
});

export type CommissionTransactionFormValues = z.infer<
  typeof commissionTransactionFormSchema
>;

export function buildCommissionTransactionPayload(
  values: CommissionTransactionFormValues,
): CommissionTransactionPayload {
  return {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id: values.intermediary_company_id,
    policy_id: values.policy_id,
    invoice_id: normalizeText(values.invoice_id) ?? null,
    receipt_id: normalizeText(values.receipt_id) ?? null,
    commission_rule_id: normalizeText(values.commission_rule_id) ?? null,
    commission_type: values.commission_type,
    calculation_base: values.calculation_base,
    gross_premium: normalizeNumber(values.gross_premium) ?? 0,
    net_premium: normalizeNumber(values.net_premium) ?? 0,
    commission_rate: normalizeNumber(values.commission_rate) ?? 0,
    commission_amount: normalizeNumber(values.commission_amount) ?? 0,
    status: normalizeText(values.status) ?? undefined,
    earned_at: normalizeText(values.earned_at) ?? null,
    paid_at: normalizeText(values.paid_at) ?? null,
  };
}

export const commissionPaymentFormSchema = z.object({
  intermediary_company_id: z.string().min(1),
  payment_no: z.string().min(1),
  payment_method: z.string().min(1),
  payment_reference: optionalText,
  total_amount: optionalNumber,
  currency: z.string().trim().min(1).max(10),
  status: z.string().trim().optional().or(z.literal('')),
  approved_by: optionalText,
  paid_by: optionalText,
});

export type CommissionPaymentFormValues = z.infer<
  typeof commissionPaymentFormSchema
>;

export function buildCommissionPaymentPayload(
  values: CommissionPaymentFormValues,
): CommissionPaymentPayload {
  return {
    intermediary_company_id: values.intermediary_company_id,
    payment_no: values.payment_no,
    payment_method: values.payment_method,
    payment_reference: normalizeText(values.payment_reference) ?? null,
    total_amount: normalizeNumber(values.total_amount) ?? 0,
    currency: values.currency.trim().toUpperCase(),
    status: normalizeText(values.status) ?? undefined,
    approved_by: normalizeText(values.approved_by) ?? null,
    paid_by: normalizeText(values.paid_by) ?? null,
  };
}
