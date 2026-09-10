import { apiClient } from '@/modules/shared/api/client';
import type { ProductTaxRule, CreateTaxRuleDto } from '@/types/product-engine';

export const taxRulesApi = {
  getList: () =>
    apiClient
      .get<ProductTaxRule[]>('/product-distribution/tax-rules')
      .then((r) => r.data),

  create: (data: CreateTaxRuleDto) =>
    apiClient
      .post<ProductTaxRule>('/product-distribution/tax-rules', data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient
      .delete(`/product-distribution/tax-rules/${id}`)
      .then((r) => r.data),

  restore: (id: string) =>
    apiClient
      .patch<ProductTaxRule>(`/product-distribution/tax-rules/${id}/restore`)
      .then((r) => r.data),
};
