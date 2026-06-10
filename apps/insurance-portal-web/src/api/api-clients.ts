import { apiClient } from './client'
import type { ApiClient, PaginatedResponse } from '@/types'

export interface CreateApiClientDto {
  name: string
  scopes: string[]
  description?: string
}

export interface CreateApiClientResponse extends ApiClient {
  secret: string
}

export const apiClientsApi = {
  getApiClients: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<ApiClient>>('/api-clients', { params })
      .then((r) => r.data),

  createApiClient: (data: CreateApiClientDto) =>
    apiClient.post<CreateApiClientResponse>('/api-clients', data).then((r) => r.data),

  rotateSecret: (id: string) =>
    apiClient
      .post<{ secret: string }>(`/api-clients/${id}/rotate-secret`)
      .then((r) => r.data),

  revokeApiClient: (id: string) =>
    apiClient.post(`/api-clients/${id}/revoke`).then((r) => r.data),
}
