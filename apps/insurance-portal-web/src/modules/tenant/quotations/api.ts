import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse } from '@/modules/shared/api/pagination';
import type { BackendPaginatedResponse, PaginatedResponse } from '@/modules/shared/api/pagination';
import type { InsuranceRisk, MultiCalcRequest, MultiCalcResponse, RiskPremiumResult, SingleCalcRequest } from '@/types/product-engine';
import type {
  QuotationListParams,
  QuotationPayload,
  QuotationRecord,
  QuotationRiskRecord,
  QuotationPremiumBreakdownRecord,
  QuotationStatusHistoryRecord,
} from './types';

export const quotationsApi = {
  getList: async (params?: QuotationListParams): Promise<PaginatedResponse<QuotationRecord>> => {
    const response = await apiClient.get<BackendPaginatedResponse<QuotationRecord> | PaginatedResponse<QuotationRecord>>(
      '/tenant/quotations',
      { params },
    );
    return normalizePaginatedResponse<QuotationRecord>(response.data);
  },
  getById: (id: string) => apiClient.get<QuotationRecord>(`/tenant/quotations/${id}`).then((r) => r.data),
  create: (data: QuotationPayload) => apiClient.post<QuotationRecord>('/tenant/quotations', data).then((r) => r.data),
  update: (id: string, data: Partial<QuotationPayload>) =>
    apiClient.patch<QuotationRecord>(`/tenant/quotations/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/tenant/quotations/${id}`).then((r) => r.data),
  restore: (id: string) => apiClient.patch(`/tenant/quotations/${id}/restore`).then((r) => r.data),
  getRisks: async (quotationId?: string): Promise<QuotationRiskRecord[]> => {
    if (!quotationId) return [];
    const quotation = await apiClient.get<QuotationRecord>(`/tenant/quotations/${quotationId}`).then((r) => r.data);
    return quotation.risks ?? [];
  },
  getBreakdowns: async (quotationId?: string): Promise<QuotationPremiumBreakdownRecord[]> => {
    if (!quotationId) return [];
    const quotation = await apiClient.get<QuotationRecord>(`/tenant/quotations/${quotationId}`).then((r) => r.data);
    return quotation.premium_breakdowns ?? [];
  },
  getHistory: async (quotationId?: string): Promise<QuotationStatusHistoryRecord[]> => {
    if (!quotationId) return [];
    const quotation = await apiClient.get<QuotationRecord>(`/tenant/quotations/${quotationId}`).then((r) => r.data);
    return quotation.status_history ?? [];
  },
  calculateSingle: (data: SingleCalcRequest) =>
    apiClient.post<RiskPremiumResult>('/premium-calculation/single', data).then((r) => r.data),
  calculateMulti: (data: MultiCalcRequest) =>
    apiClient.post<MultiCalcResponse>('/premium-calculation/multi', data).then((r) => r.data),
  getRisksByProduct: async (productId: string): Promise<InsuranceRisk[]> => {
    const response = await apiClient.get('/insurance-risks', { params: { limit: 100, is_active: true, product_id: productId } });
    return normalizePaginatedResponse<InsuranceRisk>(response.data).data;
  },
};

