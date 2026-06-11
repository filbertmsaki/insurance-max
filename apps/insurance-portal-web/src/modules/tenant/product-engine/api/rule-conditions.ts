import { apiClient } from '@/modules/shared/api/client'
import type {
  RiskRuleCondition,
  CreateConditionDto,
  UpdateConditionDto,
} from '@/types/product-engine'

export const ruleConditionsApi = {
  getByRule: (ruleId: string) =>
    apiClient
      .get<RiskRuleCondition[]>(`/risk-rule-conditions/by-rule/${ruleId}`)
      .then((r) => r.data),

  create: (data: CreateConditionDto) =>
    apiClient.post<RiskRuleCondition>('/risk-rule-conditions', data).then((r) => r.data),

  update: (id: string, data: UpdateConditionDto) =>
    apiClient
      .patch<RiskRuleCondition>(`/risk-rule-conditions/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/risk-rule-conditions/${id}`).then((r) => r.data),
}
