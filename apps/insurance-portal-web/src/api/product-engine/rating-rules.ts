import { apiClient } from '@/api/client'
import type {
  RiskRatingRule,
  CreateRuleDto,
  UpdateRuleDto,
  RuleQueryParams,
  PEPage,
} from '@/types/product-engine'

export const ratingRulesApi = {
  getList: (params?: RuleQueryParams) =>
    apiClient
      .get<PEPage<RiskRatingRule>>('/risk-rating-rules', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<RiskRatingRule>(`/risk-rating-rules/${id}`).then((r) => r.data),

  create: (data: CreateRuleDto) =>
    apiClient.post<RiskRatingRule>('/risk-rating-rules', data).then((r) => r.data),

  update: (id: string, data: UpdateRuleDto) =>
    apiClient.patch<RiskRatingRule>(`/risk-rating-rules/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/risk-rating-rules/${id}`).then((r) => r.data),
}
