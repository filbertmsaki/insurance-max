import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { PolicyRecord } from '@/modules/tenant/policies/types';
import type { QuotationRecord } from '@/modules/tenant/quotations/types';
import {
  buildPolicyTiramisPayload,
  buildQuotationTiramisPayload,
} from './utils';
import { tiramisApi } from './api';
import { useServerTable } from '@/components/data-table';
import type {
  PortalTiramisSubmitPayload,
  TenantTiramisSubmissionListParams,
  TiramisSubmissionRecord,
  TiramisTrackingRecord,
} from './types';

export const tiramisKeys = {
  all: ['tiramis'] as const,
  tenantSubmissions: () => [...tiramisKeys.all, 'tenant-submissions'] as const,
  tenantSubmission: (id: string) =>
    [...tiramisKeys.all, 'tenant-submission', id] as const,
  tenantSubmissionRequest: (requestId: string) =>
    [...tiramisKeys.all, 'tenant-submission-request', requestId] as const,
  localTracking: () => [...tiramisKeys.all, 'local-tracking'] as const,
  localTrackingDetail: (id: string) =>
    [...tiramisKeys.all, 'local-tracking-detail', id] as const,
  adminDashboard: () => [...tiramisKeys.all, 'admin-dashboard'] as const,
  adminHealth: () => [...tiramisKeys.all, 'admin-health'] as const,
  adminSubmissions: () => [...tiramisKeys.all, 'admin-submissions'] as const,
  adminSubmission: (id: string) =>
    [...tiramisKeys.all, 'admin-submission', id] as const,
  adminFailed: () => [...tiramisKeys.all, 'admin-failed'] as const,
  adminRetryable: () => [...tiramisKeys.all, 'admin-retryable'] as const,
  businessReadiness: (params?: {
    requestType?: string;
    sourceModule?: string;
    sourceRecordId?: string;
  }) =>
    [
      ...tiramisKeys.all,
      'business-readiness',
      params?.requestType ?? '',
      params?.sourceModule ?? '',
      params?.sourceRecordId ?? '',
    ] as const,
  salePoints: (branchId?: string) =>
    [...tiramisKeys.all, 'sale-points', branchId ?? 'all'] as const,
};

/** Every list a retry / sync can move a record into or out of. */
function invalidateTrackingLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: tiramisKeys.adminDashboard() });
  qc.invalidateQueries({ queryKey: tiramisKeys.localTracking() });
  qc.invalidateQueries({ queryKey: tiramisKeys.adminFailed() });
  qc.invalidateQueries({ queryKey: tiramisKeys.adminRetryable() });
}

export const TENANT_SUBMISSION_FILTER_KEYS = [
  'status',
  'request_id',
  'business_reference',
] as const;
export type TenantSubmissionFilterKey =
  (typeof TENANT_SUBMISSION_FILTER_KEYS)[number];

/**
 * Server-side table for tenant TIRAMIS submissions: URL-backed paging,
 * search and filters; waits for auth hydration before the first request.
 */
export function useTenantSubmissionsTable(
  defaults?: Pick<TenantTiramisSubmissionListParams, 'sourceModule'>,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const company = useAuthStore((state) => state.company);
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, []);

  return useServerTable<TiramisSubmissionRecord, TenantSubmissionFilterKey>({
    queryKey: tiramisKeys.tenantSubmissions(),
    fetcher: (params, signal) => tiramisApi.getSubmissions(params, signal),
    filterKeys: TENANT_SUBMISSION_FILTER_KEYS,
    defaultLimit: 10,
    extraParams: defaults?.sourceModule
      ? { sourceModule: defaults.sourceModule }
      : undefined,
    enabled: hydrated && !!accessToken && !!company?.id,
  });
}

