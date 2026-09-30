import { apiClient } from '@/modules/shared/api/client';
import {
  normalizePaginatedResponse,
  type PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  ApprovalLimit,
  ApprovalLimitPayload,
  AssessmentPayload,
  ClaimApproval,
  ClaimAssessment,
  ClaimIntimation,
  ClaimReserve,
  DeclinePayload,
  IntimationPayload,
  ReservePayload,
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

  // Intimation (§10) and the reserve ledger ---------------------------------
  createIntimation: (id: string, data: IntimationPayload) =>
    apiClient
      .post<ClaimIntimation>(`${BASE}/${id}/intimations`, data)
      .then((r) => r.data),

  updateIntimation: (intimationId: string, data: Partial<IntimationPayload>) =>
    apiClient
      .patch<ClaimIntimation>(`${BASE}/intimations/${intimationId}`, data)
      .then((r) => r.data),

  submitIntimation: (intimationId: string, retry?: boolean) =>
    apiClient
      .post(
        `${BASE}/intimations/${intimationId}/submit`,
        retry ? { retry } : {},
      )
      .then((r) => r.data),

  createReserve: (id: string, data: ReservePayload) =>
    apiClient
      .post<ClaimReserve>(`${BASE}/${id}/reserves`, data)
      .then((r) => r.data),

  approveReserve: (reserveId: string, comments?: string) =>
    apiClient
      .post(`${BASE}/reserves/${reserveId}/approve`, { comments })
      .then((r) => r.data),

  declineReserve: (reserveId: string, comments: string) =>
    apiClient
      .post(`${BASE}/reserves/${reserveId}/decline`, { comments })
      .then((r) => r.data),

  releaseReserve: (reserveId: string, reason: string) =>
    apiClient
      .post(`${BASE}/reserves/${reserveId}/release`, { reason })
      .then((r) => r.data),

  // Assessment (§11) and approvals -----------------------------------------
  createAssessment: (id: string, data: AssessmentPayload) =>
    apiClient
      .post<ClaimAssessment>(`${BASE}/${id}/assessments`, data)
      .then((r) => r.data),

  updateAssessment: (assessmentId: string, data: Partial<AssessmentPayload>) =>
    apiClient
      .patch<ClaimAssessment>(`${BASE}/assessments/${assessmentId}`, data)
      .then((r) => r.data),

  submitAssessment: (assessmentId: string) =>
    apiClient
      .post(`${BASE}/assessments/${assessmentId}/submit`)
      .then((r) => r.data),

  approveAssessment: (assessmentId: string, comments?: string) =>
    apiClient
      .post<{
        completed: boolean;
      }>(`${BASE}/assessments/${assessmentId}/approve`, { comments })
      .then((r) => r.data),

  declineAssessment: (assessmentId: string, data: DeclinePayload) =>
    apiClient
      .post(`${BASE}/assessments/${assessmentId}/decline`, data)
      .then((r) => r.data),

  submitAssessmentToTiramis: (assessmentId: string, retry?: boolean) =>
    apiClient
      .post(
        `${BASE}/assessments/${assessmentId}/tiramis`,
        retry ? { retry } : {},
      )
      .then((r) => r.data),

  approvals: (id: string) =>
    apiClient
      .get<ClaimApproval[]>(`${BASE}/${id}/approvals`)
      .then((r) => r.data),

  approvalLimits: () =>
    apiClient
      .get<ApprovalLimit[]>(`${BASE}/configuration/approval-limits`)
      .then((r) => r.data),

  saveApprovalLimit: (data: ApprovalLimitPayload) =>
    apiClient
      .put<ApprovalLimit>(`${BASE}/configuration/approval-limits`, data)
      .then((r) => r.data),

  deactivateApprovalLimit: (limitId: string) =>
    apiClient
      .delete<ApprovalLimit>(`${BASE}/configuration/approval-limits/${limitId}`)
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
