import { apiClient } from '@/modules/shared/api/client';
import {
  normalizePaginatedResponse,
  type PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  FinanceCommissionAccrual,
  FinanceCommissionPayment,
  FinanceInvoice,
  FinanceJournalEntry,
  FinanceListParams,
  FinancePage,
  FinancePaymentReference,
  FinancePaymentTransaction,
  FinanceReceipt,
  FinanceReconciliationBatch,
  FinanceRefund,
} from './types';

async function getPage<T>(
  path: string,
  params?: FinanceListParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<T>> {
  const response = await apiClient.get<FinancePage<T>>(path, {
    params,
    signal,
  });
  return normalizePaginatedResponse(response.data);
}

/** Server-side table fetchers (page/limit/search/sortBy/sortOrder/status). */
export const financeTableApi = {
  invoices: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinanceInvoice>('/tenant/finance/invoices', params, signal),
  payments: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinancePaymentTransaction>(
      '/tenant/finance/payment-transactions',
      params,
      signal,
    ),
  receipts: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinanceReceipt>('/tenant/finance/receipts', params, signal),
  refunds: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinanceRefund>('/tenant/finance/refunds', params, signal),
  journals: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinanceJournalEntry>('/tenant/finance/journals', params, signal),
  commissionAccruals: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinanceCommissionAccrual>(
      '/tenant/finance/commission-accruals',
      params,
      signal,
    ),
  commissionPayments: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinanceCommissionPayment>(
      '/tenant/finance/commission-payments',
      params,
      signal,
    ),
  /** Paged only when page is sent; the endpoint returns an array otherwise. */
  reconciliationBatches: (params: FinanceListParams, signal?: AbortSignal) =>
    getPage<FinanceReconciliationBatch>(
      '/tenant/finance/reconciliation-batches',
      params,
      signal,
    ),
};

export const financeApi = {
  getInvoices: (params?: FinanceListParams) =>
    getPage<FinanceInvoice>('/tenant/finance/invoices', params),
  getInvoice: (id: string) =>
    apiClient
      .get<FinanceInvoice>(`/tenant/finance/invoices/${id}`)
      .then((r) => r.data),
  issueInvoice: (
    id: string,
    data: {
      expected_state_version: number;
      idempotency_key: string;
      due_date?: string;
      notes?: string;
    },
  ) =>
    apiClient
      .post<FinanceInvoice>(`/tenant/finance/invoices/${id}/issue`, data)
      .then((r) => r.data),
  voidInvoice: (
    id: string,
    data: { reason: string; idempotency_key: string },
  ) =>
    apiClient
      .post<FinanceInvoice>(`/tenant/finance/invoices/${id}/void`, data)
      .then((r) => r.data),
  getPaymentReferences: (invoiceId: string) =>
    apiClient
      .get<
        FinancePaymentReference[]
      >(`/tenant/finance/invoices/${invoiceId}/payment-references`)
      .then((r) => r.data),
  createPaymentReference: (
    invoiceId: string,
    data: {
      method: string;
      provider?: string;
      channel?: string;
      metadata?: Record<string, unknown>;
    },
  ) =>
    apiClient
      .post<FinancePaymentReference>(
        `/tenant/finance/invoices/${invoiceId}/payment-references`,
        data,
      )
      .then((r) => r.data),

  getPaymentTransactions: (params?: FinanceListParams) =>
    getPage<FinancePaymentTransaction>(
      '/tenant/finance/payment-transactions',
      params,
    ),
  getPaymentTransaction: (id: string) =>
    apiClient
      .get<FinancePaymentTransaction>(
        `/tenant/finance/payment-transactions/${id}`,
      )
      .then((r) => r.data),
  recordManualPayment: (data: {
    invoice_id?: string;
    customer_id?: string;
    payment_method: string;
    provider_code: string;
    provider_transaction_id?: string;
    payment_reference: string;
    amount: number;
    currency_code: string;
    exchange_rate?: number;
    payer_name: string;
    payer_phone?: string;
    payer_email?: string;
    idempotency_key: string;
  }) =>
    apiClient
      .post<FinancePaymentTransaction>(
        '/tenant/finance/payment-transactions/manual',
        data,
      )
      .then((r) => r.data),

  getReceipts: (params?: FinanceListParams) =>
    getPage<FinanceReceipt>('/tenant/finance/receipts', params),
  getReceipt: (id: string) =>
    apiClient
      .get<FinanceReceipt>(`/tenant/finance/receipts/${id}`)
      .then((r) => r.data),
  postReceipt: (data: {
    payment_transaction_id: string;
    invoice_id?: string;
    allocation_amount?: number;
    idempotency_key: string;
  }) =>
    apiClient
      .post<FinanceReceipt>('/tenant/finance/receipts/post', data)
      .then((r) => r.data),
  allocateReceipt: (
    id: string,
    data: { invoice_id: string; amount: number; idempotency_key: string },
  ) =>
    apiClient
      .post(`/tenant/finance/receipts/${id}/allocate`, data)
      .then((r) => r.data),
  reverseReceipt: (
    id: string,
    data: { reason: string; idempotency_key: string },
  ) =>
    apiClient
      .post<FinanceReceipt>(`/tenant/finance/receipts/${id}/reverse`, data)
      .then((r) => r.data),
  reverseAllocation: (
    id: string,
    data: { reason: string; idempotency_key: string },
  ) =>
    apiClient
      .post(`/tenant/finance/allocations/${id}/reverse`, data)
      .then((r) => r.data),

  getRefunds: (params?: FinanceListParams) =>
    getPage<FinanceRefund>('/tenant/finance/refunds', params),
  getRefund: (id: string) =>
    apiClient
      .get<FinanceRefund>(`/tenant/finance/refunds/${id}`)
      .then((r) => r.data),
  requestRefund: (data: {
    receipt_id: string;
    invoice_id?: string;
    amount: number;
    reason: string;
    idempotency_key: string;
  }) =>
    apiClient
      .post<FinanceRefund>('/tenant/finance/refunds', data)
      .then((r) => r.data),
  approveRefund: (id: string, data: { idempotency_key: string }) =>
    apiClient
      .post<FinanceRefund>(`/tenant/finance/refunds/${id}/approve`, data)
      .then((r) => r.data),
  payRefund: (
    id: string,
    data: { idempotency_key: string; provider_refund_id?: string },
  ) =>
    apiClient
      .post<FinanceRefund>(`/tenant/finance/refunds/${id}/pay`, data)
      .then((r) => r.data),
  cancelRefund: (
    id: string,
    data: { reason: string; idempotency_key: string },
  ) =>
    apiClient
      .post<FinanceRefund>(`/tenant/finance/refunds/${id}/cancel`, data)
      .then((r) => r.data),

  getReconciliationBatches: () =>
    apiClient
      .get<
        FinanceReconciliationBatch[]
      >('/tenant/finance/reconciliation-batches')
      .then((r) => r.data),
  getReconciliationBatch: (id: string) =>
    apiClient
      .get<FinanceReconciliationBatch>(
        `/tenant/finance/reconciliation-batches/${id}`,
      )
      .then((r) => r.data),
  createReconciliationBatch: (data: {
    provider_code: string;
    account_reference?: string;
    statement_reference?: string;
    statement_date: string;
    currency_code: string;
    opening_balance?: number;
    closing_balance?: number;
  }) =>
    apiClient
      .post<FinanceReconciliationBatch>(
        '/tenant/finance/reconciliation-batches',
        data,
      )
      .then((r) => r.data),
  importReconciliationBatch: (
    id: string,
    data: {
      file_hash?: string;
      items: Array<{
        line_number?: number;
        transaction_date: string;
        value_date?: string;
        description?: string;
        external_reference?: string;
        payer_reference?: string;
        amount: number;
        currency_code: string;
      }>;
    },
  ) =>
    apiClient
      .post<FinanceReconciliationBatch>(
        `/tenant/finance/reconciliation-batches/${id}/import`,
        data,
      )
      .then((r) => r.data),
  autoMatchReconciliationBatch: (id: string) =>
    apiClient
      .post<FinanceReconciliationBatch>(
        `/tenant/finance/reconciliation-batches/${id}/auto-match`,
      )
      .then((r) => r.data),
  approveReconciliationBatch: (id: string, data: { idempotency_key: string }) =>
    apiClient
      .post<FinanceReconciliationBatch>(
        `/tenant/finance/reconciliation-batches/${id}/approve`,
        data,
      )
      .then((r) => r.data),
  postReconciliationBatch: (id: string, data: { idempotency_key: string }) =>
    apiClient
      .post<FinanceReconciliationBatch>(
        `/tenant/finance/reconciliation-batches/${id}/post`,
        data,
      )
      .then((r) => r.data),
  matchReconciliationItem: (
    id: string,
    data: {
      payment_transaction_id?: string;
      receipt_id?: string;
      reason?: string;
    },
  ) =>
    apiClient
      .post(`/tenant/finance/reconciliation-items/${id}/match`, data)
      .then((r) => r.data),
  excludeReconciliationItem: (id: string, data: { reason?: string }) =>
    apiClient
      .post(`/tenant/finance/reconciliation-items/${id}/exclude`, data)
      .then((r) => r.data),

  getCommissionAccruals: (params?: FinanceListParams) =>
    getPage<FinanceCommissionAccrual>(
      '/tenant/finance/commission-accruals',
      params,
    ),
  getCommissionAccrual: (id: string) =>
    apiClient
      .get<FinanceCommissionAccrual>(
        `/tenant/finance/commission-accruals/${id}`,
      )
      .then((r) => r.data),
  approveCommissionAccrual: (id: string, data: { idempotency_key: string }) =>
    apiClient
      .post<FinanceCommissionAccrual>(
        `/tenant/finance/commission-accruals/${id}/approve`,
        data,
      )
      .then((r) => r.data),
  reverseCommissionAccrual: (
    id: string,
    data: { reason: string; idempotency_key: string },
  ) =>
    apiClient
      .post<FinanceCommissionAccrual>(
        `/tenant/finance/commission-accruals/${id}/reverse`,
        data,
      )
      .then((r) => r.data),

  getCommissionPayments: (params?: FinanceListParams) =>
    getPage<FinanceCommissionPayment>(
      '/tenant/finance/commission-payments',
      params,
    ),
  getCommissionPayment: (id: string) =>
    apiClient
      .get<FinanceCommissionPayment>(
        `/tenant/finance/commission-payments/${id}`,
      )
      .then((r) => r.data),
  createCommissionPayment: (data: {
    intermediary_company_id: string;
    payment_method: string;
    payment_reference: string;
    amount: number;
    currency_code: string;
    allocations: Array<{
      commission_transaction_id: string;
      amount: number;
    }>;
    idempotency_key: string;
  }) =>
    apiClient
      .post<FinanceCommissionPayment>(
        '/tenant/finance/commission-payments',
        data,
      )
      .then((r) => r.data),
  approveCommissionPayment: (id: string, data: { idempotency_key: string }) =>
    apiClient
      .post<FinanceCommissionPayment>(
        `/tenant/finance/commission-payments/${id}/approve`,
        data,
      )
      .then((r) => r.data),
  payCommissionPayment: (id: string, data: { idempotency_key: string }) =>
    apiClient
      .post<FinanceCommissionPayment>(
        `/tenant/finance/commission-payments/${id}/pay`,
        data,
      )
      .then((r) => r.data),
  reverseCommissionPayment: (
    id: string,
    data: { reason: string; idempotency_key: string },
  ) =>
    apiClient
      .post<FinanceCommissionPayment>(
        `/tenant/finance/commission-payments/${id}/reverse`,
        data,
      )
      .then((r) => r.data),

  getJournals: (params?: FinanceListParams) =>
    getPage<FinanceJournalEntry>('/tenant/finance/journals', params),
  getJournal: (id: string) =>
    apiClient
      .get<FinanceJournalEntry>(`/tenant/finance/journals/${id}`)
      .then((r) => r.data),
};
