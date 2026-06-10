import { apiClient } from '@/api/client'
import type {
  RiskRequiredFactor,
  CreateRequiredFactorDto,
  UpdateRequiredFactorDto,
} from '@/types/product-engine'

export const requiredFactorsApi = {
  getByRisk: (riskId: string) =>
    apiClient
      .get<RiskRequiredFactor[]>(`/risk-required-factors/by-risk/${riskId}`)
      .then((r) => r.data),

  create: (data: CreateRequiredFactorDto) =>
    apiClient.post<RiskRequiredFactor>('/risk-required-factors', data).then((r) => r.data),

  update: (id: string, data: UpdateRequiredFactorDto) =>
    apiClient
      .patch<RiskRequiredFactor>(`/risk-required-factors/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/risk-required-factors/${id}`).then((r) => r.data),
}
