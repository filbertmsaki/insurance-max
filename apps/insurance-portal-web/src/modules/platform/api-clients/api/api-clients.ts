import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { ApiClient } from '@/types';

export interface ApiClientsListParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: string;
  client_type?: string;
  environment?: string;
}

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
  /**
   * GET /api-clients — full ApiClient[] (unpaginated). Paging params are
   * deliberately not sent: a `page` param switches the endpoint to the paged
   * shape. Use `listApiClients` for tables.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getApiClients: (_params?: { page?: number; limit?: number }) =>
    apiClient.get<ApiClient[]>('/apps/api-clients').then((r) => r.data),

  /** GET /api-clients?page=… — server-side paginated/searchable/sortable list */
  listApiClients: (params: ApiClientsListParams, signal?: AbortSignal) =>
    apiClient
      .get<
        PaginatedResponse<ApiClient>
      >('/apps/api-clients', { params, signal })
      .then((r) => r.data),

  createApiClient: (data: CreateApiClientDto) =>
    apiClient
      .post<CreateApiClientResponse>('/apps/api-clients', data)
      .then((r) => r.data),

  rotateSecret: (id: string) =>
    apiClient
      .post<{ plainSecret: string }>(`/apps/api-clients/${id}/rotate-secret`)
      .then((r) => r.data),

  revokeApiClient: (id: string) =>
    apiClient.delete(`/apps/api-clients/${id}`).then((r) => r.data),
};