export function useTenantSubmissionDetail(id?: string) {
  return useQuery({
    queryKey: id
      ? tiramisKeys.tenantSubmission(id)
      : tiramisKeys.tenantSubmission(''),
    queryFn: () => tiramisApi.getSubmission(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useTenantSubmissionByRequestId(requestId?: string) {
  return useQuery({
    queryKey: requestId
      ? tiramisKeys.tenantSubmissionRequest(requestId)
      : tiramisKeys.tenantSubmissionRequest(''),
    queryFn: () => tiramisApi.getSubmissionByRequestId(requestId!),
    enabled: !!requestId,
    staleTime: 30_000,
  });
}

export function useSubmitTenantTiramisSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PortalTiramisSubmitPayload) =>
      tiramisApi.submit(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tiramisKeys.tenantSubmissions() });
      toast.success('TIRAMIS submission started');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useTiramisSalePoints(
  branchId?: string,
  options?: {
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: tiramisKeys.salePoints(branchId),
    queryFn: () => tiramisApi.getSalePoints(branchId),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTiramisBusinessReadiness(
  params:
    | {
        requestType: PortalTiramisSubmitPayload['requestType'];
        sourceModule: string;
        sourceRecordId: string;
        payload?: Record<string, unknown>;
      }
    | undefined,
  options?: {
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: tiramisKeys.businessReadiness(params),
    queryFn: () => tiramisApi.validateBusiness(params!),
    enabled:
      (options?.enabled ?? true) &&
      !!params?.requestType &&
      !!params?.sourceModule &&
      !!params?.sourceRecordId,
    staleTime: 10_000,
  });
}

export function useSubmitQuotationToTiramis(
  quotation?: QuotationRecord | null,
) {
  const submitMutation = useSubmitTenantTiramisSubmission();
  return useMutation({
    mutationFn: async (options?: {
      branch_id?: string;
      sale_point_id?: string;
    }) => {
      if (!quotation) throw new Error('Quotation not found');
      return submitMutation.mutateAsync(
        buildQuotationTiramisPayload(quotation, options),
      );
    },
  });
}

export function useSubmitPolicyToTiramis(policy?: PolicyRecord | null) {
  const submitMutation = useSubmitTenantTiramisSubmission();
  return useMutation({
    mutationFn: async (options?: {
      branch_id?: string;
      sale_point_id?: string;
    }) => {
      if (!policy) throw new Error('Policy not found');
      return submitMutation.mutateAsync(
        buildPolicyTiramisPayload(policy, options),
      );
    },
  });
}

export function useTiramisServiceHealth() {
  return useQuery({
    queryKey: [...tiramisKeys.all, 'service-health'],
    queryFn: () => tiramisApi.getServiceHealth(),
    staleTime: 30_000,
  });
}

export const TRACKING_FILTER_KEYS = [
  'status',
  'tiramisRequestId',
  'businessReference',
] as const;
export type TrackingFilterKey = (typeof TRACKING_FILTER_KEYS)[number];

/** Server-side table over local TIRAMIS tracking records (company-scoped by the API). */
export function useLocalTrackingTable() {
  return useServerTable<TiramisTrackingRecord, TrackingFilterKey>({
    queryKey: tiramisKeys.localTracking(),
    fetcher: (params, signal) => tiramisApi.getAdminSubmissions(params, signal),
    filterKeys: TRACKING_FILTER_KEYS,
    defaultLimit: 10,
  });
}

export function useLocalTrackingDetail(id?: string) {
  return useQuery({
    queryKey: id
      ? tiramisKeys.localTrackingDetail(id)
      : tiramisKeys.localTrackingDetail(''),
    queryFn: () => tiramisApi.getLocalTrackingById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useLocalTrackingByBusinessReference(
  businessReference?: string,
) {
  return useQuery({
    queryKey: [
      ...tiramisKeys.localTracking(),
      'business-reference',
      businessReference ?? '',
    ],
    queryFn: () =>
      tiramisApi.getLocalTrackingByBusinessReference(businessReference!),
    enabled: !!businessReference,
    staleTime: 30_000,
  });
}

export function useRetryLocalTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => tiramisApi.retryLocalTracking(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tiramisKeys.localTracking() });
      toast.success('Retry triggered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useRetryOneLocalTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tiramisApi.retryOneLocalTracking(id),
    onSuccess: () => {
      invalidateTrackingLists(qc);
      toast.success('Retry triggered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useSyncOneLocalTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tiramisApi.syncOneLocalTracking(id),
    onSuccess: (_result, id) => {
      invalidateTrackingLists(qc);
      qc.invalidateQueries({ queryKey: tiramisKeys.localTrackingDetail(id) });
      qc.invalidateQueries({ queryKey: tiramisKeys.tenantSubmissions() });
      qc.invalidateQueries({ queryKey: tiramisKeys.tenantSubmission(id) });
      qc.invalidateQueries({
        queryKey: [...tiramisKeys.all, 'tenant-submission-request'],
      });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Sync triggered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

/** Dashboard summary cards (totals and breakdowns); independent of the table below. */
export function useTiramisDashboard() {
  return useQuery({
    queryKey: [...tiramisKeys.adminDashboard(), 'summary'],
    queryFn: ({ signal }) =>
      tiramisApi.getAdminDashboard({ page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  });
}

/** Server-side "recent submissions" table on the dashboard endpoint (same company scope). */
export function useTiramisDashboardTable() {
  return useServerTable<TiramisTrackingRecord, TrackingFilterKey>({
    queryKey: tiramisKeys.adminDashboard(),
    fetcher: (params, signal) => tiramisApi.getAdminDashboard(params, signal),
    filterKeys: TRACKING_FILTER_KEYS,
    defaultLimit: 10,
  });
}

export function useTiramisAdminHealth() {
  return useQuery({
    queryKey: [...tiramisKeys.adminHealth(), 'health'],
    queryFn: () => tiramisApi.getAdminHealth(),
    staleTime: 30_000,
  });
}

export function useTiramisStatistics() {
  return useQuery({
    queryKey: [...tiramisKeys.adminDashboard(), 'statistics'],
    queryFn: () => tiramisApi.getAdminStatistics(),
    staleTime: 30_000,
  });
}

/** Server-side table of failed submissions. */
export function useFailedSubmissionsTable() {
  return useServerTable<TiramisTrackingRecord>({
    queryKey: tiramisKeys.adminFailed(),
    fetcher: (params, signal) => tiramisApi.getAdminFailedPage(params, signal),
    defaultSortBy: 'updated',
  });
}

/** Server-side table of retry-pending submissions. */
export function useRetryableSubmissionsTable() {
  return useServerTable<TiramisTrackingRecord>({
    queryKey: tiramisKeys.adminRetryable(),
    fetcher: (params, signal) =>
      tiramisApi.getAdminRetryablePage(params, signal),
    defaultSortBy: 'nextRetry',
    defaultSortOrder: 'ASC',
  });
}

export function useAdminSubmission(id?: string) {
  return useQuery({
    queryKey: id
      ? tiramisKeys.adminSubmission(id)
      : tiramisKeys.adminSubmission(''),
    queryFn: () => tiramisApi.getAdminSubmission(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useAdminTimeline(id?: string) {
  return useQuery({
    queryKey: [...tiramisKeys.adminSubmission(id ?? ''), 'timeline'],
    queryFn: () => tiramisApi.getAdminTimeline(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useRetryAdminSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tiramisApi.retryAdminSubmission(id),
    onSuccess: () => {
      invalidateTrackingLists(qc);
      qc.invalidateQueries({ queryKey: tiramisKeys.adminSubmission('') });
      toast.success('Retry triggered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useSyncAdminSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tiramisApi.syncAdminSubmission(id),
    onSuccess: () => {
      invalidateTrackingLists(qc);
      qc.invalidateQueries({ queryKey: tiramisKeys.adminSubmission('') });
      toast.success('Sync triggered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useScheduleAdminRetry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      tiramisApi.scheduleAdminRetry(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tiramisKeys.adminDashboard() });
      toast.success('Retry scheduled');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useSyncAdminBusinessRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tiramisApi.syncAdminBusinessRecord(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tiramisKeys.adminDashboard() });
      toast.success('Business record synced');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}
