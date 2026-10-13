import { apiClient } from '@/modules/shared/api/client';
import type {
  InsuranceRisk,
  CreateRiskDto,
  UpdateRiskDto,
  RiskQueryParams,
  PEPage,
} from '@/types/product-engine';

export const risksApi = {
  getList: (params?: RiskQueryParams, signal?: AbortSignal) =>
    apiClient
      .get<PEPage<InsuranceRisk>>('/insurance-risks', { params, signal })
      .then((r) => r.data),

  create: (data: CreateRiskDto) =>
    apiClient.post<InsuranceRisk>('/insurance-risks', data).then((r) => r.data),

  update: (id: string, data: UpdateRiskDto) =>
    apiClient
      .patch<InsuranceRisk>(`/insurance-risks/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/insurance-risks/${id}`).then((r) => r.data),

  getAllActive: (filters?: { product_id?: string; category_id?: string }) =>
    apiClient
      .get<PEPage<InsuranceRisk>>('/insurance-risks', {
        params: {
          limit: 100,
          is_active: true,
          ...(filters?.product_id ? { product_id: filters.product_id } : {}),
          ...(filters?.category_id ? { category_id: filters.category_id } : {}),
        },
      })
      .then((r) => r.data.data),
};
