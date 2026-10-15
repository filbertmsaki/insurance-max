import { useCallback, useMemo, useState } from 'react';
import type { SortOrder } from '@/types';

export const TABLE_PAGE_SIZES = [10, 20, 50, 100] as const;
const MAX_PAGE_SIZE = 100;

export interface TableStateOptions<F extends string = string> {
  /** Module-specific filter keys tracked alongside page/search/sort. */
  filterKeys?: readonly F[];
  defaultSortBy?: string;
  defaultSortOrder?: SortOrder;
  defaultLimit?: number;
  /** Filter values applied on first render (e.g. a tab's preset status). */
  initialFilters?: Partial<Record<F, string>>;
}

export interface TableQueryParams<F extends string = string> {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters: Partial<Record<F, string>>;
}

interface InternalState {
  page: number;
  limit: number;
  search: string;
  sortBy?: string;
  sortOrder: SortOrder;
  filters: Record<string, string>;
}

function clampLimit(value: number) {
  return Math.min(Math.max(Math.floor(value) || 1, 1), MAX_PAGE_SIZE);
}

/**
 * Controlled table state (page, page size, search, sort, filters) held in
 * component memory. It is deliberately never written to the browser URL:
 * table interactions must not change the pathname, query string or hash.
 * Each hook instance is independent, so several tables on one page don't
 * collide. Search, filter, sort and page-size changes reset to page 1.
 */
export function useTableState<F extends string = string>(
  options: TableStateOptions<F> = {},
) {
  const {
    filterKeys = [] as readonly F[],
    defaultSortBy,
    defaultSortOrder = 'DESC',
    defaultLimit = 10,
    initialFilters,
  } = options;

  const createInitial = useCallback(
    (): InternalState => ({
      page: 1,
      limit: clampLimit(defaultLimit),
      search: '',
      sortBy: defaultSortBy,
      sortOrder: defaultSortOrder,
      filters: Object.fromEntries(
        Object.entries(initialFilters ?? {}).filter(([, v]) => Boolean(v)),
      ) as Record<string, string>,
    }),
    // Defaults are module constants; re-reading them on every render is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [state, setState] = useState<InternalState>(createInitial);

  const setPage = useCallback(
    (p: number) => setState((s) => ({ ...s, page: Math.max(1, Math.floor(p) || 1) })),
    [],
  );
  const setLimit = useCallback(
    (l: number) => setState((s) => ({ ...s, limit: clampLimit(l), page: 1 })),
    [],
  );
  const setSearch = useCallback(
    (value: string) =>
      setState((s) => {
        const search = value.trim();
        return search === s.search ? s : { ...s, search, page: 1 };
      }),
    [],
  );
  const setSort = useCallback(
    (key: string, order: SortOrder) =>
      setState((s) => ({ ...s, sortBy: key, sortOrder: order, page: 1 })),
    [],
  );
  /** Applies several filter changes in one update (e.g. cascading parent/child filters). */
  const setFilters = useCallback(
    (changes: Partial<Record<F, string | null | undefined>>) =>
      setState((s) => {
        const filters = { ...s.filters };
        for (const [key, value] of Object.entries(changes)) {
          if (value) filters[key] = value as string;
          else delete filters[key];
        }
        return { ...s, filters, page: 1 };
      }),
    [],
  );
  const setFilter = useCallback(
    (key: F, value: string) => setFilters({ [key]: value } as Partial<Record<F, string>>),
    [setFilters],
  );
  const clearFilters = useCallback(
    () => setState((s) => ({ ...s, search: '', filters: {}, page: 1 })),
    [],
  );
  /** Restores defaults, e.g. when the active user or company changes. */
  const reset = useCallback(() => setState(createInitial()), [createInitial]);

  const filterSignature = filterKeys.map((key) => state.filters[key] ?? '').join('\u0000');
  const filters = useMemo(() => {
    const result: Partial<Record<F, string>> = {};
    filterKeys.forEach((key) => {
      if (state.filters[key]) result[key] = state.filters[key];
    });
    return result;
    // filterKeys is expected to be a stable module constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  const { page, limit, search, sortBy, sortOrder } = state;
  const query: TableQueryParams<F> = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      sortBy,
      sortOrder: sortBy ? sortOrder : undefined,
      filters,
    }),
    [filters, limit, page, search, sortBy, sortOrder],
  );

  return {
    ...query,
    query,
    hasActiveFilters: Boolean(search) || Object.keys(filters).length > 0,
    setPage,
    setLimit,
    setSearch,
    setSort,
    setFilter,
    setFilters,
    clearFilters,
    reset,
  };
}

export type TableState<F extends string = string> = ReturnType<typeof useTableState<F>>;

/** Flattens table state into API query params: `{ page, limit, search, sortBy, sortOrder, ...filters }`. */
export function toListParams<F extends string>(query: TableQueryParams<F>) {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.search ? { search: query.search } : {}),
    ...(query.sortBy ? { sortBy: query.sortBy, sortOrder: query.sortOrder } : {}),
    ...query.filters,
  };
}
