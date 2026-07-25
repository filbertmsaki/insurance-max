import { z } from 'zod';
import type { PolicyFormValues, PolicyPayload } from './types';

const optionalText = z.string().trim().optional().or(z.literal(''));

export const policyFormSchema = z.object({
  insurer_company_id: z.string().min(1, 'Company is required'),
  intermediary_company_id: optionalText,
  branch_id: optionalText,
  department_id: optionalText,
  customer_id: z.string().min(1, 'Customer is required'),
  quotation_id: optionalText,
  proposal_id: optionalText,
  category_id: z.string().min(1, 'Category is required'),
  product_id: z.string().min(1, 'Product is required'),
  sub_class_id: optionalText,
  channel_type: z.enum(['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API']),
  policy_status: optionalText,
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  issue_date: z.string().min(1, 'Issue date is required'),
  currency: z.string().trim().min(1).max(10),
  sum_insured: z.string().trim().optional().or(z.literal('')),
  basic_premium: z.string().trim().optional().or(z.literal('')),
  total_discount: z.string().trim().optional().or(z.literal('')),
  total_tax: z.string().trim().optional().or(z.literal('')),
  total_charges: z.string().trim().optional().or(z.literal('')),
  total_commission: z.string().trim().optional().or(z.literal('')),
  total_premium: z.string().trim().optional().or(z.literal('')),
  net_premium: z.string().trim().optional().or(z.literal('')),
  reinsurance_required: z.boolean(),
  reinsurance_status: optionalText,
  retention_amount: z.string().trim().optional().or(z.literal('')),
  ceded_sum_insured: z.string().trim().optional().or(z.literal('')),
  ceded_premium: z.string().trim().optional().or(z.literal('')),
  tira_status: optionalText,
  tira_portal_transaction_id: optionalText,
  tiramis_transaction_id: optionalText,
});

export type PolicyFormSchemaValues = z.infer<typeof policyFormSchema>;

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

export function buildPolicyPayload(
  values: PolicyFormSchemaValues,
): PolicyPayload {
  return {
    insurer_company_id: values.insurer_company_id,
    intermediary_company_id:
      normalizeText(values.intermediary_company_id) ?? null,
    branch_id: normalizeText(values.branch_id) ?? null,
    department_id: normalizeText(values.department_id) ?? null,
    customer_id: values.customer_id,
    quotation_id: normalizeText(values.quotation_id) ?? null,
    proposal_id: normalizeText(values.proposal_id) ?? null,
    category_id: values.category_id,
    product_id: values.product_id,
    sub_class_id: normalizeText(values.sub_class_id) ?? null,
    channel_type: values.channel_type,
    policy_status: normalizeText(values.policy_status) ?? undefined,
    start_date: values.start_date,
    end_date: values.end_date,
    issue_date: values.issue_date,
    currency: values.currency.trim().toUpperCase(),
    sum_insured: normalizeNumber(values.sum_insured) ?? 0,
    basic_premium: normalizeNumber(values.basic_premium) ?? 0,
    total_discount: normalizeNumber(values.total_discount) ?? 0,
    total_tax: normalizeNumber(values.total_tax) ?? 0,
    total_charges: normalizeNumber(values.total_charges) ?? 0,
    total_commission: normalizeNumber(values.total_commission) ?? 0,
    total_premium: normalizeNumber(values.total_premium) ?? 0,
    net_premium: normalizeNumber(values.net_premium) ?? 0,
    reinsurance_required: values.reinsurance_required,
    reinsurance_status: normalizeText(values.reinsurance_status),
    retention_amount: normalizeNumber(values.retention_amount) ?? 0,
    ceded_sum_insured: normalizeNumber(values.ceded_sum_insured) ?? 0,
    ceded_premium: normalizeNumber(values.ceded_premium) ?? 0,
    tira_status: normalizeText(values.tira_status) ?? undefined,
    tira_portal_transaction_id:
      normalizeText(values.tira_portal_transaction_id) ?? null,
    tiramis_transaction_id:
      normalizeText(values.tiramis_transaction_id) ?? null,
  };
}

export function policyRecordToFormValues(
  record: any,
): Partial<PolicyFormValues> {
  return {
    insurer_company_id: record.insurer_company_id ?? '',
    intermediary_company_id: record.intermediary_company_id ?? '',
    branch_id: record.branch_id ?? '',
    department_id: record.department_id ?? '',
    customer_id: record.customer_id ?? '',
    quotation_id: record.quotation_id ?? '',
    proposal_id: record.proposal_id ?? '',
    category_id: record.category_id ?? '',
    product_id: record.product_id ?? '',
    sub_class_id: record.sub_class_id ?? '',
    channel_type: record.channel_type ?? 'DIRECT',
    policy_status: record.policy_status ?? 'DRAFT',
    start_date: record.start_date ?? '',
    end_date: record.end_date ?? '',
    issue_date: record.issue_date ?? '',
    currency: record.currency ?? 'TZS',
    sum_insured: record.sum_insured ?? '',
    basic_premium: record.basic_premium ?? '',
    total_discount: record.total_discount ?? '',
    total_tax: record.total_tax ?? '',
    total_charges: record.total_charges ?? '',
    total_commission: record.total_commission ?? '',
    total_premium: record.total_premium ?? '',
    net_premium: record.net_premium ?? '',
    reinsurance_required: record.reinsurance_required ?? false,
    reinsurance_status: record.reinsurance_status ?? '',
    retention_amount: record.retention_amount ?? '',
    ceded_sum_insured: record.ceded_sum_insured ?? '',
    ceded_premium: record.ceded_premium ?? '',
    tira_status: record.tira_status ?? '',
    tira_portal_transaction_id: record.tira_portal_transaction_id ?? '',
    tiramis_transaction_id: record.tiramis_transaction_id ?? '',
  };
}
