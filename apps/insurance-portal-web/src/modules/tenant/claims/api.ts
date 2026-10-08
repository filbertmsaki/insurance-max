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
  ClaimDisbursement,
  ClaimDischargeVoucher,
  ClaimPayment,
  PaymentPayload,
  VoucherAdjustPayload,
  VoucherPayload,
  VoucherResponsePayload,
  ClaimDocumentRecord,
  ClaimDocumentsView,
  ClaimIntimation,
  ClaimNumberFormat,
  ClaimNumberFormatPayload,
  ClaimRejection,
  ClaimReserve,
  ClaimRecovery,
  ClaimRecoveryType,
  ClaimsDashboardParams,
  ClaimsDashboardSummary,
  DocumentRequirement,
  DocumentRequirementPayload,
  RejectionPayload,
  UploadSessionPayload,
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

  // Discharge voucher (§12) ------------------------------------------------
  createVoucher: (id: string, data: VoucherPayload) =>
    apiClient
      .post<ClaimDischargeVoucher>(`${BASE}/${id}/discharge-vouchers`, data)
      .then((r) => r.data),

  updateVoucher: (voucherId: string, data: Partial<VoucherPayload>) =>
    apiClient
      .patch<ClaimDischargeVoucher>(
        `${BASE}/discharge-vouchers/${voucherId}`,
        data,
      )
      .then((r) => r.data),

  submitVoucher: (voucherId: string) =>
    apiClient
      .post(`${BASE}/discharge-vouchers/${voucherId}/submit`)
      .then((r) => r.data),

  approveVoucher: (voucherId: string, comments?: string) =>
    apiClient
      .post<{
        completed: boolean;
      }>(`${BASE}/discharge-vouchers/${voucherId}/approve`, { comments })
      .then((r) => r.data),

  declineVoucher: (voucherId: string, data: DeclinePayload) =>
    apiClient
      .post(`${BASE}/discharge-vouchers/${voucherId}/decline`, data)
      .then((r) => r.data),

  respondToVoucher: (voucherId: string, data: VoucherResponsePayload) =>
    apiClient
      .post(`${BASE}/discharge-vouchers/${voucherId}/respond`, data)
      .then((r) => r.data),

  adjustVoucher: (voucherId: string, data: VoucherAdjustPayload) =>
    apiClient
      .post(`${BASE}/discharge-vouchers/${voucherId}/adjust`, data)
      .then((r) => r.data),

  submitVoucherToTiramis: (voucherId: string, retry?: boolean) =>
    apiClient
      .post(
        `${BASE}/discharge-vouchers/${voucherId}/tiramis`,
        retry ? { retry } : {},
      )
      .then((r) => r.data),

  generateVoucherDocument: (voucherId: string) =>
    apiClient
      .post<{
        id: string;
        title?: string | null;
      }>(`${BASE}/discharge-vouchers/${voucherId}/generate-document`)
      .then((r) => r.data),

  // Payments (§13) and disbursement -----------------------------------------
  createPayment: (id: string, data: PaymentPayload) =>
    apiClient
      .post<ClaimPayment>(`${BASE}/${id}/payments`, data)
      .then((r) => r.data),

  submitPayment: (paymentId: string) =>
    apiClient.post(`${BASE}/payments/${paymentId}/submit`).then((r) => r.data),

  approvePayment: (paymentId: string, comments?: string) =>
    apiClient
      .post<{ completed: boolean }>(`${BASE}/payments/${paymentId}/approve`, {
        comments,
      })
      .then((r) => r.data),

  declinePayment: (paymentId: string, data: DeclinePayload) =>
    apiClient
      .post(`${BASE}/payments/${paymentId}/decline`, data)
      .then((r) => r.data),

  cancelPayment: (paymentId: string, reason: string) =>
    apiClient
      .post(`${BASE}/payments/${paymentId}/cancel`, { reason })
      .then((r) => r.data),

  submitPaymentToTiramis: (paymentId: string, retry?: boolean) =>
    apiClient
      .post(`${BASE}/payments/${paymentId}/tiramis`, retry ? { retry } : {})
      .then((r) => r.data),

  /** Idempotent per key, so a double click never requests two transfers. */
  requestDisbursement: (paymentId: string, idempotencyKey: string) =>
    apiClient
      .post<ClaimDisbursement>(
        `${BASE}/payments/${paymentId}/request-disbursement`,
        { idempotency_key: idempotencyKey },
      )
      .then((r) => r.data),

  confirmDisbursement: (
    disbursementId: string,
    data: { payment_method: string; provider_reference?: string },
  ) =>
    apiClient
      .post<ClaimDisbursement>(
        `${BASE}/disbursements/${disbursementId}/confirm`,
        data,
      )
      .then((r) => r.data),

  failDisbursement: (disbursementId: string, reason: string) =>
    apiClient
      .post(`${BASE}/disbursements/${disbursementId}/fail`, { reason })
      .then((r) => r.data),

  reverseDisbursement: (disbursementId: string, reason: string) =>
    apiClient
      .post(`${BASE}/disbursements/${disbursementId}/reverse`, { reason })
      .then((r) => r.data),

  // Rejection (§14) ---------------------------------------------------------
  createRejection: (id: string, data: RejectionPayload) =>
    apiClient
      .post<ClaimRejection>(`${BASE}/${id}/rejections`, data)
      .then((r) => r.data),

  approveRejection: (rejectionId: string, comments?: string) =>
    apiClient
      .post<{
        completed: boolean;
      }>(`${BASE}/rejections/${rejectionId}/approve`, { comments })
      .then((r) => r.data),

  declineRejection: (rejectionId: string, comments: string) =>
    apiClient
      .post(`${BASE}/rejections/${rejectionId}/decline`, { comments })
      .then((r) => r.data),

  submitRejectionToTiramis: (rejectionId: string, retry?: boolean) =>
    apiClient
      .post(`${BASE}/rejections/${rejectionId}/tiramis`, retry ? { retry } : {})
      .then((r) => r.data),

  generateRejectionLetter: (rejectionId: string) =>
    apiClient
      .post<{
        id: string;
        title?: string | null;
      }>(`${BASE}/rejections/${rejectionId}/generate-letter`)
      .then((r) => r.data),

  // Documents ----------------------------------------------------------------
  documents: (id: string) =>
    apiClient
      .get<ClaimDocumentsView>(`${BASE}/${id}/documents`)
      .then((r) => r.data),

  /** Step 1 of an upload: a registry upload session scoped to the claim. */
  createDocumentUploadSession: (id: string, data: UploadSessionPayload) =>
    apiClient
      .post<{
        id: string;
        token: string;
        maximum_bytes?: number;
        allowed_mime_types?: string[];
      }>(`${BASE}/${id}/documents/upload-session`, data)
      .then((r) => r.data),

  /** Step 3: attach the uploaded registry document to the claim. */
  linkDocument: (
    id: string,
    data: UploadSessionPayload & { document_id: string },
  ) =>
    apiClient
      .post<ClaimDocumentRecord>(`${BASE}/${id}/documents/link`, data)
      .then((r) => r.data),

  verifyDocument: (
    documentId: string,
    data: { decision: 'VERIFIED' | 'REJECTED'; rejection_reason?: string },
  ) =>
    apiClient
      .post<ClaimDocumentRecord>(`${BASE}/documents/${documentId}/verify`, data)
      .then((r) => r.data),

  /** Company-wide register behind the Claims → Documents menu. */
  documentRegister: async (params: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ClaimDocumentRecord>> => {
    const response = await apiClient.get<{
      data: ClaimDocumentRecord[];
      meta?: unknown;
    }>(`${BASE}/documents`, { params });
    return normalizePaginatedResponse({
      ...response.data,
      data: response.data.data ?? [],
    });
  },

  dashboard: (params?: ClaimsDashboardParams) =>
    apiClient
      .get<ClaimsDashboardSummary>(`${BASE}/dashboard/summary`, { params })
      .then((r) => r.data),

  closeClaim: (id: string, closureReason: string) =>
    apiClient
      .post<ClaimDetail>(`${BASE}/${id}/close`, {
        closure_reason: closureReason,
      })
      .then((r) => r.data),

  recoveries: (claimId: string) =>
    apiClient
      .get<ClaimRecovery[]>(`${BASE}/${claimId}/recoveries`)
      .then((r) => r.data),

  createRecovery: (
    claimId: string,
    data: { recovery_type: ClaimRecoveryType; expected_amount: string; notes?: string },
  ) =>
    apiClient
      .post<ClaimRecovery>(`${BASE}/${claimId}/recoveries`, data)
      .then((r) => r.data),

  requestRecovery: (id: string) =>
    apiClient.post<ClaimRecovery>(`${BASE}/recoveries/${id}/request`).then((r) => r.data),

  recordRecoveryReceipt: (id: string, received_amount: string, notes?: string) =>
    apiClient
      .post<ClaimRecovery>(`${BASE}/recoveries/${id}/record-receipt`, { received_amount, notes })
      .then((r) => r.data),

  writeOffRecovery: (id: string, reason: string) =>
    apiClient
      .post<ClaimRecovery>(`${BASE}/recoveries/${id}/write-off`, { reason })
      .then((r) => r.data),

  cancelRecovery: (id: string) =>
    apiClient.post<ClaimRecovery>(`${BASE}/recoveries/${id}/cancel`).then((r) => r.data),

  reopenClaim: (id: string, reason: string) =>
    apiClient
      .post<ClaimDetail>(`${BASE}/${id}/reopen`, { reason })
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

  numberFormats: () =>
    apiClient
      .get<ClaimNumberFormat[]>(`${BASE}/configuration/number-formats`)
      .then((r) => r.data),

  saveNumberFormat: (data: ClaimNumberFormatPayload) =>
    apiClient
      .put<ClaimNumberFormat>(`${BASE}/configuration/number-formats`, data)
      .then((r) => r.data),

  resetNumberFormat: (documentType: string) =>
    apiClient
      .delete<ClaimNumberFormat>(
        `${BASE}/configuration/number-formats/${documentType}`,
      )
      .then((r) => r.data),

  documentRequirements: () =>
    apiClient
      .get<DocumentRequirement[]>(`${BASE}/configuration/document-requirements`)
      .then((r) => r.data),

  saveDocumentRequirement: (data: DocumentRequirementPayload) =>
    apiClient
      .put<DocumentRequirement>(
        `${BASE}/configuration/document-requirements`,
        data,
      )
      .then((r) => r.data),

  deactivateDocumentRequirement: (requirementId: string) =>
    apiClient
      .delete<DocumentRequirement>(
        `${BASE}/configuration/document-requirements/${requirementId}`,
      )
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
