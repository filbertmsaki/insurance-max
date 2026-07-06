import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse } from '@/modules/shared/api/pagination';
import type { BackendPaginatedResponse, PaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  PolicyListParams,
  PolicyPayload,
  PolicyRecord,
  PolicyRiskRecord,
  PolicyPremiumBreakdownRecord,
  PolicyStatusHistoryRecord,
} from './types';

export const policiesApi = {
  getList: async (params?: PolicyListParams): Promise<PaginatedResponse<PolicyRecord>> => {
    const response = await apiClient.get<BackendPaginatedResponse<PolicyRecord> | PaginatedResponse<PolicyRecord>>(
      '/tenant/policies',
      { params },
    );
    return normalizePaginatedResponse<PolicyRecord>(response.data);
  },
  getById: (id: string) => apiClient.get<PolicyRecord>(`/tenant/policies/${id}`).then((r) => r.data),
  create: (data: PolicyPayload) => apiClient.post<PolicyRecord>('/tenant/policies', data).then((r) => r.data),
  update: (id: string, data: Partial<PolicyPayload>) =>
    apiClient.patch<PolicyRecord>(`/tenant/policies/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/tenant/policies/${id}`).then((r) => r.data),
  restore: (id: string) => apiClient.patch(`/tenant/policies/${id}/restore`).then((r) => r.data),
  getRisks: (id: string) => apiClient.get<PolicyRiskRecord[]>(`/tenant/policies/${id}/risks`).then((r) => r.data),
  getBreakdowns: (id: string) => apiClient.get<PolicyPremiumBreakdownRecord[]>(`/tenant/policies/${id}/breakdowns`).then((r) => r.data),
  getHistory: (id: string) => apiClient.get<PolicyStatusHistoryRecord[]>(`/tenant/policies/${id}/history`).then((r) => r.data),
};

