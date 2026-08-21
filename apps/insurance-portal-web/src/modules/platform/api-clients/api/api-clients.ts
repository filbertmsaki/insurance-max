import { apiClient } from '@/modules/shared/api/client';
import type { ApiClient, PaginatedResponse } from '@/types';

export interface CreateApiClientDto {
  name: string;
  scopes: string[];
  description?: string;
  ip_whitelist: string[];
  rate_limit_per_minute: number;
}

export interface CreateApiClientResponse extends ApiClient {
  plainSecret: string;
}

export const apiClientsApi = {
  getApiClients: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<ApiClient>>('/api-clients', { params })
      .then((r) => r.data),

  createApiClient: (data: CreateApiClientDto) =>
    apiClient
      .post<CreateApiClientResponse>('/api-clients', data)
      .then((r) => r.data),

  rotateSecret: (id: string) =>
    apiClient
      .post<{ plainSecret: string }>(`/api-clients/${id}/rotate-secret`)
      .then((r) => r.data),

  revokeApiClient: (id: string) =>
    apiClient.delete(`/api-clients/${id}`).then((r) => r.data),
};
