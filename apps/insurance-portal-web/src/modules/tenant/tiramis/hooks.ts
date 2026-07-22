import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import type { PolicyRecord } from '@/modules/tenant/policies/types';
import type { QuotationRecord } from '@/modules/tenant/quotations/types';
import {
  buildPolicyTiramisPayload,
  buildQuotationTiramisPayload,
} from './utils';
import { tiramisApi } from './api';
import type { PortalTiramisSubmitPayload } from './types';

const tiramisKeys = {
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
  salePoints: (branchId?: string) =>
    [...tiramisKeys.all, 'sale-points', branchId ?? 'all'] as const,
};

function useTiramisSearchParams() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const requestId = params.get('requestId') ?? '';
  const businessReference = params.get('businessReference') ?? '';

  const setParam = (key: string, value: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      next.set('page', '1');
      return next;
    });
  };

  return {
    params,
    setParams,
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setParam,
  };
}

export function useTenantSubmissionsList() {
  const {
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setParam,
    setParams,
  } = useTiramisSearchParams();
  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      request_id: requestId || undefined,
      business_reference: businessReference || undefined,
    }),
    [page, limit, search, status, requestId, businessReference],
  );

  const query = useQuery({
    queryKey: [...tiramisKeys.tenantSubmissions(), queryParams],
    queryFn: () => tiramisApi.getSubmissions(queryParams),
    staleTime: 30_000,
  });

  return {
    ...query,
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setSearch: (value: string) => setParam('search', value),
    setStatus: (value: string) => setParam('status', value),
    setRequestId: (value: string) => setParam('requestId', value),
    setBusinessReference: (value: string) =>
      setParam('businessReference', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
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

export function useLocalTrackingList() {
  const {
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setParam,
    setParams,
  } = useTiramisSearchParams();
  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      tiramisRequestId: requestId || undefined,
      businessReference: businessReference || undefined,
    }),
    [page, limit, search, status, requestId, businessReference],
  );

  const query = useQuery({
    queryKey: [...tiramisKeys.localTracking(), queryParams],
    queryFn: () => tiramisApi.getAdminSubmissions(queryParams),
    staleTime: 30_000,
  });

  return {
    ...query,
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setSearch: (value: string) => setParam('search', value),
    setStatus: (value: string) => setParam('status', value),
    setRequestId: (value: string) => setParam('requestId', value),
    setBusinessReference: (value: string) =>
      setParam('businessReference', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
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
      qc.invalidateQueries({ queryKey: tiramisKeys.localTracking() });
      qc.invalidateQueries({ queryKey: tiramisKeys.adminDashboard() });
      toast.success('Retry triggered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useSyncOneLocalTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tiramisApi.syncOneLocalTracking(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tiramisKeys.localTracking() });
      qc.invalidateQueries({ queryKey: tiramisKeys.adminDashboard() });
      toast.success('Sync triggered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}

export function useTiramisDashboard() {
  const {
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setParam,
    setParams,
  } = useTiramisSearchParams();
  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      tiramisRequestId: requestId || undefined,
      businessReference: businessReference || undefined,
    }),
    [page, limit, search, status, requestId, businessReference],
  );
  const query = useQuery({
    queryKey: [...tiramisKeys.adminDashboard(), queryParams],
    queryFn: () => tiramisApi.getAdminDashboard(queryParams),
    staleTime: 30_000,
  });
  return {
    ...query,
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setSearch: (value: string) => setParam('search', value),
    setStatus: (value: string) => setParam('status', value),
    setRequestId: (value: string) => setParam('requestId', value),
    setBusinessReference: (value: string) =>
      setParam('businessReference', value),
    setPage: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      }),
    setLimit: (value: number) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      }),
  };
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

export function useFailedSubmissions(limit = 50) {
  return useQuery({
    queryKey: [...tiramisKeys.adminFailed(), limit],
    queryFn: () => tiramisApi.getAdminFailed(limit),
    staleTime: 30_000,
  });
}

export function useRetryableSubmissions(limit = 50) {
  return useQuery({
    queryKey: [...tiramisKeys.adminRetryable(), limit],
    queryFn: () => tiramisApi.getAdminRetryable(limit),
    staleTime: 30_000,
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
      qc.invalidateQueries({ queryKey: tiramisKeys.adminDashboard() });
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
      qc.invalidateQueries({ queryKey: tiramisKeys.adminDashboard() });
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
