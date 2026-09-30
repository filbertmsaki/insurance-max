import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import type { CustomerListParams } from '@/modules/tenant/customers/types';
import type { QuotationStatus } from '@/modules/tenant/quotations/types';
import { underwriteApi } from './api';
import { getUnderwriteLineMetaBySlug, type UnderwriteLineMeta } from './lines';

export const underwriteKeys = {
  all: ['underwrite'] as const,
  overview: () => [...underwriteKeys.all, 'overview'] as const,
  lineDashboard: (line: UnderwriteLineSlug) =>
    [...underwriteKeys.all, line, 'dashboard'] as const,
  quotations: (line: UnderwriteLineSlug, params: object) =>
    [...underwriteKeys.all, line, 'quotations', params] as const,
  quotation: (line: UnderwriteLineSlug, id: string) =>
    [...underwriteKeys.all, line, 'quotation', id] as const,
  policies: (line: UnderwriteLineSlug, params: object) =>
    [...underwriteKeys.all, line, 'policies', params] as const,
  policy: (line: UnderwriteLineSlug, id: string) =>
    [...underwriteKeys.all, line, 'policy', id] as const,
  transactions: (line: UnderwriteLineSlug, kind: string) =>
    [...underwriteKeys.all, line, kind] as const,
  tiraQueue: (line: UnderwriteLineSlug, kind: 'failed' | 'pending') =>
    [...underwriteKeys.all, line, 'tira', kind] as const,
};

/** The line addressed by the current `/underwrite/:line/...` route. */
export function useUnderwriteLineParam(): UnderwriteLineMeta | null {
  const { line } = useParams<{ line: string }>();
  return getUnderwriteLineMetaBySlug(line);
}

export function useUnderwriteOverview() {
  return useQuery({
    queryKey: underwriteKeys.overview(),
    queryFn: underwriteApi.getOverview,
    staleTime: 30_000,
  });
}

export function useUnderwriteLineDashboard(line: UnderwriteLineSlug) {
  return useQuery({
    queryKey: underwriteKeys.lineDashboard(line),
    queryFn: () => underwriteApi.getLineDashboard(line),
    staleTime: 30_000,
  });
}

/** Page, limit, search and filters kept in the URL like the legacy lists. */
function useListSearchParams(filterKeys: readonly string[]) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const filterValues = filterKeys.map((key) => params.get(key) ?? 'all');

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      }),
    [setParams],
  );

  const setFilter = useCallback(
    (key: string, value: string) =>
      update((next) => {
        if (!value || value === 'all') next.delete(key);
        else next.set(key, value);
        next.set('page', '1');
      }),
    [update],
  );

  return {
    page,
    limit,
    search,
    filters: Object.fromEntries(
      filterKeys.map((key, index) => [key, filterValues[index]]),
    ) as Record<string, string>,
    setSearch: (value: string) => setFilter('search', value),
    setFilter,
    setPage: (value: number) =>
      update((next) => next.set('page', String(value))),
    setLimit: (value: number) =>
      update((next) => {
        next.set('limit', String(value));
        next.set('page', '1');
      }),
  };
}

const QUOTATION_FILTERS = ['status'] as const;
const POLICY_FILTERS = ['policy_status'] as const;
const CUSTOMER_FILTERS = [] as const;

export function useUnderwriteQuotations(line: UnderwriteLineSlug) {
  const list = useListSearchParams(QUOTATION_FILTERS);
  const status = list.filters.status;

  const queryParams = useMemo(
    () => ({
      page: list.page,
      limit: list.limit,
      search: list.search || undefined,
      status: status === 'all' ? undefined : (status as QuotationStatus),
    }),
    [list.page, list.limit, list.search, status],
  );

  const query = useQuery({
    queryKey: underwriteKeys.quotations(line, queryParams),
    queryFn: () => underwriteApi.getQuotations(line, queryParams),
    staleTime: 30_000,
  });

  return { ...list, status, query };
}

