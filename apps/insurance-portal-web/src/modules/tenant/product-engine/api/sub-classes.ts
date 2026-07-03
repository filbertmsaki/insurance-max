import { apiClient } from '@/modules/shared/api/client';
import type {
  InsuranceSubClass,
  CreateSubClassDto,
  UpdateSubClassDto,
  SubClassQueryParams,
  PEPage,
} from '@/types/product-engine';

export const subClassesApi = {
  getList: (params?: SubClassQueryParams) =>
    apiClient
      .get<PEPage<InsuranceSubClass>>('/insurance-sub-classes', { params })
      .then((r) => r.data),

  create: (data: CreateSubClassDto) =>
    apiClient
      .post<InsuranceSubClass>('/insurance-sub-classes', data)
      .then((r) => r.data),

  update: (id: string, data: UpdateSubClassDto) =>
    apiClient
      .patch<InsuranceSubClass>(`/insurance-sub-classes/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/insurance-sub-classes/${id}`).then((r) => r.data),

  getAllByProduct: (product_id: string) =>
    apiClient
      .get<PEPage<InsuranceSubClass>>('/insurance-sub-classes', {
        params: { limit: 100, is_active: true, product_id },
      })
      .then((r) => r.data.data),
};
