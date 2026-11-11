import { useCallback, useMemo, useState } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { ListQuery, ListResult } from './types';
import type { ListState } from './useListState';

export function toListQuery(state: ListState): ListQuery {
  return {
    page: state.page,
    limit: state.limit,
    search: state.search || undefined,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    view: state.view || undefined,
    type: state.type || undefined,
    filters: state.filters,
  };
}

/**
 * One data source for every layout. The cache key includes the active user
 * and company (as `useServerTable` does), so one user's rows are never shown
 * to another. Phones accumulate pages for "Load more"; tablet and desktop
 * show one page at a time from the same query.
 */
export function useListData<T>({
  queryKey,
  state,
  fetchRows,
  rowId,
}: {
  queryKey: QueryKey;
  state: ListState;
  fetchRows: (query: ListQuery, signal: AbortSignal) => Promise<ListResult<T>>;
  rowId: (row: T) => string;
}) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const companyId = useAuthStore((s) => s.company?.id ?? null);
  const listQuery = toListQuery(state);
  const fullKey = [...queryKey, 'list-page', { userId, companyId }, listQuery];

  const query = useQuery({
    queryKey: fullKey,
    queryFn: ({ signal }) => fetchRows(listQuery, signal),
    placeholderData: keepPreviousData,
  });

  // Phone "Load more": rows from earlier pages of the same search/filters.
  const filterSignature = JSON.stringify({ ...listQuery, page: 0 });
  const [earlier, setEarlier] = useState<{ signature: string; rows: T[] }>({
    signature: filterSignature,
    rows: [],
  });
  const earlierRows = useMemo(
    () => (earlier.signature === filterSignature ? earlier.rows : []),
    [earlier, filterSignature],
  );

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / state.limit));

  const updateRow = useCallback(
    (id: string, patch: Partial<T>) => {
      queryClient.setQueriesData<ListResult<T>>(
        { queryKey: [...queryKey, 'list-page'] },
        (data) =>
          data && {
            ...data,
            rows: data.rows.map((row) =>
              rowId(row) === id ? { ...row, ...patch } : row,
            ),
          },
      );
      setEarlier((current) => ({
        ...current,
        rows: current.rows.map((row) =>
          rowId(row) === id ? { ...row, ...patch } : row,
        ),
      }));
    },
    [queryClient, queryKey, rowId],
  );

  /** Keeps the current rows and moves to the next page (phone list). */
  const loadMore = useCallback(
    (setPage: (page: number) => void) => {
      setEarlier({
        signature: filterSignature,
        rows: [...earlierRows, ...rows],
      });
      setPage(state.page + 1);
    },
    [earlierRows, filterSignature, rows, state.page],
  );

  return {
    query,
    rows,
    /** Phone list: every loaded page so far. */
    accumulatedRows: [...earlierRows, ...rows],
    total,
    totalPages,
    summary: query.data?.summary,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.isError,
    refresh: () => query.refetch(),
    updateRow,
    loadMore,
  };
}
