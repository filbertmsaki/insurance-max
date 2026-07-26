import { apiClient } from '@/modules/shared/api/client';
import type {
  SingleCalcRequest,
  MultiCalcRequest,
  RiskPremiumResult,
  MultiCalcResponse,
  RiskRuleExplanation,
} from '@/types/product-engine';

export const calculatorApi = {
  calculateSingle: (data: SingleCalcRequest) =>
    apiClient
      .post<RiskPremiumResult>('/premium-calculation/single', data)
      .then((r) => r.data),

  calculateMulti: (data: MultiCalcRequest) =>
    apiClient
      .post<MultiCalcResponse>('/premium-calculation/multi', data)
      .then((r) => r.data),

  /** Resolved highest-priority active rule for a risk, no sum_insured/factors
   * required — used for QA/debugging without reverse-engineering seed data. */
  explainRisk: (riskId: string) =>
    apiClient
      .get<RiskRuleExplanation>(`/premium-calculation/explain/${riskId}`)
      .then((r) => r.data),
};
