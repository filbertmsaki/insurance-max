import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { PolicyRecord } from '@/modules/tenant/policies/types';
import type { QuotationRecord } from '@/modules/tenant/quotations/types';

export type TiramisRequestType =
  | 'NON_MOTOR'
  | 'MOTOR'
  | 'MOTOR_FLEET'
  | 'REINSURANCE'
  | 'POLICY'
  | 'CLAIM_NOTIFICATION'
  | 'CLAIM_INTIMATION'
  | 'CLAIM_ASSESSMENT'
  | 'DISCHARGE_VOUCHER'
  | 'CLAIM_PAYMENT'
  | 'CLAIM_REJECTION';

export interface TiramisSalePointRecord {
  id: string;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  salePointCode: string;
  salePointName: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export type TiramisSubmissionStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'SUBMITTED_TO_TIRAMIS'
  | 'SENT_TO_TIRA'
  | 'ACK_SUCCESS'
  | 'ACK_FAILED'
  | 'WAITING_FINAL_RESPONSE'
  | 'FINAL_SUCCESS'
  | 'FINAL_FAILED'
  | 'FINAL_CALLBACK_OVERDUE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CALLBACK_REJECTED';

export type TiramisNotificationSeverity =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR';

export interface TiramisSubmissionEventRecord {
  id: string;
  submission_id: string;
  company_id: string;
  tiramis_transaction_id: string | null;
  request_id: string;
  response_id: string | null;
  event_type: string;
  status_code: string | null;
  status_description: string | null;
  error_message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface TiramisSubmissionRecord {
  id: string;
  company_id: string;
  policy_id: string | null;
  quotation_id: string | null;
  source_module: string | null;
  source_record_id: string | null;
  business_reference: string | null;
  request_type: string | null;
  service_type: string | null;
  root_element: string | null;
  tiramis_transaction_id: string | null;
  tiramis_request_id: string | null;
  tiramis_response_id: string | null;
  status: TiramisSubmissionStatus | string;
  status_code: string | null;
  status_description: string | null;
  cover_note_reference_number: string | null;
  policy_reference_number: string | null;
  sticker_number: string | null;
  last_error: string | null;
  last_payload: Record<string, unknown> | null;
  submitted_at: string | null;
  last_event_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  company?: { id: string; name: string; slug: string } | null;
  policy?: PolicyRecord | null;
  quotation?: QuotationRecord | null;
  events?: TiramisSubmissionEventRecord[];
}

export interface TiramisTrackingRecord {
  id: string;
  requestType: string;
  status: TiramisSubmissionStatus | string;
  sourceService: string;
  sourceCompanyId: string | null;
  sourceUserId: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  policyId: string | null;
  quotationId: string | null;
  businessReference: string | null;
  businessFingerprint: string | null;
  idempotencyKey: string | null;
  duplicateOfTrackingId: string | null;
  duplicatePreventionReason: string | null;
  duplicateCheckedAt: string | null;
  resubmissionCount: number;
  forceResubmitted: boolean;
  forceResubmit: boolean;
  returnExisting: boolean;
  tiramisTransactionId: string | null;
  tiramisRequestId: string | null;
  tiramisServiceType: string | null;
  tiramisRootElement: string | null;
  acknowledgementStatusCode: string | null;
  acknowledgementStatusDesc: string | null;
  lastErrorMessage: string | null;
  requestPayload: Record<string, unknown> | null;
  requestPayloadSnapshot?: Record<string, unknown> | null;
  tiramisResponsePayload: Record<string, unknown> | null;
  responsePayloadSnapshot?: Record<string, unknown> | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  failedAt: string | null;
  finalResponseId: string | null;
  finalResponseStatusCode: string | null;
  finalResponseStatusDesc: string | null;
  finalResponseReceivedAt: string | null;
  finalResponsePayload: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  syncAttempts: number;
  businessRecordSyncedAt: string | null;
  businessRecordSyncError: string | null;
  businessRecordSyncAttempts: number;
  isRetryable: boolean;
  retryAttempts: number;
  maxRetryAttempts: number;
  nextRetryAt: string | null;
  lastRetryAt: string | null;
  retryLockId: string | null;
  retryLockedAt: string | null;
  retryErrorMessage: string | null;
  retryStrategy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  policy?: PolicyRecord | null;
  quotation?: QuotationRecord | null;
}

export interface TiramisNotificationRecord {
  id: string;
  type: string;
  correlationId: string | null;
  eventKey: string | null;
  dedupeKey: string | null;
  channel: string;
  deliveryStatus: string;
  deliveryAttempts: number;
  lastDeliveryAttemptAt: string | null;
  deliveredAt: string | null;
  deliveryErrorMessage: string | null;
  severity: TiramisNotificationSeverity | string;
  title: string;
  message: string;
  requestType: string | null;
  sourceCompanyId: string | null;
  sourceUserId: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  businessReference: string | null;
  localTrackingId: string | null;
  tiramisTransactionId: string | null;
  tiramisRequestId: string | null;
  status: string | null;
  errorMessage: string | null;
  isRead: boolean;
  readAt: string | null;
  readByUserId: string | null;
  dismissedAt: string | null;
  dismissedByUserId: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TiramisSummaryByCount {
  status?: string;
  requestType?: string;
  sourceModule?: string;
  count: number;
}

export interface TiramisDashboardSummary {
  total: number;
  summary: {
    acknowledged: number;
    finalSuccess: number;
    finalFailed: number;
    failed: number;
    retryPending: number;
    retryExhausted: number;
    successRate: number;
  };
  byStatus: TiramisSummaryByCount[];
  byRequestType: TiramisSummaryByCount[];
  bySourceModule: TiramisSummaryByCount[];
  recentNotifications?: TiramisNotificationRecord[];
}

export interface TiramisHealthResponse {
  success?: boolean;
  healthy?: boolean;
  summary?: Record<string, unknown>;
}

export interface TiramisDashboardResponse {
  data: TiramisTrackingRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  total: number;
  summary: {
    acknowledged: number;
    finalSuccess: number;
    finalFailed: number;
    failed: number;
    retryPending: number;
    retryExhausted: number;
    successRate: number;
  };
  byStatus: TiramisSummaryByCount[];
  byRequestType: TiramisSummaryByCount[];
  bySourceModule: TiramisSummaryByCount[];
  recentNotifications?: TiramisNotificationRecord[];
}

export interface PortalTiramisSubmitPayload {
  requestType: TiramisRequestType;
  policy_id?: string;
  quotation_id?: string;
  branch_id?: string;
  sale_point_id?: string;
  source_module?: string;
  source_record_id?: string;
  business_reference: string;
  payload: Record<string, unknown>;
}

export interface TenantTiramisSubmissionListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source_module?: string;
  policy_id?: string;
  quotation_id?: string;
  request_id?: string;
  business_reference?: string;
}

export interface TiramisTrackingListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  requestType?: string;
  sourceModule?: string;
  sourceRecordId?: string;
  businessReference?: string;
  tiramisRequestId?: string;
  tiramisTransactionId?: string;
  finalResponseStatusCode?: string;
  isRetryable?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type TiramisSubmissionPage = PaginatedResponse<TiramisSubmissionRecord>;
export type TiramisTrackingPage = PaginatedResponse<TiramisTrackingRecord>;
