import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
export interface TaxRecord {
  id: string;
  tax_code: string;
  tax_name: string;
  tax_rate: string;
  is_active: boolean;
  is_default: boolean;
}
export interface TaxInput {
  tax_code: string;
  tax_name: string;
  tax_rate: number;
  is_active: boolean;
  is_default: boolean;
}
export const taxesApi = {
  list: () => apiClient.get<TaxRecord[]>('/taxes').then((r) => r.data),
  /** GET /taxes?page=… — server-side table page (search/is_active/sort). */
  page: (params: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<TaxRecord>>('/taxes', { params, signal })
      .then((r) => r.data),
  active: () => apiClient.get<TaxRecord[]>('/taxes/active').then((r) => r.data),
  default: () =>
    apiClient.get<TaxRecord | null>('/taxes/default').then((r) => r.data),
  create: (data: TaxInput) =>
    apiClient.post<TaxRecord>('/taxes', data).then((r) => r.data),
  update: (id: string, data: TaxInput) =>
    apiClient.patch<TaxRecord>(`/taxes/${id}`, data).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/taxes/${id}`),
};
