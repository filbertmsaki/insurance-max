import { z } from 'zod';
import type { QuotationFormValues, QuotationPayload } from './types';

const optionalText = z.string().trim().optional().or(z.literal(''));

export const quotationFormSchema = z.object({
  insurer_company_id: z.string().min(1, 'Company is required'),
  intermediary_company_id: optionalText,
  branch_id: optionalText,
  department_id: optionalText,
  customer_id: z.string().min(1, 'Customer is required'),
  category_id: z.string().min(1, 'Category is required'),
  product_id: z.string().min(1, 'Product is required'),
  sub_class_id: optionalText,
  quotation_type: z.enum(['MOTOR', 'NON_MOTOR']),
  channel_type: z.enum(['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API']),
  status: z.enum(['DRAFT', 'RATED', 'REFERRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED', 'CANCELLED']),
  currency: z.string().trim().min(1).max(10),
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
});

export type QuotationFormSchemaValues = z.infer<typeof quotationFormSchema>;

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

export function buildQuotationPayload(values: QuotationFormSchemaValues): QuotationPayload {
  return {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id: normalizeText(values.intermediary_company_id) ?? null,
    branch_id: normalizeText(values.branch_id) ?? null,
    department_id: normalizeText(values.department_id) ?? null,
    customer_id: values.customer_id,
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
    rejection_reason: normalizeText(values.rejection_reason) ?? null,
  };
}

export function quotationRecordToFormValues(record: any): Partial<QuotationFormValues> {
  return {
    insurer_company_id: record.insurer_company_id ?? '',
    intermediary_company_id: record.intermediary_company_id ?? '',
    branch_id: record.branch_id ?? '',
    department_id: record.department_id ?? '',
    customer_id: record.customer_id ?? '',
    category_id: record.category_id ?? '',
    product_id: record.product_id ?? '',
    sub_class_id: record.sub_class_id ?? '',
    quotation_type: (record.quotation_type as QuotationFormValues['quotation_type']) ?? 'NON_MOTOR',
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
  };
}
