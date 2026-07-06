import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { branchesKeys } from './query-keys';
import type { Branch, SortOrder } from '@/types';

export type BranchSortKey =
  | 'name'
  | 'code'
  | 'status'
  | 'email'
  | 'phone'
  | 'sale_point_name'
  | 'created_at';

function sortBranches(
  a: Branch,
  b: Branch,
  key: BranchSortKey,
  order: SortOrder,
): number {
  let aVal: string | number;
  let bVal: string | number;

  if (key === 'created_at') {
    aVal = new Date(a.created_at).getTime();
    bVal = new Date(b.created_at).getTime();
  } else {
    aVal = (a[key] as string | null | undefined) ?? '';
    bVal = (b[key] as string | null | undefined) ?? '';
  }

  if (aVal === bVal) return 0;
  const cmp = aVal < bVal ? -1 : 1;
  return order === 'ASC' ? cmp : -cmp;
}

/**
 * Fetches all branches and exposes client-side filter/sort/pagination state
 * persisted in URL query params so browser back/forward works correctly.
 *
 * URL params used:
 *   q          — search string
 *   page       — current page (1-based)
 *   limit      — rows per page
 *   sortBy     — BranchSortKey
 *   sortOrder  — 'ASC' | 'DESC'
 */
export function useBranchesList() {
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const sortBy = (params.get('sortBy') as BranchSortKey) ?? 'created_at';
  const sortOrder = (params.get('sortOrder') as SortOrder) ?? 'DESC';

  const {
    data: allBranches = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: branchesKeys.lists(),
    queryFn: branchesApi.getAllBranches,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = q
      ? allBranches.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.code.toLowerCase().includes(q) ||
            (b.email ?? '').toLowerCase().includes(q) ||
            (b.phone ?? '').toLowerCase().includes(q) ||
            (b.sale_point_name ?? '').toLowerCase().includes(q),
        )
      : [...allBranches];
    return matches.sort((a, b) => sortBranches(a, b, sortBy, sortOrder));
  }, [allBranches, search, sortBy, sortOrder]);

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const safePageIndex = Math.min(page, totalPages);
  const pageData = filtered.slice(
    (safePageIndex - 1) * limit,
    safePageIndex * limit,
  );

  function setSearch(q: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('q', q);
      next.set('page', '1');
      return next;
    });
  }

  function setPage(p: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  }

  function setLimit(l: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('limit', String(l));
      next.set('page', '1');
      return next;
    });
  }

  function setSort(key: BranchSortKey, order: SortOrder) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sortBy', key);
      next.set('sortOrder', order);
      next.set('page', '1');
      return next;
    });
  }

  return {
    branches: pageData,
    total,
    totalPages,
    isLoading,
    error,
    search,
    page: safePageIndex,
    limit,
    sortBy,
    sortOrder,
    setSearch,
    setPage,
    setLimit,
    setSort,
  };
}
