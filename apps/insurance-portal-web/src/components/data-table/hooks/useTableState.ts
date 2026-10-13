import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortOrder } from '@/types';

export const TABLE_PAGE_SIZES = [10, 20, 50, 100] as const;
const MAX_PAGE_SIZE = 100;

export interface TableStateOptions<F extends string = string> {
  /** Module-specific filter keys persisted alongside page/search/sort. */
  filterKeys?: readonly F[];
  defaultSortBy?: string;
  defaultSortOrder?: SortOrder;
  defaultLimit?: number;
  /**
   * Prefix for URL params when a page renders more than one table
   * (e.g. `inv` → `inv_page`, `inv_q`). Omit for a page's main table.
   */
  prefix?: string;
  /** Keep state in component memory instead of the URL (dialogs, tabs inside drawers). */
  persist?: 'url' | 'memory';
}

export interface TableQueryParams<F extends string = string> {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters: Partial<Record<F, string>>;
}

function useParamStore(persist: 'url' | 'memory') {
  const [urlParams, setUrlParams] = useSearchParams();
  const [memParams, setMemParams] = useState(() => new URLSearchParams());
  return persist === 'url'
    ? ([urlParams, setUrlParams] as const)
    : ([
        memParams,
        (fn: (prev: URLSearchParams) => URLSearchParams) =>
          setMemParams((prev) => fn(new URLSearchParams(prev))),
      ] as const);
}

/**
 * Controlled table state (page, page size, search, sort, filters), persisted
 * in the URL by default so refresh/share/back-navigation keep the view.
 * Search, filter and page-size changes reset to page 1.
 */
export function useTableState<F extends string = string>(
  options: TableStateOptions<F> = {},
) {
  const {
    filterKeys = [] as readonly F[],
    defaultSortBy,
    defaultSortOrder = 'DESC',
    defaultLimit = 20,
    prefix,
    persist = 'url',
  } = options;
  const [params, setParams] = useParamStore(persist);
  const k = useCallback((name: string) => (prefix ? `${prefix}_${name}` : name), [prefix]);

  const page = Math.max(1, Math.floor(Number(params.get(k('page'))) || 1));
  const rawLimit = Math.floor(Number(params.get(k('limit'))) || defaultLimit);
  const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE);
  const search = params.get(k('q')) ?? '';
  const sortBy = params.get(k('sortBy')) ?? defaultSortBy;
  const sortOrderParam = params.get(k('sortOrder'));
  const sortOrder: SortOrder =
    sortOrderParam === 'ASC' || sortOrderParam === 'DESC' ? sortOrderParam : defaultSortOrder;

  const filterSignature = filterKeys.map((key) => params.get(k(key)) ?? '').join('\u0000');
  const filters = useMemo(() => {
    const values = filterSignature.split('\u0000');
    const result: Partial<Record<F, string>> = {};
    filterKeys.forEach((key, i) => {
      if (values[i]) result[key] = values[i];
    });
    return result;
    // filterKeys is expected to be a stable module constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  const update = useCallback(
    (changes: Record<string, string | number | undefined | null>, resetPage: boolean) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [name, value] of Object.entries(changes)) {
          if (value === undefined || value === null || value === '') next.delete(k(name));
          else next.set(k(name), String(value));
        }
        if (resetPage) next.delete(k('page'));
        return next;
      });
    },
    [k, setParams],
  );

  const setPage = useCallback(
    (p: number) => update({ page: p > 1 ? p : undefined }, false),
    [update],
  );
  const setLimit = useCallback(
    (l: number) => update({ limit: l === defaultLimit ? undefined : l }, true),
    [defaultLimit, update],
  );
  const setSearch = useCallback((value: string) => update({ q: value.trim() }, true), [update]);
  const setSort = useCallback(
    (key: string, order: SortOrder) => update({ sortBy: key, sortOrder: order }, true),
    [update],
  );
  const setFilter = useCallback(
    (key: F, value: string) => update({ [key]: value }, true),
    [update],
  );
  const clearFilters = useCallback(
    () =>
      update(
        Object.fromEntries([...filterKeys.map((key) => [key, undefined]), ['q', undefined]]),
        true,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update],
  );

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
    clearFilters,
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
