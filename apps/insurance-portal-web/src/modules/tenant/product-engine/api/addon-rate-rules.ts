import { apiClient } from '@/modules/shared/api/client';
import type {
  ProductAddonRateRule,
  CreateAddonRateRuleDto,
  UpdateAddonRateRuleDto,
} from '@/types/product-engine';

export const addonRateRulesApi = {
  list: (rateBookId: string) =>
    apiClient
      .get<
        ProductAddonRateRule[]
      >(`/pricing-rate-books/${rateBookId}/addon-rules`)
      .then((r) => r.data),

  create: (rateBookId: string, data: CreateAddonRateRuleDto) =>
    apiClient
      .post<ProductAddonRateRule>(
        `/pricing-rate-books/${rateBookId}/addon-rules`,
        data,
      )
      .then((r) => r.data),

  update: (rateBookId: string, ruleId: string, data: UpdateAddonRateRuleDto) =>
    apiClient
      .patch<ProductAddonRateRule>(
        `/pricing-rate-books/${rateBookId}/addon-rules/${ruleId}`,
        data,
      )
      .then((r) => r.data),

  delete: (rateBookId: string, ruleId: string) =>
    apiClient
      .delete(`/pricing-rate-books/${rateBookId}/addon-rules/${ruleId}`)
      .then((r) => r.data),
};
