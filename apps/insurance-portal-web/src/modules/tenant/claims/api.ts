import { apiClient } from '@/modules/shared/api/client';
import {
  normalizePaginatedResponse,
  type PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type { ClaimListParams, ClaimRecord, ClaimsPage } from './types';

async function getPage<T>(
  path: string,
  params?: ClaimListParams,
): Promise<PaginatedResponse<T>> {
  const response = await apiClient.get<ClaimsPage<T>>(path, { params });
  return normalizePaginatedResponse({
    ...response.data,
    data: response.data.data ?? response.data.items ?? [],
  });
}

export const claimsApi = {
  list: (params?: ClaimListParams) =>
    getPage<ClaimRecord>('/tenant/claims', params),
  get: (id: string) =>
    apiClient.get<ClaimRecord>(`/tenant/claims/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    apiClient.post<ClaimRecord>('/tenant/claims', data).then((r) => r.data),
  assign: (id: string, assigned_user_id: string) =>
    apiClient
      .post<ClaimRecord>(`/tenant/claims/${id}/assign`, { assigned_user_id })
      .then((r) => r.data),
  reject: (id: string, reason: string) =>
    apiClient
      .post<ClaimRecord>(`/tenant/claims/${id}/reject`, { reason })
      .then((r) => r.data),
  close: (id: string, reason: string) =>
    apiClient
      .post<ClaimRecord>(`/tenant/claims/${id}/close`, { reason })
      .then((r) => r.data),
  submitNotification: (id: string) =>
    apiClient
      .post<ClaimRecord>(`/tenant/claims/${id}/tiramis/notification`)
      .then((r) => r.data),
  createReserve: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/tenant/claims/${id}/reserves`, data).then((r) => r.data),
  createAssessment: (id: string, data: Record<string, unknown>) =>
    apiClient
      .post(`/tenant/claims/${id}/assessments`, data)
      .then((r) => r.data),
  createPayment: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/tenant/claims/${id}/payments`, data).then((r) => r.data),
  createDecision: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/tenant/claims/${id}/decisions`, data).then((r) => r.data),
  listDecisions: (id: string) =>
    apiClient.get(`/tenant/claims/${id}/decisions`).then((r) => r.data),
  listRecoveries: (id: string) =>
    apiClient.get(`/tenant/claims/${id}/recoveries`).then((r) => r.data),
};
