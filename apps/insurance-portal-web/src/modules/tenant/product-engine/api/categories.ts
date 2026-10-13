import { apiClient } from '@/modules/shared/api/client';
import type {
  InsuranceCategory,
  InsuranceBusinessLine,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQueryParams,
  PEPage,
} from '@/types/product-engine';

export const categoriesApi = {
  getList: (params?: CategoryQueryParams, signal?: AbortSignal) =>
    apiClient
      .get<PEPage<InsuranceCategory>>('/insurance-categories', { params, signal })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient
      .get<InsuranceCategory>(`/insurance-categories/${id}`)
      .then((r) => r.data),

  create: (data: CreateCategoryDto) =>
    apiClient
      .post<InsuranceCategory>('/insurance-categories', data)
      .then((r) => r.data),

  update: (id: string, data: UpdateCategoryDto) =>
    apiClient
      .patch<InsuranceCategory>(`/insurance-categories/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/insurance-categories/${id}`).then((r) => r.data),

  /** Convenience: fetch all active categories for dropdowns */
  getAllActive: (business_line?: InsuranceBusinessLine) =>
    apiClient
      .get<PEPage<InsuranceCategory>>('/insurance-categories', {
        params: {
          limit: 100,
          is_active: true,
          ...(business_line ? { business_line } : {}),
        },
      })
      .then((r) => r.data.data),
};
