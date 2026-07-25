import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  BackendPaginatedResponse,
  PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  BillingListParams,
  CommissionPaymentPayload,
  CommissionPaymentRecord,
  CommissionPaymentPage,
  CommissionTransactionPayload,
  CommissionTransactionRecord,
  CommissionTransactionPage,
  InvoicePayload,
  InvoicePage,
  InvoiceRecord,
  PaymentTransactionPayload,
  PaymentTransactionPage,
  PaymentTransactionRecord,
  ReceiptPayload,
  ReceiptPage,
  ReceiptRecord,
} from './types';

export const billingApi = {
  getInvoices: async (params?: BillingListParams): Promise<InvoicePage> => {
    const response = await apiClient.get<
      BackendPaginatedResponse<InvoiceRecord> | PaginatedResponse<InvoiceRecord>
    >('/tenant/billing/invoices', { params });
    return normalizePaginatedResponse<InvoiceRecord>(response.data);
  },
  getInvoice: (id: string) =>
    apiClient
      .get<InvoiceRecord>(`/tenant/billing/invoices/${id}`)
      .then((r) => r.data),
  createInvoice: (data: InvoicePayload) =>
    apiClient
      .post<InvoiceRecord>('/tenant/billing/invoices', data)
      .then((r) => r.data),
  updateInvoice: (id: string, data: Partial<InvoicePayload>) =>
    apiClient
      .patch<InvoiceRecord>(`/tenant/billing/invoices/${id}`, data)
      .then((r) => r.data),
  deleteInvoice: (id: string) =>
    apiClient.delete(`/tenant/billing/invoices/${id}`).then((r) => r.data),

  getReceipts: async (params?: BillingListParams): Promise<ReceiptPage> => {
    const response = await apiClient.get<
      BackendPaginatedResponse<ReceiptRecord> | PaginatedResponse<ReceiptRecord>
    >('/tenant/billing/receipts', { params });
    return normalizePaginatedResponse<ReceiptRecord>(response.data);
  },
  getReceipt: (id: string) =>
    apiClient
      .get<ReceiptRecord>(`/tenant/billing/receipts/${id}`)
      .then((r) => r.data),
  createReceipt: (data: ReceiptPayload) =>
    apiClient
      .post<ReceiptRecord>('/tenant/billing/receipts', data)
      .then((r) => r.data),
  updateReceipt: (id: string, data: Partial<ReceiptPayload>) =>
    apiClient
      .patch<ReceiptRecord>(`/tenant/billing/receipts/${id}`, data)
      .then((r) => r.data),
  deleteReceipt: (id: string) =>
    apiClient.delete(`/tenant/billing/receipts/${id}`).then((r) => r.data),

  getPaymentTransactions: async (
    params?: BillingListParams,
  ): Promise<PaymentTransactionPage> => {
    const response = await apiClient.get<
      | BackendPaginatedResponse<PaymentTransactionRecord>
      | PaginatedResponse<PaymentTransactionRecord>
    >('/tenant/billing/payment-transactions', { params });
    return normalizePaginatedResponse<PaymentTransactionRecord>(response.data);
  },
  getPaymentTransaction: (id: string) =>
    apiClient
      .get<PaymentTransactionRecord>(
        `/tenant/billing/payment-transactions/${id}`,
      )
      .then((r) => r.data),
  createPaymentTransaction: (data: PaymentTransactionPayload) =>
    apiClient
      .post<PaymentTransactionRecord>(
        '/tenant/billing/payment-transactions',
        data,
      )
      .then((r) => r.data),
  updatePaymentTransaction: (
    id: string,
    data: Partial<PaymentTransactionPayload>,
  ) =>
    apiClient
      .patch<PaymentTransactionRecord>(
        `/tenant/billing/payment-transactions/${id}`,
        data,
      )
      .then((r) => r.data),
  deletePaymentTransaction: (id: string) =>
    apiClient
      .delete(`/tenant/billing/payment-transactions/${id}`)
      .then((r) => r.data),

  getCommissionTransactions: async (
    params?: BillingListParams,
  ): Promise<CommissionTransactionPage> => {
    const response = await apiClient.get<
      | BackendPaginatedResponse<CommissionTransactionRecord>
      | PaginatedResponse<CommissionTransactionRecord>
    >('/tenant/billing/commission-transactions', { params });
    return normalizePaginatedResponse<CommissionTransactionRecord>(
      response.data,
    );
  },
  getCommissionTransaction: (id: string) =>
    apiClient
      .get<CommissionTransactionRecord>(
        `/tenant/billing/commission-transactions/${id}`,
      )
      .then((r) => r.data),
  createCommissionTransaction: (data: CommissionTransactionPayload) =>
    apiClient
      .post<CommissionTransactionRecord>(
        '/tenant/billing/commission-transactions',
        data,
      )
      .then((r) => r.data),
  updateCommissionTransaction: (
    id: string,
    data: Partial<CommissionTransactionPayload>,
  ) =>
    apiClient
      .patch<CommissionTransactionRecord>(
        `/tenant/billing/commission-transactions/${id}`,
        data,
      )
      .then((r) => r.data),
  deleteCommissionTransaction: (id: string) =>
    apiClient
      .delete(`/tenant/billing/commission-transactions/${id}`)
      .then((r) => r.data),

  getCommissionPayments: async (
    params?: BillingListParams,
  ): Promise<CommissionPaymentPage> => {
    const response = await apiClient.get<
      | BackendPaginatedResponse<CommissionPaymentRecord>
      | PaginatedResponse<CommissionPaymentRecord>
    >('/tenant/billing/commission-payments', { params });
    return normalizePaginatedResponse<CommissionPaymentRecord>(response.data);
  },
  getCommissionPayment: (id: string) =>
    apiClient
      .get<CommissionPaymentRecord>(`/tenant/billing/commission-payments/${id}`)
      .then((r) => r.data),
  createCommissionPayment: (data: CommissionPaymentPayload) =>
    apiClient
      .post<CommissionPaymentRecord>(
        '/tenant/billing/commission-payments',
        data,
      )
      .then((r) => r.data),
  updateCommissionPayment: (
    id: string,
    data: Partial<CommissionPaymentPayload>,
  ) =>
    apiClient
      .patch<CommissionPaymentRecord>(
        `/tenant/billing/commission-payments/${id}`,
        data,
      )
      .then((r) => r.data),
  deleteCommissionPayment: (id: string) =>
    apiClient
      .delete(`/tenant/billing/commission-payments/${id}`)
      .then((r) => r.data),
};
