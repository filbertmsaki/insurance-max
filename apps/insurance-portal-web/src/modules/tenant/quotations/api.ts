import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse, type PaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  QuotationDetailRecord,
  QuotationListItem,
  QuotationListParams,
  QuotationPayload,
  QuotationSubmitResponse,
} from './types';

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
  getPayload: (id: string) =>
    apiClient
      .get<QuotationPayload>(`/tenant/quotations/${id}/payload`)
      .then((response) => response.data),
  create: (data: QuotationPayload) =>
    apiClient
      .post<QuotationDetailRecord>('/tenant/quotations', data)
      .then((response) => response.data),
  update: (id: string, data: QuotationPayload) =>
    apiClient
      .put<QuotationDetailRecord>(`/tenant/quotations/${id}`, data)
      .then((response) => response.data),
  submit: (id: string, data: { force_resubmit?: boolean; return_existing?: boolean } = {}) =>
    apiClient
      .post<QuotationSubmitResponse>(`/tenant/quotations/${id}/submit`, data)
      .then((response) => response.data),
  delete: (id: string) =>
    apiClient.delete(`/tenant/quotations/${id}`).then((response) => response.data),
};
