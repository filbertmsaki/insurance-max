import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { PolicyRecord } from '@/modules/tenant/policies/types';
import type { QuotationRecord } from '@/modules/tenant/quotations/types';
import type { SortOrder } from '@/types';

export interface InvoiceItemRecord {
  id: string;
  invoice_id: string;
  item_type: string;
  item_name: string;
  description: string | null;
  quantity: string | null;
  unit_amount: string | null;
  total_amount: string | null;
}

export interface InvoiceRecord {
  id: string;
  company_id: string;
  insurer_company_id: string;
  intermediary_company_id: string | null;
  customer_id: string;
  quotation_id: string | null;
  policy_id: string | null;
  endorsement_id: string | null;
  cancellation_id: string | null;
  renewal_id: string | null;
  invoice_no: string;
  invoice_type: string;
  currency: string;
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  charges_amount: string;
  total_amount: string;
  paid_amount: string;
  balance_amount: string;
  status: string;
  due_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer?: CustomerRecord | null;
  policy?: PolicyRecord | null;
  quotation?: QuotationRecord | null;
  items?: InvoiceItemRecord[];
}

export interface ReceiptRecord {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_id: string | null;
  receipt_no: string;
  payment_method: string;
  amount: string;
  currency: string;
  payment_reference: string | null;
  received_by: string | null;
  received_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer?: CustomerRecord | null;
  invoice?: InvoiceRecord | null;
}

export interface PaymentTransactionRecord {
  id: string;
  company_id: string;
  invoice_id: string | null;
  receipt_id: string | null;
  provider: string;
  provider_reference: string;
  internal_reference: string;
  amount: string;
  currency: string;
  status: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  invoice?: InvoiceRecord | null;
  receipt?: ReceiptRecord | null;
}

export interface CommissionTransactionRecord {
  id: string;
  company_id: string;
  insurer_company_id: string;
  intermediary_company_id: string;
  policy_id: string;
  invoice_id: string | null;
  receipt_id: string | null;
  commission_rule_id: string | null;
  commission_type: string;
  calculation_base: string;
  gross_premium: string;
  net_premium: string;
  commission_rate: string;
  commission_amount: string;
  status: string;
  earned_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  policy?: PolicyRecord | null;
  invoice?: InvoiceRecord | null;
  receipt?: ReceiptRecord | null;
  commission_rule?: { id: string; name: string; commission_type: string } | null;
}

export interface CommissionPaymentItemRecord {
  id?: string;
  commission_payment_id?: string;
  commission_transaction_id: string;
  amount: string | null;
  commission_transaction?: CommissionTransactionRecord | null;
}

export interface CommissionPaymentRecord {
  id: string;
  company_id: string;
  intermediary_company_id: string;
  payment_no: string;
  payment_method: string;
  payment_reference: string | null;
  total_amount: string;
  currency: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  items?: CommissionPaymentItemRecord[];
}

export interface BillingListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface InvoicePayload {
  insurer_company_id: string;
  intermediary_company_id?: string | null;
  customer_id: string;
  quotation_id?: string | null;
  policy_id?: string | null;
  endorsement_id?: string | null;
  cancellation_id?: string | null;
  renewal_id?: string | null;
  invoice_type: string;
  currency?: string;
  gross_amount?: number | string | null;
  discount_amount?: number | string | null;
  tax_amount?: number | string | null;
  charges_amount?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  balance_amount?: number | string | null;
  status?: string;
  due_date?: string | null;
  items?: Array<{
    item_type: string;
    item_name: string;
    description?: string | null;
    quantity?: number | string | null;
    unit_amount?: number | string | null;
    total_amount?: number | string | null;
  }>;
}

export interface ReceiptPayload {
  customer_id: string;
  invoice_id: string;
  payment_method: string;
  amount?: number | string | null;
  currency?: string;
  payment_reference?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  status?: string;
}

export interface PaymentTransactionPayload {
  invoice_id?: string | null;
  receipt_id?: string | null;
  provider: string;
  provider_reference: string;
  internal_reference: string;
  amount?: number | string | null;
  currency?: string;
  status?: string;
  request_payload?: Record<string, unknown> | null;
  response_payload?: Record<string, unknown> | null;
}

export interface CommissionTransactionPayload {
  insurer_company_id: string;
  intermediary_company_id: string;
  policy_id: string;
  invoice_id?: string | null;
  receipt_id?: string | null;
  commission_rule_id?: string | null;
  commission_type: string;
  calculation_base: string;
  gross_premium?: number | string | null;
  net_premium?: number | string | null;
  commission_rate?: number | string | null;
  commission_amount?: number | string | null;
  status?: string;
  earned_at?: string | null;
  paid_at?: string | null;
}

export interface CommissionPaymentPayload {
  intermediary_company_id: string;
  payment_no: string;
  payment_method: string;
  payment_reference?: string | null;
  total_amount?: number | string | null;
  currency?: string;
  status?: string;
  approved_by?: string | null;
  paid_by?: string | null;
  items?: Array<{
    commission_transaction_id: string;
    amount?: number | string | null;
  }>;
}

export type InvoicePage = PaginatedResponse<InvoiceRecord>;
export type ReceiptPage = PaginatedResponse<ReceiptRecord>;
export type PaymentTransactionPage = PaginatedResponse<PaymentTransactionRecord>;
export type CommissionTransactionPage = PaginatedResponse<CommissionTransactionRecord>;
export type CommissionPaymentPage = PaginatedResponse<CommissionPaymentRecord>;

