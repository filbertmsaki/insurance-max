import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { customersApi } from '@/modules/tenant/customers/api';
import {
  useQuotationCategories,
  useQuotationProducts,
  useQuotationSubClasses,
} from '@/modules/tenant/quotations/hooks';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { getApiErrorMessage } from '@/lib/api-error';
import { policiesApi } from './api';
import { buildPolicyPayload, type PolicyFormSchemaValues } from './schemas';
import type { PolicyListParams, PolicyRecord } from './types';

const policyKeys = {
  all: ['policies'] as const,
  list: (params: PolicyListParams) => ['policies', 'list', params] as const,
  detail: (id: string) => ['policies', 'detail', id] as const,
  endorsements: (policyId: string) =>
    ['policies', 'detail', policyId, 'endorsements'] as const,
  risks: (id: string) => ['policies', 'risks', id] as const,
  breakdowns: (id: string) => ['policies', 'breakdowns', id] as const,
  history: (id: string) => ['policies', 'history', id] as const,
};

export function usePoliciesList() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const policyStatus = params.get('policy_status') ?? 'all';
  const customerId = params.get('customer_id') ?? 'all';

  const queryParams = useMemo<PolicyListParams>(
    () => ({
      page,
      limit,
      search: search || undefined,
      policy_status: policyStatus === 'all' ? undefined : policyStatus,
      customer_id: customerId === 'all' ? undefined : customerId,
    }),
    [page, limit, search, policyStatus, customerId],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: policyKeys.list(queryParams),
    queryFn: () => policiesApi.getList(queryParams),
    staleTime: 30_000,
  });

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        next.set('page', '1');
        return next;
      });
    },
    [setParams],
  );

  return {
    data,
    isLoading,
    error,
    page,
    limit,
    search,
    policyStatus,
    customerId,
    setSearch: (value: string) => setParam('search', value),
    setPolicyStatus: (value: string) =>
      setParam('policy_status', value === 'all' ? null : value),
    setCustomerId: (value: string) =>
      setParam('customer_id', value === 'all' ? null : value),
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

export function usePolicyDetail(id?: string) {
  return useQuery({
    queryKey: id ? policyKeys.detail(id) : policyKeys.detail(''),
    queryFn: () => policiesApi.getById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function usePolicyEndorsements(policyId?: string, enabled = true) {
  return useQuery({
    queryKey: policyId
      ? policyKeys.endorsements(policyId)
      : policyKeys.endorsements(''),
    queryFn: () => policiesApi.getEndorsements(policyId!),
    enabled: !!policyId && enabled,
    staleTime: 30_000,
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PolicyFormSchemaValues) =>
      policiesApi.create(buildPolicyPayload(values)),
    onSuccess: (policy) => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      qc.setQueryData(policyKeys.detail(policy.id), policy);
      toast.success('Policy created');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useUpdatePolicy(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PolicyFormSchemaValues) =>
      policiesApi.update(id!, buildPolicyPayload(values)),
    onSuccess: (policy) => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      if (id) qc.setQueryData(policyKeys.detail(id), policy);
      toast.success('Policy updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useSubmitPolicyEndorsementToTiramis(policyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endorsementId: string) =>
      policiesApi.submitEndorsementToTiramis(endorsementId),
    onSuccess: () => {
      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.endorsements(policyId) });
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
      }
      toast.success('Endorsement submitted to TIRAMIS');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRetryPolicyEndorsementTiramis(policyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endorsementId: string) =>
      policiesApi.retryEndorsementTiramis(endorsementId),
    onSuccess: () => {
      if (policyId) {
        qc.invalidateQueries({ queryKey: policyKeys.endorsements(policyId) });
        qc.invalidateQueries({ queryKey: policyKeys.detail(policyId) });
      }
      toast.success('Endorsement TIRAMIS submission retried');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function useRestorePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policiesApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKeys.all });
      toast.success('Policy restored');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
}

export function usePolicyCustomers() {
  return useQuery({
    queryKey: ['policies', 'customers'],
    queryFn: async () =>
      (await customersApi.getCustomers({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}

export function usePolicyCategories() {
  return useQuotationCategories();
}

export function usePolicyProducts(categoryId?: string) {
  return useQuotationProducts(categoryId);
}

export function usePolicySubClasses(productId?: string) {
  return useQuotationSubClasses(productId);
}

export function usePolicyCurrentCompanyId() {
  return useAuthStore(
    (state) => state.company?.id ?? state.user?.companyId ?? '',
  );
}

export { policyKeys };
export type { PolicyRecord };
