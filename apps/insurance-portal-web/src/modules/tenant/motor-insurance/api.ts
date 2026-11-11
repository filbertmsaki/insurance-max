import type { UnderwriteLine } from '@insurance-max/contracts';
import { apiClient } from '@/modules/shared/api/client';
import {
  normalizePaginatedResponse,
  readListSummary,
  type PaginatedResponse,
  type PaginatedWithSummary,
} from '@/modules/shared/api/pagination';
import type {
  PolicyListParams,
  PolicyRecord,
} from '@/modules/tenant/policies/types';
import type {
  QuotationListItem,
  QuotationListParams,
} from '@/modules/tenant/quotations/types';
import type { UnderwriteTableParams } from '@/modules/tenant/underwrite/api';
import type {
  UnderwritePolicyTransactionRow,
  UnderwriteRenewalRow,
  UnderwriteTiraQueueRow,
} from '@/modules/tenant/underwrite/types';

const BASE = '/tenant/motor-insurance';

export type MotorInsuranceType = 'single' | 'fleet';

export type MotorInsurancePolicy = PolicyRecord & {
  business_line?: UnderwriteLine | null;
};

type QuotationListResponse =
  | { items: QuotationListItem[]; meta: unknown }
  | { data: QuotationListItem[]; meta: unknown };

export const motorInsuranceApi = {
  getQuotations: async (
    params: Omit<QuotationListParams, 'quotation_type' | 'quotation_flow'> & {
      type?: MotorInsuranceType;
    },
    signal?: AbortSignal,
  ): Promise<PaginatedWithSummary<QuotationListItem>> => {
    const response = await apiClient.get<QuotationListResponse>(
      `${BASE}/quotations`,
      { params, signal },
    );
    const body = response.data;
    return {
      ...normalizePaginatedResponse<QuotationListItem>(
        'items' in body ? { data: body.items, meta: body.meta } : body,
      ),
      summary: readListSummary(body),
    };
  },

  getPolicies: async (
    params: PolicyListParams & { type?: MotorInsuranceType },
    signal?: AbortSignal,
  ): Promise<PaginatedWithSummary<MotorInsurancePolicy>> => {
    const response = await apiClient.get(`${BASE}/policies`, {
      params,
      signal,
    });
    return {
      ...normalizePaginatedResponse<MotorInsurancePolicy>(response.data),
      summary: readListSummary(response.data),
    };
  },

  resolveQuotationLine: (id: string) =>
    apiClient
      .get<{
        id: string;
        line: UnderwriteLine;
      }>(`${BASE}/quotations/${id}/line`)
      .then((response) => response.data),

  resolvePolicyLine: (id: string) =>
    apiClient
      .get<{ id: string; line: UnderwriteLine }>(`${BASE}/policies/${id}/line`)
      .then((response) => response.data),
};

/** Combined Motor + Fleet transaction lists (MF-5). */
export const motorInsuranceTransactionsApi = {
  listRenewals: (params: UnderwriteTableParams, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<UnderwriteRenewalRow>>(`${BASE}/renewals`, {
        params,
        signal,
      })
      .then((response) => response.data),

  listTransactions: (
    kind: 'endorsements' | 'cancellations',
    params: UnderwriteTableParams,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<
        PaginatedResponse<UnderwritePolicyTransactionRow>
      >(`${BASE}/${kind}`, { params, signal })
      .then((response) => response.data),

  getTiraQueue: async (
    kind: 'failed' | 'pending',
    params: UnderwriteTableParams,
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<UnderwriteTiraQueueRow>> => {
    const response = await apiClient.get(
      `${BASE}/${kind === 'failed' ? 'tira-failed' : 'tira-pending'}`,
      { params, signal },
    );
    return normalizePaginatedResponse<UnderwriteTiraQueueRow>(response.data);
  },
};

export const motorInsuranceKeys = {
  all: ['motor-insurance'] as const,
  quotations: () => [...motorInsuranceKeys.all, 'quotations'] as const,
  policies: () => [...motorInsuranceKeys.all, 'policies'] as const,
  line: (kind: 'quotation' | 'policy', id: string) =>
    [...motorInsuranceKeys.all, kind, id, 'line'] as const,
};
