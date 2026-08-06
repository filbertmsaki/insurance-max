import type {
  BackendPaginatedResponse,
  PaginatedResponse,
} from '@/modules/shared/api/pagination';

export interface FinancePartySummary {
  id: string;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  customer_no?: string | null;
  name?: string | null;
  policy_no?: string | null;
  quotation_no?: string | null;
  invoice_no?: string | null;
  receipt_no?: string | null;
}

export interface FinanceInvoiceItem {
  id: string;
  description?: string | null;
  item_name?: string | null;
  quantity?: string | null;
  unit_amount?: string | null;
  unit_price?: string | null;
  total_amount: string;
  line_snapshot?: Record<string, unknown> | null;
}

export interface FinanceInvoice {
  id: string;
  invoice_no: string;
  status: string;
  source_type?: string | null;
  source_record_id?: string | null;
  source_revision?: number | null;
  quotation_id?: string | null;
  policy_id?: string | null;
  customer_id: string;
  currency?: string;
  currency_code?: string;
  total_amount: string;
  paid_amount: string;
  allocated_amount?: string;
  refunded_amount?: string;
  written_off_amount?: string;
  balance_amount: string;
  balance_revision?: number;
  state_version?: number;
  due_date?: string | null;
  issued_at?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  source_snapshot?: Record<string, unknown> | null;
  customer?: FinancePartySummary | null;
  quotation?: FinancePartySummary | null;
  policy?: FinancePartySummary | null;
  items?: FinanceInvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

export interface FinancePaymentTransaction {
  id: string;
  transaction_no?: string | null;
  provider?: string | null;
  provider_code?: string | null;
  provider_reference?: string | null;
  provider_transaction_id?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  status: string;
  amount: string;
  currency?: string;
  currency_code?: string;
  payer_name?: string | null;
  payer_phone?: string | null;
  payer_email?: string | null;
  invoice_id?: string | null;
  receipt_id?: string | null;
  invoice?: FinanceInvoice | null;
  receipt?: FinanceReceipt | null;
  received_at?: string | null;
  settled_at?: string | null;
  created_at?: string;
}

export interface FinanceReceipt {
  id: string;
  receipt_no: string;
  status: string;
  payment_transaction_id?: string | null;
  payer_customer_id?: string | null;
  payer_name?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  provider_reference?: string | null;
  amount: string;
  allocated_amount?: string;
  unallocated_amount?: string;
  currency?: string;
  currency_code?: string;
  invoice_id?: string | null;
  invoice?: FinanceInvoice | null;
  customer?: FinancePartySummary | null;
  posted_at?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  created_at?: string;
}

export interface FinanceRefund {
  id: string;
  refund_no: string;
  status: string;
  invoice_id?: string | null;
  receipt_id?: string | null;
  payment_transaction_id?: string | null;
  payment_method: string;
  amount: string;
  currency_code: string;
  reason: string;
  requested_at: string;
  approved_at?: string | null;
  paid_at?: string | null;
  failure_message?: string | null;
}

export interface FinanceReconciliationItem {
  id: string;
  line_number: number;
  transaction_date: string;
  value_date?: string | null;
  description?: string | null;
  external_reference?: string | null;
  payer_reference?: string | null;
  amount: string;
  currency_code: string;
  status: string;
  matched_payment_transaction_id?: string | null;
  matched_receipt_id?: string | null;
  match_score?: string | null;
  match_reason?: string | null;
}

export interface FinanceReconciliationBatch {
  id: string;
  batch_no: string;
  provider_code: string;
  account_reference?: string | null;
  statement_reference?: string | null;
  statement_date: string;
  currency_code: string;
  opening_balance?: string | null;
  closing_balance?: string | null;
  statement_total: string;
  matched_total: string;
  unmatched_total: string;
  status: string;
  file_hash?: string | null;
  items?: FinanceReconciliationItem[];
  created_at?: string;
  imported_at?: string | null;
  approved_at?: string | null;
}

export interface FinanceCommissionAccrual {
  id: string;
  accrual_no?: string | null;
  status: string;
  quotation_id?: string | null;
  policy_id?: string | null;
  invoice_id?: string | null;
  intermediary_company_id: string;
  commission_base?: string | null;
  gross_premium?: string | null;
  commission_rate?: string | null;
  commission_amount: string;
  paid_amount?: string | null;
  balance_amount?: string | null;
  earned_at?: string | null;
  accrued_at?: string | null;
  approved_at?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  invoice?: FinanceInvoice | null;
  quotation?: FinancePartySummary | null;
  policy?: FinancePartySummary | null;
  intermediary_company?: FinancePartySummary | null;
  commission_snapshot?: Record<string, unknown> | null;
}

export interface FinanceCommissionPaymentItem {
  id: string;
  commission_transaction_id: string;
  amount: string;
  commission_transaction?: FinanceCommissionAccrual | null;
}

export interface FinanceCommissionPayment {
  id: string;
  payment_no: string;
  status: string;
  intermediary_company_id: string;
  payment_method: string;
  payment_reference?: string | null;
  total_amount: string;
  allocated_amount?: string | null;
  unallocated_amount?: string | null;
  currency: string;
  approved_at?: string | null;
  paid_at?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  intermediary_company?: FinancePartySummary | null;
  items?: FinanceCommissionPaymentItem[];
}

export interface FinanceJournalLine {
  id: string;
  description?: string | null;
  debit: string;
  credit: string;
  account_id: string;
}

export interface FinanceJournalEntry {
  id: string;
  journal_no: string;
  journal_date: string;
  source_type: string;
  source_id: string;
  source_event_id: string;
  description: string;
  currency_code: string;
  status: string;
  reversal_of_id?: string | null;
  posted_at?: string | null;
  created_at?: string;
  lines?: FinanceJournalLine[];
}

export interface FinanceListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export type FinancePage<T> = PaginatedResponse<T> | BackendPaginatedResponse<T>;
