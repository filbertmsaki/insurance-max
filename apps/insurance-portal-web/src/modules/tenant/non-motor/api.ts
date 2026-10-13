import { apiClient } from '@/modules/shared/api/client';
import { normalizePaginatedResponse } from '@/modules/shared/api/pagination';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { customersApi } from '@/modules/tenant/customers/api';
import { motorApi } from '@/modules/tenant/motor/api';
import type {
  NonMotorPolicyDetailPayload,
  NonMotorPolicyDetailRecord,
  SubjectMatterFactorValuePayload,
  SubjectMatterFactorValueRecord,
  SubjectMatterListParams,
  SubjectMatterPayload,
  SubjectMatterRecord,
} from './types';

type PageResponse<T> = PaginatedResponse<T>;

export const nonMotorApi = {
  getSubjectMatters: async (
    params?: SubjectMatterListParams,
    signal?: AbortSignal,
  ): Promise<PageResponse<SubjectMatterRecord>> => {
    const response = await apiClient.get('/tenant/non-motor/subject-matters', {
      params,
      signal,
    });
    return normalizePaginatedResponse(response.data);
  },
  getSubjectMatter: (id: string) =>
    apiClient
      .get<SubjectMatterRecord>(`/tenant/non-motor/subject-matters/${id}`)
      .then((r) => r.data),
  createSubjectMatter: (data: SubjectMatterPayload) =>
    apiClient
      .post<SubjectMatterRecord>('/tenant/non-motor/subject-matters', data)
      .then((r) => r.data),
  updateSubjectMatter: (id: string, data: SubjectMatterPayload) =>
    apiClient
      .patch<SubjectMatterRecord>(
        `/tenant/non-motor/subject-matters/${id}`,
        data,
      )
      .then((r) => r.data),
  deleteSubjectMatter: (id: string) =>
    apiClient
      .delete(`/tenant/non-motor/subject-matters/${id}`)
      .then((r) => r.data),

  getSubjectMatterFactorValues: async (
    subjectMatterId?: string,
  ): Promise<SubjectMatterFactorValueRecord[]> => {
    const params = subjectMatterId
      ? { subject_matter_id: subjectMatterId }
      : undefined;
    const response = await apiClient.get(
      '/tenant/non-motor/subject-matter-factor-values',
      { params },
    );
    return response.data;
  },
  createSubjectMatterFactorValue: (data: SubjectMatterFactorValuePayload) =>
    apiClient
      .post<SubjectMatterFactorValueRecord>(
        '/tenant/non-motor/subject-matter-factor-values',
        data,
      )
      .then((r) => r.data),

  getPolicyDetails: async (
    policyId?: string,
  ): Promise<NonMotorPolicyDetailRecord[]> => {
    const params = policyId ? { policy_id: policyId } : undefined;
    const response = await apiClient.get('/tenant/non-motor/policy-details', {
      params,
    });
    return response.data;
  },
  createPolicyDetail: (data: NonMotorPolicyDetailPayload) =>
    apiClient
      .post<NonMotorPolicyDetailRecord>(
        '/tenant/non-motor/policy-details',
        data,
      )
      .then((r) => r.data),

  getCustomers: async () => {
    const response = await customersApi.getCustomers({
      limit: API_MAX_LIST_LIMIT,
    });
    return response.data;
  },
  getQuotations: motorApi.getQuotations,
  getPolicies: motorApi.getPolicies,
  getPolicyRisks: motorApi.getPolicyRisks,
};
