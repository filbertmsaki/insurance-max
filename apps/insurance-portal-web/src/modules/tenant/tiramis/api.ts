import { apiClient } from '@/modules/shared/api/client';
import type {
  BackendPaginatedResponse,
  PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  PortalTiramisSubmitPayload,
  TiramisSalePointRecord,
  TenantTiramisSubmissionListParams,
  TiramisDashboardResponse,
  TiramisHealthResponse,
  TiramisSubmissionPage,
  TiramisSubmissionRecord,
  TiramisTrackingListParams,
  TiramisTrackingPage,
  TiramisTrackingRecord,
} from './types';

type LegacyPageResponse<T> = {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages?: number;
    totalPages?: number;
  };
};

function normalizeLegacyPage<T>(
  response: LegacyPageResponse<T>,
): PaginatedResponse<T> {
  return {
    data: response.items,
    pagination: {
      page: response.meta.page,
      limit: response.meta.limit,
      total: response.meta.total,
      totalPages: response.meta.totalPages ?? response.meta.pages ?? 1,
    },
  };
}

export const tiramisApi = {
  submit: (data: PortalTiramisSubmitPayload) =>
    apiClient
      .post('/tenant/tiramis-submissions/submit', data)
      .then((r) => r.data),
  getSalePoints: (branchId?: string) =>
    apiClient
      .get<TiramisSalePointRecord[]>(
        '/tenant/tiramis-submissions/sale-points',
        {
          params: branchId ? { branch_id: branchId } : undefined,
        },
      )
      .then((r) => r.data),
  getSubmissions: async (
    params?: TenantTiramisSubmissionListParams,
  ): Promise<TiramisSubmissionPage> => {
    const response = await apiClient.get<
      | LegacyPageResponse<TiramisSubmissionRecord>
      | BackendPaginatedResponse<TiramisSubmissionRecord>
      | PaginatedResponse<TiramisSubmissionRecord>
    >('/tenant/tiramis-submissions', { params });
    if ('pagination' in response.data) {
      return response.data;
    }

    if ('items' in response.data) {
      return normalizeLegacyPage<TiramisSubmissionRecord>(response.data);
    }

    return {
      data: response.data.data,
      pagination: {
        page: response.data.meta.currentPage,
        limit: response.data.meta.itemsPerPage,
        total: response.data.meta.totalItems,
        totalPages: response.data.meta.totalPages,
      },
    };
  },
  getSubmission: (id: string) =>
    apiClient
      .get<TiramisSubmissionRecord>(`/tenant/tiramis-submissions/${id}`)
      .then((r) => r.data),
  getSubmissionByRequestId: (requestId: string) =>
    apiClient
      .get<TiramisSubmissionRecord>(
        `/tenant/tiramis-submissions/request/${requestId}`,
      )
      .then((r) => r.data),

  getServiceHealth: () =>
    apiClient
      .get<TiramisHealthResponse>('/tiramis/service-health')
      .then((r) => r.data),
  getLocalTracking: async (
    params?: Pick<TiramisTrackingListParams, 'limit'>,
  ): Promise<TiramisTrackingRecord[]> => {
    const response = await apiClient.get<TiramisTrackingRecord[]>(
      '/tiramis/local-tracking',
      { params },
    );
    return response.data;
  },
  getLocalTrackingById: (id: string) =>
    apiClient
      .get<TiramisTrackingRecord>(`/tiramis/local-tracking/${id}`)
      .then((r) => r.data),
  retryLocalTracking: () =>
    apiClient.post('/tiramis/local-tracking/retry').then((r) => r.data),
  retryOneLocalTracking: (id: string) =>
    apiClient.post(`/tiramis/local-tracking/${id}/retry`).then((r) => r.data),
  syncOneLocalTracking: (id: string) =>
    apiClient.post(`/tiramis/local-tracking/${id}/sync`).then((r) => r.data),

  getAdminDashboard: async (
    params?: TiramisTrackingListParams,
  ): Promise<TiramisDashboardResponse> => {
    const response = await apiClient.get<
      LegacyPageResponse<TiramisTrackingRecord> &
        Omit<TiramisDashboardResponse, 'data' | 'pagination'>
    >('/tiramis/admin/dashboard', { params });
    const normalized = normalizeLegacyPage<TiramisTrackingRecord>(
      response.data,
    );
    return {
      ...response.data,
      data: normalized.data,
      pagination: normalized.pagination,
    };
  },
  getAdminHealth: (params?: TiramisTrackingListParams) =>
    apiClient
      .get<TiramisHealthResponse>('/tiramis/admin/health', { params })
      .then((r) => r.data),
  getAdminSubmissions: async (
    params?: TiramisTrackingListParams,
  ): Promise<TiramisTrackingPage> => {
    const response = await apiClient.get<
      LegacyPageResponse<TiramisTrackingRecord>
    >('/tiramis/admin/submissions', { params });
    return normalizeLegacyPage<TiramisTrackingRecord>(response.data);
  },
  getAdminStatistics: (params?: TiramisTrackingListParams) =>
    apiClient.get('/tiramis/admin/statistics', { params }).then((r) => r.data),
  getAdminFailed: (limit = 50) =>
    apiClient
      .get<
        TiramisTrackingRecord[]
      >('/tiramis/admin/failed', { params: { limit } })
      .then((r) => r.data),
  getAdminRetryable: (limit = 50) =>
    apiClient
      .get<
        TiramisTrackingRecord[]
      >('/tiramis/admin/retryable', { params: { limit } })
      .then((r) => r.data),
  getAdminSubmission: (id: string) =>
    apiClient
      .get<TiramisTrackingRecord>(`/tiramis/admin/submissions/${id}`)
      .then((r) => r.data),
  getAdminTimeline: (id: string) =>
    apiClient
      .get(`/tiramis/admin/submissions/${id}/timeline`)
      .then((r) => r.data),
  retryAdminSubmission: (id: string) =>
    apiClient
      .post(`/tiramis/admin/submissions/${id}/retry`)
      .then((r) => r.data),
  scheduleAdminRetry: (id: string, reason?: string) =>
    apiClient
      .post(`/tiramis/admin/submissions/${id}/schedule-retry`, { reason })
      .then((r) => r.data),
  syncAdminSubmission: (id: string) =>
    apiClient.post(`/tiramis/admin/submissions/${id}/sync`).then((r) => r.data),
  syncAdminBusinessRecord: (id: string) =>
    apiClient
      .post(`/tiramis/admin/submissions/${id}/sync-business-record`)
      .then((r) => r.data),
};
