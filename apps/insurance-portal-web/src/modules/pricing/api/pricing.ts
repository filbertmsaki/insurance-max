import { apiClient } from '@/modules/shared/api/client';
import type {
  PricingMultiRiskRequest,
  PricingMultiRiskResult,
  PricingRuleExplanation,
  PricingSingleRiskRequest,
  PricingSingleRiskResult,
} from '../types/pricing';

export const pricingApi = {
  calculateSingle: (data: PricingSingleRiskRequest) =>
    apiClient
      .post<PricingSingleRiskResult>('/premium-calculation/single', data)
      .then((response) => response.data),

  calculateMulti: (data: PricingMultiRiskRequest) =>
    apiClient
      .post<PricingMultiRiskResult>('/premium-calculation/multi', data)
      .then((response) => response.data),

  explainRisk: (riskId: string) =>
    apiClient
      .get<PricingRuleExplanation>(`/premium-calculation/explain/${riskId}`)
      .then((response) => response.data),
};
