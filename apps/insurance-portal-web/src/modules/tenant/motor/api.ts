import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse } from '@/modules/shared/api/pagination';
import type { BackendPaginatedResponse, PaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  CustomerRiskOption,
  MotorFleetPayload,
  MotorFleetRecord,
  MotorListParams,
  MotorPolicyDetailPayload,
  MotorPolicyDetailRecord,
  MotorQuotationDetailPayload,
  MotorQuotationDetailRecord,
  MotorVehiclePayload,
  MotorVehicleRecord,
  PolicyRiskOption,
  PolicyOption,
  QuotationOption,
} from './types';

type PageResponse<T> = PaginatedResponse<T>;

export const motorApi = {
  getVehicles: async (params?: MotorListParams): Promise<PageResponse<MotorVehicleRecord>> => {
    const response = await apiClient.get('/tenant/motor/vehicles', { params });
    return normalizePaginatedResponse(response.data);
  },
  getVehicle: (id: string) =>
    apiClient.get<MotorVehicleRecord>(`/tenant/motor/vehicles/${id}`).then((r) => r.data),
  createVehicle: (data: MotorVehiclePayload) =>
    apiClient.post<MotorVehicleRecord>('/tenant/motor/vehicles', data).then((r) => r.data),
  updateVehicle: (id: string, data: MotorVehiclePayload) =>
    apiClient.patch<MotorVehicleRecord>(`/tenant/motor/vehicles/${id}`, data).then((r) => r.data),
  deleteVehicle: (id: string) =>
    apiClient.delete(`/tenant/motor/vehicles/${id}`).then((r) => r.data),

  getFleets: async (params?: MotorListParams): Promise<PageResponse<MotorFleetRecord>> => {
    const response = await apiClient.get('/tenant/motor/fleets', { params });
    return normalizePaginatedResponse(response.data);
  },
  getFleet: (id: string) =>
    apiClient.get<MotorFleetRecord>(`/tenant/motor/fleets/${id}`).then((r) => r.data),
  createFleet: (data: MotorFleetPayload) =>
    apiClient.post<MotorFleetRecord>('/tenant/motor/fleets', data).then((r) => r.data),
  updateFleet: (id: string, data: MotorFleetPayload) =>
    apiClient.patch<MotorFleetRecord>(`/tenant/motor/fleets/${id}`, data).then((r) => r.data),
  deleteFleet: (id: string) =>
    apiClient.delete(`/tenant/motor/fleets/${id}`).then((r) => r.data),

  getQuotationDetails: async (quotationId?: string): Promise<MotorQuotationDetailRecord[]> => {
    const params = quotationId ? { quotation_id: quotationId } : undefined;
    const response = await apiClient.get('/tenant/motor/quotation-details', { params });
    return response.data;
  },
  getQuotationDetail: (id: string) =>
    apiClient.get<MotorQuotationDetailRecord>(`/tenant/motor/quotation-details/${id}`).then((r) => r.data),
  createQuotationDetail: (data: MotorQuotationDetailPayload) =>
    apiClient.post<MotorQuotationDetailRecord>('/tenant/motor/quotation-details', data).then((r) => r.data),
  updateQuotationDetail: (id: string, data: MotorQuotationDetailPayload) =>
    apiClient.patch<MotorQuotationDetailRecord>(`/tenant/motor/quotation-details/${id}`, data).then((r) => r.data),
  deleteQuotationDetail: (id: string) =>
    apiClient.delete(`/tenant/motor/quotation-details/${id}`).then((r) => r.data),
  restoreQuotationDetail: (id: string) =>
    apiClient.patch(`/tenant/motor/quotation-details/${id}/restore`).then((r) => r.data),

  getPolicyDetails: async (policyId?: string): Promise<MotorPolicyDetailRecord[]> => {
    const params = policyId ? { policy_id: policyId } : undefined;
    const response = await apiClient.get('/tenant/motor/policy-details', { params });
    return response.data;
  },
  getPolicyDetail: (id: string) =>
    apiClient.get<MotorPolicyDetailRecord>(`/tenant/motor/policy-details/${id}`).then((r) => r.data),
  createPolicyDetail: (data: MotorPolicyDetailPayload) =>
    apiClient.post<MotorPolicyDetailRecord>('/tenant/motor/policy-details', data).then((r) => r.data),
  updatePolicyDetail: (id: string, data: MotorPolicyDetailPayload) =>
    apiClient.patch<MotorPolicyDetailRecord>(`/tenant/motor/policy-details/${id}`, data).then((r) => r.data),
  deletePolicyDetail: (id: string) =>
    apiClient.delete(`/tenant/motor/policy-details/${id}`).then((r) => r.data),
  restorePolicyDetail: (id: string) =>
    apiClient.patch(`/tenant/motor/policy-details/${id}/restore`).then((r) => r.data),

  getQuotations: async (): Promise<QuotationOption[]> => {
    const response = await apiClient.get<BackendPaginatedResponse<QuotationOption> | PaginatedResponse<QuotationOption>>(
      '/tenant/quotations',
      { params: { limit: 1000 } },
    );
    return normalizePaginatedResponse<QuotationOption>(response.data).data;
  },
  getPolicies: async (): Promise<PolicyOption[]> => {
    const response = await apiClient.get<BackendPaginatedResponse<PolicyOption> | PaginatedResponse<PolicyOption>>(
      '/tenant/policies',
      { params: { limit: 1000 } },
    );
    return normalizePaginatedResponse<PolicyOption>(response.data).data;
  },
  getPolicyRisks: (policyId: string) =>
    apiClient.get<PolicyRiskOption[]>(`/tenant/policies/${policyId}/risks`).then((r) => r.data),
  getQuotationRisks: async (quotationId: string): Promise<CustomerRiskOption[]> => {
    const response = await apiClient.get(`/tenant/quotations/${quotationId}/breakdowns`);
    return response.data as CustomerRiskOption[];
  },
};
