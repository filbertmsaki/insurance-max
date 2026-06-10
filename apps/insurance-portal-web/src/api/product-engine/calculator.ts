import { apiClient } from '@/api/client'
import type {
  SingleCalcRequest,
  MultiCalcRequest,
  RiskPremiumResult,
  MultiCalcResponse,
} from '@/types/product-engine'

export const calculatorApi = {
  calculateSingle: (data: SingleCalcRequest) =>
    apiClient
      .post<RiskPremiumResult>('/premium-calculation/single', data)
      .then((r) => r.data),

  calculateMulti: (data: MultiCalcRequest) =>
    apiClient
      .post<MultiCalcResponse>('/premium-calculation/multi', data)
      .then((r) => r.data),
}