export function useUnderwritePolicies(line: UnderwriteLineSlug) {
  const list = useListSearchParams(POLICY_FILTERS);
  const policyStatus = list.filters.policy_status;

  const queryParams = useMemo(
    () => ({
      page: list.page,
      limit: list.limit,
      search: list.search || undefined,
      policy_status: policyStatus === 'all' ? undefined : policyStatus,
    }),
    [list.page, list.limit, list.search, policyStatus],
  );

  const query = useQuery({
    queryKey: underwriteKeys.policies(line, queryParams),
    queryFn: () => underwriteApi.getPolicies(line, queryParams),
    staleTime: 30_000,
  });

  return { ...list, policyStatus, query };
}

/**
 * Confirms a record belongs to the line (the backend answers 404 otherwise)
 * before a shared detail screen renders it.
 */
export function useUnderwriteRecordCheck(
  kind: 'quotation' | 'policy',
  line: UnderwriteLineSlug,
  id: string | undefined,
) {
  const quotation = useQuery({
    queryKey: underwriteKeys.quotation(line, id ?? ''),
    queryFn: () => underwriteApi.getQuotation(line, id!),
    enabled: kind === 'quotation' && !!id,
    retry: false,
    staleTime: 30_000,
  });
  const policy = useQuery({
    queryKey: underwriteKeys.policy(line, id ?? ''),
    queryFn: () => underwriteApi.getPolicy(line, id!),
    enabled: kind === 'policy' && !!id,
    retry: false,
    staleTime: 30_000,
  });

  const active = kind === 'quotation' ? quotation : policy;
  return {
    isLoading: active.isLoading,
    isError: active.isError,
    quotation: quotation.data,
    policy: policy.data,
  };
}

export function useUnderwriteCustomers(line: UnderwriteLineSlug) {
  const list = useListSearchParams(CUSTOMER_FILTERS);
  const [params, setParams] = useSearchParams();
  const sortBy = params.get('sortBy') ?? 'created_at';
  const sortOrder: 'ASC' | 'DESC' =
    params.get('sortOrder') === 'ASC' ? 'ASC' : 'DESC';

  const queryParams = useMemo(
    () => ({
      page: list.page,
      limit: list.limit,
      search: list.search || undefined,
      sortBy: sortBy as CustomerListParams['sortBy'],
      sortOrder: sortOrder,
    }),
    [list.page, list.limit, list.search, sortBy, sortOrder],
  );

  const query = useQuery({
    queryKey: [...underwriteKeys.all, line, 'customers', queryParams] as const,
    queryFn: () => underwriteApi.getCustomers(line, queryParams),
    staleTime: 30_000,
  });

  const setSort = useCallback(
    (key: string, order: 'ASC' | 'DESC') =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sortBy', key);
        next.set('sortOrder', order);
        return next;
      }),
    [setParams],
  );

  return { ...list, sortBy, sortOrder, setSort, query };
}

export function useUnderwriteRenewals(line: UnderwriteLineSlug) {
  return useQuery({
    queryKey: underwriteKeys.transactions(line, 'renewals'),
    queryFn: () => underwriteApi.getRenewals(line),
    staleTime: 30_000,
  });
}

export function useUnderwriteEndorsements(line: UnderwriteLineSlug) {
  return useQuery({
    queryKey: underwriteKeys.transactions(line, 'endorsements'),
    queryFn: () => underwriteApi.getEndorsements(line),
    staleTime: 30_000,
  });
}

export function useUnderwriteCancellations(line: UnderwriteLineSlug) {
  return useQuery({
    queryKey: underwriteKeys.transactions(line, 'cancellations'),
    queryFn: () => underwriteApi.getCancellations(line),
    staleTime: 30_000,
  });
}

export function useUnderwriteTiraQueue(
  line: UnderwriteLineSlug,
  kind: 'failed' | 'pending',
) {
  return useQuery({
    queryKey: underwriteKeys.tiraQueue(line, kind),
    queryFn: () => underwriteApi.getTiraQueue(line, kind),
    staleTime: 30_000,
  });
}
