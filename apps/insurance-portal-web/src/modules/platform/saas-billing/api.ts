import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';

export interface SaasTableParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: string;
  billing_interval?: string;
  company_id?: string;
}

export interface SaasBillingSummary {
  activeSubscriptions: number;
  openCycles: number;
  invoiceBalance: string;
  overdueInvoices: number;
  currency: string | null;
}

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  status: string;
  billing_interval: string;
  currency: string;
  base_price: string;
  trial_days: number;
  current_version_number: number;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  subscription_no: string;
  status: string;
  billing_interval: string;
  currency: string;
  base_price: string;
  started_at: string;
  trial_ends_at?: string | null;
  current_period_start: string;
  current_period_end: string;
  next_billing_at?: string | null;
  cancel_at_period_end: boolean;
}

export interface SaasBillingCycle {
  id: string;
  subscription_id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  base_amount: string;
  usage_amount: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  status: string;
  calculated_at?: string | null;
}

export interface SaasInvoice {
  id: string;
  cycle_id: string;
  subscription_id: string;
  company_id: string;
  invoice_no: string;
  currency: string;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  paid_amount: string;
  balance_amount: string;
  status: string;
  due_at?: string | null;
  issued_at?: string | null;
  created_at: string;
}

export interface SaasInvoiceAdjustment {
  id: string;
  invoice_id: string;
  adjustment_type: string;
  amount: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface SaasOperationResult {
  trialsExpired?: number;
  cyclesProcessed?: number;
  invoicesIssued?: number;
  processed?: number;
}

export interface RecordPaymentPayload {
  amount: string;
  payment_reference: string;
  payment_date?: string;
  notes?: string;
}

export interface CreateAdjustmentPayload {
  adjustment_type: 'CREDIT' | 'DEBIT' | 'WRITE_OFF';
  amount: string;
  reason: string;
}

export const saasBillingApi = {
  listPlans: () =>
    apiClient.get<SaasPlan[]>('/platform/saas/plans').then((r) => r.data),

  listSubscriptions: () =>
    apiClient
      .get<CompanySubscription[]>('/platform/saas/subscriptions')
      .then((r) => r.data),

  listCycles: () =>
    apiClient
      .get<SaasBillingCycle[]>('/platform/saas/cycles')
      .then((r) => r.data),

  listInvoices: () =>
    apiClient.get<SaasInvoice[]>('/platform/saas/invoices').then((r) => r.data),

  /** GET /platform/saas/invoices?page=… — server-side paginated */
  listInvoicesPage: (params: SaasTableParams, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<SaasInvoice>>('/platform/saas/invoices', {
        params,
        signal,
      })
      .then((r) => r.data),

  /** GET /platform/saas/cycles?page=… — server-side paginated */
  listCyclesPage: (params: SaasTableParams, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<SaasBillingCycle>>('/platform/saas/cycles', {
        params,
        signal,
      })
      .then((r) => r.data),

  /** GET /platform/saas/subscriptions?page=… — server-side paginated */
  listSubscriptionsPage: (params: SaasTableParams, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<CompanySubscription>>(
        '/platform/saas/subscriptions',
        { params, signal },
      )
      .then((r) => r.data),

  /** GET /platform/saas/summary — aggregate billing metrics */
  getSummary: (signal?: AbortSignal) =>
    apiClient
      .get<SaasBillingSummary>('/platform/saas/summary', { signal })
      .then((r) => r.data),

  listInvoiceAdjustments: (invoiceId: string) =>
    apiClient
      .get<SaasInvoiceAdjustment[]>(
        `/platform/saas/invoices/${invoiceId}/adjustments`,
      )
      .then((r) => r.data),

  processBilling: () =>
    apiClient
      .post<SaasOperationResult>('/platform/saas/operations/process-billing')
      .then((r) => r.data),

  processDunning: () =>
    apiClient
      .post<SaasOperationResult>('/platform/saas/operations/process-dunning')
      .then((r) => r.data),

  processScheduledChanges: () =>
    apiClient
      .post<SaasOperationResult>(
        '/platform/saas/operations/process-scheduled-changes',
      )
      .then((r) => r.data),

  issueInvoice: (cycleId: string) =>
    apiClient
      .post<SaasInvoice>(`/platform/saas/cycles/${cycleId}/issue-invoice`)
      .then((r) => r.data),

  recordPayment: (invoiceId: string, payload: RecordPaymentPayload) =>
    apiClient
      .post(`/platform/saas/invoices/${invoiceId}/payments`, payload)
      .then((r) => r.data),

  voidInvoice: (invoiceId: string, reason: string) =>
    apiClient
      .post(`/platform/saas/invoices/${invoiceId}/void`, { reason })
      .then((r) => r.data),

  createAdjustment: (invoiceId: string, payload: CreateAdjustmentPayload) =>
    apiClient
      .post(`/platform/saas/invoices/${invoiceId}/adjustments`, payload)
      .then((r) => r.data),

  approveAdjustment: (adjustmentId: string) =>
    apiClient
      .post(`/platform/saas/invoice-adjustments/${adjustmentId}/approve`)
      .then((r) => r.data),
};
