import { apiClient } from '@/modules/shared/api/client';
import {
  normalizePaginatedResponse,
  type PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  DecideQuotationPremiumOverridePayload,
  QuotationDraftRecordPayload,
  QuotationDetailRecord,
  QuotationListItem,
  QuotationListParams,
  QuotationPayload,
  QuotationPreviewRecord,
  QuotationSubmitResponse,
  QuotationWorkflowView,
  RequestQuotationPremiumOverridePayload,
  TransitionQuotationStatusPayload,
} from './types';

export type QuotationUpdatePayload = QuotationPayload & {
  expected_updated_at?: string;
};

export type QuotationDraftUpdatePayload = QuotationDraftRecordPayload & {
  expected_updated_at?: string;
};

type QuotationListApiResponse = {
  items: QuotationListItem[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
};

function normalizeQuotationListResponse(
  response:
    | QuotationListApiResponse
    | {
        data: QuotationListItem[];
        meta: QuotationListApiResponse['meta'];
      }
    | PaginatedResponse<QuotationListItem>,
): PaginatedResponse<QuotationListItem> {
  if ('items' in response) {
    return normalizePaginatedResponse({
      data: response.items,
      meta: response.meta,
    });
  }

  return normalizePaginatedResponse(response);
}

export const quotationsApi = {
  getList: async (
    params?: QuotationListParams,
  ): Promise<PaginatedResponse<QuotationListItem>> => {
    const response = await apiClient.get<
      QuotationListApiResponse | PaginatedResponse<QuotationListItem>
    >('/tenant/quotations', { params });
    return normalizeQuotationListResponse(response.data);
  },
  getById: (id: string) =>
    apiClient
      .get<QuotationDetailRecord>(`/tenant/quotations/${id}`)
      .then((response) => response.data),
  getForEdit: (id: string) =>
    apiClient
      .get<QuotationDetailRecord>(`/tenant/quotations/${id}/edit`)
      .then((response) => response.data),
  getPreview: (id: string) =>
    apiClient
      .get<QuotationPreviewRecord>(`/tenant/quotations/${id}/preview`)
      .then((response) => response.data),
  getWorkflow: (id: string) =>
    apiClient
      .get<QuotationWorkflowView>(`/tenant/quotations/${id}/workflow`)
      .then((response) => response.data),
  getPayload: (id: string) =>
    apiClient
      .get<QuotationPayload>(`/tenant/quotations/${id}/payload`)
      .then((response) => response.data),
  create: (data: QuotationPayload) =>
    apiClient
      .post<QuotationDetailRecord>('/tenant/quotations', data)
      .then((response) => response.data),
  createDraft: (data: QuotationDraftRecordPayload) =>
    apiClient
      .post<QuotationDetailRecord>('/tenant/quotations/drafts', data)
      .then((response) => response.data),
  update: (id: string, data: QuotationUpdatePayload) =>
    apiClient
      .put<QuotationDetailRecord>(`/tenant/quotations/${id}`, data)
      .then((response) => response.data),
  updateDraft: (id: string, data: QuotationDraftUpdatePayload) =>
    apiClient
      .put<QuotationDetailRecord>(`/tenant/quotations/${id}/draft`, data)
      .then((response) => response.data),
  finalize: (id: string, data: QuotationUpdatePayload) =>
    apiClient
      .post<QuotationDetailRecord>(`/tenant/quotations/${id}/finalize`, data)
      .then((response) => response.data),
  submitForApproval: (id: string) =>
    apiClient
      .post<QuotationDetailRecord>(
        `/tenant/quotations/${id}/submit-for-approval`,
      )
      .then((response) => response.data),
  requestPayment: (id: string) =>
    apiClient
      .post<QuotationDetailRecord>(`/tenant/quotations/${id}/request-payment`)
      .then((response) => response.data),
  submit: (
    id: string,
    data: { force_resubmit?: boolean; return_existing?: boolean } = {},
  ) =>
    apiClient
      .post<QuotationSubmitResponse>(`/tenant/quotations/${id}/submit`, data)
      .then((response) => response.data),
  retryTira: (id: string) =>
    apiClient
      .post<QuotationSubmitResponse>(`/tenant/quotations/${id}/retry-tira`)
      .then((response) => response.data),
  cancel: (id: string, data: { cancellation_reason: string }) =>
    apiClient
      .post<QuotationDetailRecord>(`/tenant/quotations/${id}/cancel`, data)
      .then((response) => response.data),
  transitionStatus: (id: string, data: TransitionQuotationStatusPayload) =>
    apiClient
      .post<QuotationDetailRecord>(`/tenant/quotations/${id}/status`, data)
      .then((response) => response.data),
  requestPremiumOverride: (
    quotationId: string,
    riskId: string,
    data: RequestQuotationPremiumOverridePayload,
  ) =>
    apiClient
      .post<{
        id: string;
        approval_status: string;
      }>(
        `/tenant/quotations/${quotationId}/risks/${riskId}/premium-overrides`,
        data,
      )
      .then((response) => response.data),
  approvePremiumOverride: (
    quotationId: string,
    riskId: string,
    overrideId: string,
    data: DecideQuotationPremiumOverridePayload = {},
  ) =>
    apiClient
      .post<{
        id: string;
        approval_status: string;
      }>(
        `/tenant/quotations/${quotationId}/risks/${riskId}/premium-overrides/${overrideId}/approve`,
        data,
      )
      .then((response) => response.data),
  rejectPremiumOverride: (
    quotationId: string,
    riskId: string,
    overrideId: string,
    data: DecideQuotationPremiumOverridePayload,
  ) =>
    apiClient
      .post<{
        id: string;
        approval_status: string;
      }>(
        `/tenant/quotations/${quotationId}/risks/${riskId}/premium-overrides/${overrideId}/reject`,
        data,
      )
      .then((response) => response.data),
  delete: (id: string) =>
    apiClient
      .delete(`/tenant/quotations/${id}`)
      .then((response) => response.data),
  deleteDraft: (id: string) =>
    apiClient
      .delete(`/tenant/quotations/${id}/draft`)
      .then((response) => response.data),
};
