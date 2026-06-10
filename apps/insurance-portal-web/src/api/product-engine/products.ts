import { apiClient } from '@/api/client'
import type {
  InsuranceProduct,
  CreateProductDto,
  UpdateProductDto,
  ProductQueryParams,
  PEPage,
} from '@/types/product-engine'

export const productsApi = {
  getList: (params?: ProductQueryParams) =>
    apiClient
      .get<PEPage<InsuranceProduct>>('/insurance-products', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<InsuranceProduct>(`/insurance-products/${id}`).then((r) => r.data),

  create: (data: CreateProductDto) =>
    apiClient.post<InsuranceProduct>('/insurance-products', data).then((r) => r.data),

  update: (id: string, data: UpdateProductDto) =>
    apiClient.patch<InsuranceProduct>(`/insurance-products/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/insurance-products/${id}`).then((r) => r.data),

  getAllActive: (category_id?: string) =>
    apiClient
      .get<PEPage<InsuranceProduct>>('/insurance-products', {
        params: { limit: 100, is_active: true, ...(category_id ? { category_id } : {}) },
      })
      .then((r) => r.data.data),
}
