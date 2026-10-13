import { useEffect } from 'react';
import {
  keepPreviousData,
  useQuery,
  type QueryKey,
} from '@tanstack/react-query';
import { normalizePaginatedResponse, type PaginatedResponse } from '@/modules/shared/api/pagination';
import {
  toListParams,
  useTableState,
  type TableStateOptions,
} from './useTableState';

type RawPage<T> = { data: T[]; meta?: unknown; pagination?: unknown };

export interface ServerTableOptions<T, F extends string> extends TableStateOptions<F> {
  /** Base cache key for the list; table params are appended automatically. */
  queryKey: QueryKey;
  /**
   * Fetches one page. Receives flattened params and an AbortSignal; pass the
   * signal to the HTTP client so superseded searches are cancelled.
   */
  fetcher: (
    params: ReturnType<typeof toListParams<F>>,
    signal: AbortSignal,
  ) => Promise<RawPage<T> | PaginatedResponse<T>>;
  enabled?: boolean;
  /** Extra params merged into every request (tab scope, parent id, ...). */
  extraParams?: Record<string, unknown>;
  /** Poll interval (ms) or a function of the latest page, e.g. while jobs are running. */
  refetchInterval?: number | false | ((rows: T[]) => number | false);
}

/**
 * Server-side table: URL-backed state + React Query fetch. Every request
 * includes page/limit/search/sort/filters in the cache key, so a response can
 * only populate the key it was requested for — stale searches can't overwrite
 * newer results. Previous data stays on screen while the next page loads.
 */
export function useServerTable<T, F extends string = string>(
  options: ServerTableOptions<T, F>,
) {
  const { queryKey, fetcher, enabled = true, extraParams, refetchInterval, ...stateOptions } = options;
  const state = useTableState<F>(stateOptions);
  const params = { ...toListParams(state.query), ...extraParams };

  const query = useQuery({
    queryKey: [...queryKey, 'table', params],
    queryFn: async ({ signal }) =>
      normalizePaginatedResponse<T>(await fetcher(params as never, signal)),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval:
      typeof refetchInterval === 'function'
        ? (q) => refetchInterval(q.state.data?.data ?? [])
        : refetchInterval,
  });

  const pagination = query.data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 0;

  // Out-of-range correction: after deletes or narrower filters, jump to the
  // last valid page instead of showing an empty page.
  const { page, setPage } = state;
  useEffect(() => {
    if (!query.isPlaceholderData && query.isSuccess && page > 1 && page > totalPages) {
      setPage(Math.max(totalPages, 1));
    }
  }, [page, query.isPlaceholderData, query.isSuccess, setPage, totalPages]);

  return {
    state,
    rows: query.data?.data ?? [],
    total,
    totalPages,
    query,
    /** Props to spread onto <DataTable />. */
    tableProps: {
      data: query.data?.data ?? [],
      loading: query.isLoading,
      isFetching: query.isFetching,
      isRefreshing: query.isRefetching && !query.isPlaceholderData,
      error: query.error ? (query.error as Error).message || 'Failed to load records' : undefined,
      onRetry: () => void query.refetch(),
      onRefresh: () => void query.refetch(),
      page: state.page,
      limit: state.limit,
      total,
      totalPages,
      onPageChange: state.setPage,
      onLimitChange: state.setLimit,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      onSortChange: state.setSort,
      search: state.search,
      onSearchChange: state.setSearch,
      onFilterChange: (key: string, value: string) => state.setFilter(key as F, value),
      onClearFilters: state.clearFilters,
    },
  };
}

/** Builds DataTable filter descriptors from option lists + current state. */
export function tableFilters<F extends string>(
  filters: Partial<Record<F, string>>,
  defs: Array<{ key: F; label: string; options: Array<{ label: string; value: string }>; placeholder?: string }>,
) {
  return defs.map((def) => ({ ...def, value: filters[def.key] ?? '' }));
}
