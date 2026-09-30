import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { claimsApi } from './api';
import type { ClaimDetail, ClaimListParams, ClaimQueue } from './types';

export const claimsKeys = {
  all: ['claims'] as const,
  lists: () => [...claimsKeys.all, 'list'] as const,
  list: (params: ClaimListParams) => [...claimsKeys.lists(), params] as const,
  detail: (id: string) => [...claimsKeys.all, 'detail', id] as const,
  timeline: (id: string) => [...claimsKeys.all, 'timeline', id] as const,
  tira: (id: string) => [...claimsKeys.all, 'tira', id] as const,
  policyLookup: (q: string) => [...claimsKeys.all, 'policy-lookup', q] as const,
  policyDetail: (id: string) => [...claimsKeys.all, 'policy', id] as const,
};

const LIST_FILTERS = ['status', 'from', 'to'] as const;

/**
 * Server-paginated claim list with page, limit, search and filters kept in
 * the URL. `queue` narrows it to one stage menu (§3).
 */
export function useClaimsList(queue?: ClaimQueue) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '20');
  const search = params.get('search') ?? '';
  const filters = Object.fromEntries(
    LIST_FILTERS.map((key) => [key, params.get(key) ?? '']),
  ) as Record<(typeof LIST_FILTERS)[number], string>;

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

  const queryParams = useMemo<ClaimListParams>(
    () => ({
      page,
      limit,
      queue,
      search: search.trim() || undefined,
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [page, limit, queue, search, filters.status, filters.from, filters.to],
  );

  const query = useQuery({
    queryKey: claimsKeys.list(queryParams),
    queryFn: () => claimsApi.list(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  return {
    query,
    page,
    limit,
    search,
    filters,
    setFilter,
    setSearch: (value: string) => setFilter('search', value),
    setPage: (value: number) =>
      update((next) => next.set('page', String(value))),
    setLimit: (value: number) =>
      update((next) => {
        next.set('limit', String(value));
        next.set('page', '1');
      }),
  };
}

/** A claim waiting on TIRA is polled so its status updates without a reload. */
const AWAITING_TIRA = new Set([
  'NOTIFICATION_SUBMITTED',
  'INTIMATION_SUBMITTED',
]);

export function useClaim(id: string | undefined) {
  return useQuery({
    queryKey: claimsKeys.detail(id ?? ''),
    queryFn: () => claimsApi.get(id!),
    enabled: !!id,
    retry: false,
    refetchInterval: (query) =>
      query.state.data && AWAITING_TIRA.has(query.state.data.status)
        ? 10_000
        : false,
  });
}

export function useClaimTimeline(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: claimsKeys.timeline(id ?? ''),
    queryFn: () => claimsApi.timeline(id!),
    enabled: !!id && enabled,
  });
}

export function usePolicyLookup(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: claimsKeys.policyLookup(q),
    queryFn: () => claimsApi.policyLookup(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

export function usePolicyDetail(policyId: string | undefined) {
  return useQuery({
    queryKey: claimsKeys.policyDetail(policyId ?? ''),
    queryFn: () => claimsApi.policyDetail(policyId!),
    enabled: !!policyId,
    staleTime: 30_000,
  });
}

/** Refreshes every view of a claim after a change. */
export function useInvalidateClaim() {
  const queryClient = useQueryClient();
  return useCallback(
    (claim?: Pick<ClaimDetail, 'id'> | string) => {
      const id = typeof claim === 'string' ? claim : claim?.id;
      void queryClient.invalidateQueries({ queryKey: claimsKeys.lists() });
      if (id) {
        void queryClient.invalidateQueries({ queryKey: claimsKeys.detail(id) });
        void queryClient.invalidateQueries({
          queryKey: claimsKeys.timeline(id),
        });
      }
    },
    [queryClient],
  );
}

export function useSubmitNotification() {
  const invalidate = useInvalidateClaim();
  return useMutation({
    mutationFn: ({ id, retry }: { id: string; retry?: boolean }) =>
      retry
        ? claimsApi.retryNotification(id)
        : claimsApi.submitNotification(id),
    onSuccess: (_result, { id }) => invalidate(id),
    // A failed submission may still have moved the claim; refresh it.
    onError: (_error, { id }) => invalidate(id),
  });
}

/**
 * A stage action on a claim (intimation, reserve, assessment, approval...).
 * The claim is refreshed afterwards whether it succeeded or not, since a
 * refused TIRAMIS submission may still have changed its status. Callers show
 * `mutation.error` next to the form that caused it.
 */
export function useClaimAction<TVariables = void, TResult = unknown>(
  claimId: string,
  action: (variables: TVariables) => Promise<TResult>,
  successMessage?: string | ((result: TResult) => string),
) {
  const invalidate = useInvalidateClaim();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      if (successMessage) {
        toast.success(
          typeof successMessage === 'function'
            ? successMessage(result)
            : successMessage,
        );
      }
    },
    onSettled: () => {
      invalidate(claimId);
      void queryClient.invalidateQueries({
        queryKey: claimsKeys.tira(claimId),
      });
    },
  });
}

export const approvalLimitsKey = [
  ...claimsKeys.all,
  'approval-limits',
] as const;

export function useApprovalLimits(enabled = true) {
  return useQuery({
    queryKey: approvalLimitsKey,
    queryFn: claimsApi.approvalLimits,
    enabled,
  });
}

export function useDeleteClaimDraft() {
  const invalidate = useInvalidateClaim();
  return useMutation({
    mutationFn: (id: string) => claimsApi.removeDraft(id),
    onSuccess: () => invalidate(),
  });
}
