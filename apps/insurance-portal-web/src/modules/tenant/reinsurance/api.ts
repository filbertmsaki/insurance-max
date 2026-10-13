import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { CapacityEvaluation, ReinsuranceRecord } from './types';

export type ReinsuranceListView =
  | 'treaties'
  | 'cessions'
  | 'settlements'
  | 'offers'
  | 'recoveries';

export interface ReinsuranceListParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: string;
}

const LIST_PATHS: Record<ReinsuranceListView, string> = {
  treaties: '/tenant/reinsurance/treaties',
  cessions: '/tenant/reinsurance/cessions',
  settlements: '/tenant/reinsurance/settlements',
  offers: '/tenant/reinsurance/facultative-offers',
  recoveries: '/tenant/reinsurance/recoveries',
};

export const reinsuranceApi = {
  /** Server-side paged workbench list for one record type. */
  listPage: (
    view: ReinsuranceListView,
    params: ReinsuranceListParams,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<PaginatedResponse<ReinsuranceRecord>>(LIST_PATHS[view], {
        params,
        signal,
      })
      .then((r) => r.data),
  respondToTreatyInvitation: (
    treatyId: string,
    participantId: string,
    decision: 'ACCEPT' | 'DECLINE',
  ) =>
    apiClient
      .post(
        `/tenant/reinsurance/treaties/${treatyId}/participants/${participantId}/respond`,
        { decision },
      )
      .then((r) => r.data),
  respondToOffer: (id: string, quotedShare: number) =>
    apiClient
      .post(`/tenant/reinsurance/facultative-offers/${id}/respond`, {
        quoted_share_percent: quotedShare,
      })
      .then((r) => r.data),
  acceptOffer: (id: string, acceptedShare: number) =>
    apiClient
      .post(`/tenant/reinsurance/facultative-offers/${id}/accept`, {
        accepted_share_percent: acceptedShare,
      })
      .then((r) => r.data),
  admitRecovery: (id: string, amount: number) =>
    apiClient
      .post(`/tenant/reinsurance/recoveries/${id}/admit`, {
        admitted_amount: amount,
      })
      .then((r) => r.data),
  recordRecoveryReceipt: (id: string, amount: number, reference?: string) =>
    apiClient
      .post(`/tenant/reinsurance/recoveries/${id}/receipts`, {
        amount,
        reference: reference || undefined,
      })
      .then((r) => r.data),
  submitTreaty: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/treaties/${id}/submit`)
      .then((r) => r.data),
  approveTreaty: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/treaties/${id}/approve`)
      .then((r) => r.data),
  activateTreaty: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/treaties/${id}/activate`)
      .then((r) => r.data),
  submitCession: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/cessions/${id}/submit`)
      .then((r) => r.data),
  approveCession: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/cessions/${id}/approve`)
      .then((r) => r.data),
  applyCession: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/cessions/${id}/apply`)
      .then((r) => r.data),
  createDeclaration: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/cessions/${id}/declaration`)
      .then((r) => r.data),
  submitDeclarationToTiramis: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/declarations/${id}/tiramis`)
      .then((r) => r.data),
  submitSettlement: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/settlements/${id}/submit`)
      .then((r) => r.data),
  approveSettlement: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/settlements/${id}/approve`)
      .then((r) => r.data),
  paySettlement: (id: string) =>
    apiClient
      .post(`/tenant/reinsurance/settlements/${id}/pay`)
      .then((r) => r.data),
  evaluateCapacity: (data: Record<string, unknown>) =>
    apiClient
      .post<CapacityEvaluation>('/tenant/reinsurance/capacity/evaluate', data)
      .then((r) => r.data),
};
