import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse } from '@/modules/shared/api/pagination';
import type { PaginatedResponse } from '@/types';
import type {
  CustomerListParams,
  CustomerAuditLogRecord,
  CustomerPayload,
  CustomerRecord,
  CustomerVersionRecord,
} from './types';

export const customersApi = {
  getCustomers: async (
    params?: CustomerListParams,
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<CustomerRecord>> => {
    const response = await apiClient.get('/tenant/customers', {
      params,
      signal,
    });
    return normalizePaginatedResponse(response.data);
  },

  getCustomer: (id: string) =>
    apiClient
      .get<CustomerRecord>(`/tenant/customers/${id}`)
      .then((r) => r.data),

  getCustomerVersions: (id: string) =>
    apiClient
      .get<CustomerVersionRecord[]>(`/tenant/customers/${id}/versions`)
      .then((r) => r.data),

  getCustomerAuditHistory: (id: string) =>
    apiClient
      .get<CustomerAuditLogRecord[]>(`/tenant/customers/${id}/audit-history`)
      .then((r) => r.data),

  createCustomer: (data: CustomerPayload) =>
    apiClient
      .post<CustomerRecord>('/tenant/customers', data)
      .then((r) => r.data),

  updateCustomer: (id: string, data: Partial<CustomerPayload>) =>
    apiClient
      .patch<CustomerRecord>(`/tenant/customers/${id}`, data)
      .then((r) => r.data),

  deleteCustomer: (id: string) =>
    apiClient.delete(`/tenant/customers/${id}`).then((r) => r.data),

  restoreCustomer: (id: string) =>
    apiClient
      .patch<CustomerRecord>(`/tenant/customers/${id}/restore`)
      .then((r) => r.data),
};
