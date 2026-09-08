import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  BackendPaginatedResponse,
  PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  PolicyListParams,
  PolicyPayload,
  PolicyRecord,
  PolicyRiskRecord,
  PolicyPremiumBreakdownRecord,
  PolicyStatusHistoryRecord,
  PolicyEndorsementRecord,
  PolicyCancellationRecord,
  CancellationContext,
  PolicyRenewalRecord,
  PolicyTransactionSummary,
  RenewalContext,
  RenewalEligibility,
  PolicyVersionRecord,
  CancellationEligibility,
  CreateCancellationPayload,
  EndorsementEligibility,
  EndorsementTypeRecord,
  CreateEndorsementTypePayload,
  UpdateEndorsementTypePayload,
  CreateEndorsementPayload,
  EndorsementContext,
  RecordEndorsementChangePayload,
} from './types';

export const policiesApi = {
  getList: async (
    params?: PolicyListParams,
  ): Promise<PaginatedResponse<PolicyRecord>> => {
    const response = await apiClient.get<
      BackendPaginatedResponse<PolicyRecord> | PaginatedResponse<PolicyRecord>
    >('/tenant/policies', { params });
    return normalizePaginatedResponse<PolicyRecord>(response.data);
  },
  getById: (id: string) =>
    apiClient.get<PolicyRecord>(`/tenant/policies/${id}`).then((r) => r.data),
  getCurrentVersion: (id: string) =>
    apiClient
      .get<PolicyVersionRecord | null>(`/tenant/policies/${id}/current-version`)
      .then((r) => r.data),
  getPolicyVersions: (id: string) =>
    apiClient
      .get<PolicyVersionRecord[]>(`/tenant/policies/${id}/versions`)
      .then((r) => r.data),
  comparePolicyVersions: (
    policyId: string,
    fromVersion: number,
    toVersion: number,
  ) =>
    apiClient
      .get(
        `/tenant/policies/${policyId}/versions/${fromVersion}/compare/${toVersion}`,
      )
      .then((r) => r.data),
  create: (data: PolicyPayload) =>
    apiClient.post<PolicyRecord>('/tenant/policies', data).then((r) => r.data),
  update: (id: string, data: Partial<PolicyPayload>) =>
    apiClient
      .patch<PolicyRecord>(`/tenant/policies/${id}`, data)
      .then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete(`/tenant/policies/${id}`).then((r) => r.data),
  restore: (id: string) =>
    apiClient.patch(`/tenant/policies/${id}/restore`).then((r) => r.data),
  getRisks: (id: string) =>
    apiClient
      .get<PolicyRiskRecord[]>(`/tenant/policies/${id}/risks`)
      .then((r) => r.data),
  getBreakdowns: (id: string) =>
    apiClient
      .get<PolicyPremiumBreakdownRecord[]>(`/tenant/policies/${id}/breakdowns`)
      .then((r) => r.data),
  getHistory: (id: string) =>
    apiClient
      .get<PolicyStatusHistoryRecord[]>(`/tenant/policies/${id}/history`)
      .then((r) => r.data),
  getEndorsements: async (
    policyId: string,
  ): Promise<PolicyEndorsementRecord[]> => {
    const response = await apiClient.get<PolicyEndorsementRecord[]>(
      '/tenant/endorsements',
      {
        params: {
          policy_id: policyId,
        },
      },
    );
    return response.data;
  },
  listEndorsements: async (
    policyId?: string,
  ): Promise<PolicyEndorsementRecord[]> => {
    const response = await apiClient.get<PolicyEndorsementRecord[]>(
      '/tenant/endorsements',
      { params: { policy_id: policyId } },
    );
    return response.data;
  },
  getEndorsementEligibility: (policyId: string, effectiveDate?: string) =>
    apiClient
      .get<EndorsementEligibility>(
        `/tenant/policies/${policyId}/endorsement-eligibility`,
        {
          params: effectiveDate
            ? {
                effective_date: effectiveDate,
              }
            : undefined,
        },
      )
      .then((response) => response.data),
  getCancellationEligibility: (policyId: string, effectiveDate?: string) =>
    apiClient
      .get<CancellationEligibility>(
        `/tenant/policies/${policyId}/cancellation-eligibility`,
        {
          params: effectiveDate
            ? {
                effective_date: effectiveDate,
              }
            : undefined,
        },
      )
      .then((response) => response.data),
  createCancellation: (policyId: string, payload: CreateCancellationPayload) =>
    apiClient
      .post<PolicyCancellationRecord>(
        `/tenant/policies/${policyId}/cancellations`,
        payload,
      )
      .then((response) => response.data),
  getCancellation: (id: string) =>
    apiClient
      .get<PolicyCancellationRecord>(`/tenant/cancellations/${id}`)
      .then((response) => response.data),
  getPolicyCancellations: (policyId: string) =>
    apiClient
      .get<PolicyCancellationRecord[]>('/tenant/cancellations', {
        params: { policy_id: policyId },
      })
      .then((response) => response.data),
  getPolicyTransaction: (id: string) =>
    apiClient
      .get<PolicyTransactionSummary>(`/tenant/policy-transactions/${id}`)
      .then((response) => response.data),
  getCancellationContext: (id: string) =>
    apiClient
      .get<CancellationContext>(`/tenant/cancellations/${id}/context`)
      .then((response) => response.data),
  completeCancellation: (id: string) =>
    apiClient
      .post(`/tenant/cancellations/${id}/complete`)
      .then((response) => response.data),
  requestCancellationPayment: (id: string) =>
    apiClient
      .post(`/tenant/cancellations/${id}/request-payment`)
      .then((response) => response.data),
  submitCancellationApproval: (id: string) =>
    apiClient
      .post(`/tenant/cancellations/${id}/submit-approval`)
      .then((response) => response.data),
  approveCancellation: (id: string) =>
    apiClient
      .post(`/tenant/cancellations/${id}/approve`)
      .then((response) => response.data),
  submitCancellationToTiramis: (id: string) =>
    apiClient
      .post(`/tenant/cancellations/${id}/submit-tiramis`)
      .then((response) => response.data),
  getRenewalEligibility: (policyId: string) =>
    apiClient
      .get<RenewalEligibility>(
        `/tenant/policies/${policyId}/renewal-eligibility`,
      )
      .then((response) => response.data),
  getPolicyRenewals: (policyId: string) =>
    apiClient
      .get<PolicyRenewalRecord[]>('/tenant/renewals', {
        params: { policy_id: policyId },
      })
      .then((response) => response.data),
  listRenewals: (policyId?: string) =>
    apiClient
      .get<PolicyRenewalRecord[]>('/tenant/renewals', {
        params: { policy_id: policyId },
      })
      .then((response) => response.data),
  createRenewal: (policyId: string) =>
    apiClient
      .post(`/tenant/policies/${policyId}/renewals`)
      .then((response) => response.data),
  getRenewalContext: (renewalId: string) =>
    apiClient
      .get<RenewalContext>(`/tenant/renewals/${renewalId}/context`)
      .then((response) => response.data),
  createRenewalOffer: (renewalId: string) =>
    apiClient
      .post(`/tenant/renewals/${renewalId}/create-offer`)
      .then((response) => response.data),
  sendRenewalOffer: (renewalId: string) =>
    apiClient
      .post(`/tenant/renewals/${renewalId}/send-offer`)
      .then((response) => response.data),
  acceptRenewal: (renewalId: string) =>
    apiClient
      .post(`/tenant/renewals/${renewalId}/accept`)
      .then((response) => response.data),
  declineRenewal: (renewalId: string, reason: string) =>
    apiClient
      .post(`/tenant/renewals/${renewalId}/decline`, { reason })
      .then((response) => response.data),
  getEndorsementTypes: () =>
    apiClient
      .get<EndorsementTypeRecord[]>('/tenant/endorsement-types')
      .then((response) => response.data),
  createEndorsementType: (payload: CreateEndorsementTypePayload) =>
    apiClient
      .post<EndorsementTypeRecord>('/tenant/endorsement-types', payload)
      .then((response) => response.data),
  updateEndorsementType: (id: string, payload: UpdateEndorsementTypePayload) =>
    apiClient
      .patch<EndorsementTypeRecord>(`/tenant/endorsement-types/${id}`, payload)
      .then((response) => response.data),
  createEndorsement: (policyId: string, payload: CreateEndorsementPayload) =>
    apiClient
      .post<PolicyEndorsementRecord>(
        `/tenant/policies/${policyId}/endorsements`,
        payload,
      )
      .then((response) => response.data),
  getEndorsementContext: (endorsementId: string) =>
    apiClient
      .get<EndorsementContext>(`/tenant/endorsements/${endorsementId}/context`)
      .then((response) => response.data),
  recordEndorsementChange: (
    endorsementId: string,
    payload: RecordEndorsementChangePayload,
  ) =>
    apiClient
      .post(`/tenant/endorsements/${endorsementId}/changes`, payload)
      .then((response) => response.data),
  recalculateEndorsement: (endorsementId: string) =>
    apiClient
      .post(`/tenant/endorsements/${endorsementId}/recalculate`)
      .then((response) => response.data),
  completeEndorsement: (endorsementId: string) =>
    apiClient
      .post(`/tenant/endorsements/${endorsementId}/complete`)
      .then((response) => response.data),
  submitEndorsementApproval: (endorsementId: string) =>
    apiClient
      .post(`/tenant/endorsements/${endorsementId}/submit-approval`)
      .then((response) => response.data),
  requestEndorsementPayment: (endorsementId: string) =>
    apiClient
      .post<{
        id: string;
        invoice_no: string;
        status: string;
        total_amount: string;
      }>(`/tenant/endorsements/${endorsementId}/request-payment`)
      .then((response) => response.data),
  submitEndorsementToTiramis: (id: string) =>
    apiClient
      .post(`/tenant/endorsements/${id}/submit-tiramis`)
      .then((r) => r.data),
  retryEndorsementTiramis: (id: string) =>
    apiClient
      .post(`/tenant/endorsements/${id}/retry-tiramis`)
      .then((r) => r.data),
  getEndorsementReconciliation: (id: string) =>
    apiClient
      .get(`/tenant/endorsements/${id}/reconciliation`)
      .then((r) => r.data),
  reconcileEndorsement: (id: string) =>
    apiClient.post(`/tenant/endorsements/${id}/reconcile`).then((r) => r.data),
};
