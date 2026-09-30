import { apiClient } from '@/modules/shared/api/client';
import {
  normalizePaginatedResponse,
  type PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  ClaimantPayload,
  ClaimClaimant,
  ClaimDetail,
  ClaimListItem,
  ClaimListParams,
  ClaimRegulatoryOperation,
  ClaimSubmissionResult,
  ClaimTimelineEvent,
  CreateClaimPayload,
  PolicyLookupDetail,
  PolicyLookupResult,
} from './types';

const BASE = '/tenant/claims';

export const claimsApi = {
  list: async (
    params?: ClaimListParams,
  ): Promise<PaginatedResponse<ClaimListItem>> => {
    const response = await apiClient.get<{
      data: ClaimListItem[];
      meta?: unknown;
      pagination?: unknown;
    }>(BASE, { params });
    return normalizePaginatedResponse({
      ...response.data,
      data: response.data.data ?? [],
    });
  },

  get: (id: string) =>
    apiClient.get<ClaimDetail>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: CreateClaimPayload) =>
    apiClient.post<ClaimDetail>(BASE, data).then((r) => r.data),

  /** Draft edits; the policy cannot change and claimants have their own routes. */
  update: (id: string, data: Partial<Omit<CreateClaimPayload, 'claimants'>>) =>
    apiClient.patch<ClaimDetail>(`${BASE}/${id}`, data).then((r) => r.data),

  removeDraft: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`${BASE}/${id}`).then((r) => r.data),

  policyLookup: (q: string, limit = 10) =>
    apiClient
      .get<PolicyLookupResult[]>(`${BASE}/policy-lookup`, {
        params: { q, limit },
      })
      .then((r) => r.data),

  policyDetail: (policyId: string) =>
    apiClient
      .get<PolicyLookupDetail>(`${BASE}/policy-lookup/${policyId}`)
      .then((r) => r.data),

  addClaimant: (id: string, data: ClaimantPayload) =>
    apiClient
      .post<ClaimClaimant>(`${BASE}/${id}/claimants`, data)
      .then((r) => r.data),

  updateClaimant: (claimantId: string, data: Partial<ClaimantPayload>) =>
    apiClient
      .patch<ClaimClaimant>(`${BASE}/claimants/${claimantId}`, data)
      .then((r) => r.data),

  removeClaimant: (claimantId: string) =>
    apiClient
      .delete<{ removed: boolean }>(`${BASE}/claimants/${claimantId}`)
      .then((r) => r.data),

  submitNotification: (id: string) =>
    apiClient
      .post<ClaimSubmissionResult>(`${BASE}/${id}/notification/submit`, {})
      .then((r) => r.data),

  retryNotification: (id: string) =>
    apiClient
      .post<ClaimSubmissionResult>(`${BASE}/${id}/notification/retry`)
      .then((r) => r.data),

  timeline: (id: string) =>
    apiClient
      .get<ClaimTimelineEvent[]>(`${BASE}/${id}/timeline`)
      .then((r) => r.data),

  tiraTransactions: (id: string) =>
    apiClient
      .get<ClaimRegulatoryOperation[]>(`${BASE}/${id}/tira-transactions`)
      .then((r) => r.data),
};
