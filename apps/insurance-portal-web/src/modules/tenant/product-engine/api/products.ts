import { apiClient } from '@/modules/shared/api/client';
import type {
  InsuranceProduct,
  InsuranceBusinessLine,
  CreateProductDto,
  UpdateProductDto,
  ProductQueryParams,
  PEPage,
} from '@/types/product-engine';

export const productsApi = {
  getList: (params?: ProductQueryParams, signal?: AbortSignal) =>
    apiClient
      .get<PEPage<InsuranceProduct>>('/insurance-products', { params, signal })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient
      .get<InsuranceProduct>(`/insurance-products/${id}`)
      .then((r) => r.data),

  create: (data: CreateProductDto) =>
    apiClient
      .post<InsuranceProduct>('/insurance-products', data)
      .then((r) => r.data),

  update: (id: string, data: UpdateProductDto) =>
    apiClient
      .patch<InsuranceProduct>(`/insurance-products/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/insurance-products/${id}`).then((r) => r.data),

  getAllActive: (params?: {
    category_id?: string;
    business_line?: InsuranceBusinessLine;
    supports_fleet?: boolean;
  }) =>
    apiClient
      .get<PEPage<InsuranceProduct>>('/insurance-products', {
        params: {
          limit: 100,
          is_active: true,
          ...(params?.category_id ? { category_id: params.category_id } : {}),
          ...(params?.business_line
            ? { business_line: params.business_line }
            : {}),
          ...(params?.supports_fleet !== undefined
            ? { supports_fleet: params.supports_fleet }
            : {}),
        },
      })
      .then((r) => r.data.data),
};
