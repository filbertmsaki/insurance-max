import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { companiesApi } from '@/modules/platform/companies/api/companies';
import { companiesKeys } from './query-keys';
import type { Company, SortOrder } from '@/types';

export type CompanySortKey =
  | 'name'
  | 'slug'
  | 'status'
  | 'contact_email'
  | 'contact_phone'
  | 'website'
  | 'active_users_count'
  | 'created_at';

function sortCompanies(
  a: Company,
  b: Company,
  key: CompanySortKey,
  order: SortOrder,
): number {
  let aVal: string | number;
  let bVal: string | number;

  if (key === 'active_users_count') {
    aVal = a.active_users_count ?? 0;
    bVal = b.active_users_count ?? 0;
  } else if (key === 'created_at') {
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
 * Fetches all companies and exposes client-side filter/sort/pagination state
 * persisted in URL query params so browser back/forward works correctly.
 *
 * URL params used:
 *   q          — search string
 *   page       — current page (1-based)
 *   limit      — rows per page
 *   sortBy     — CompanySortKey
 *   sortOrder  — 'ASC' | 'DESC'
 */
export function useCompaniesList() {
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const sortBy = (params.get('sortBy') as CompanySortKey) ?? 'created_at';
  const sortOrder = (params.get('sortOrder') as SortOrder) ?? 'DESC';

  const {
    data: allCompanies = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: companiesKeys.lists(),
    queryFn: companiesApi.getCompanies,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = q
      ? allCompanies.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            (c.contact_email ?? '').toLowerCase().includes(q) ||
            (c.contact_phone ?? '').toLowerCase().includes(q) ||
            (c.website ?? '').toLowerCase().includes(q),
        )
      : [...allCompanies];
    return matches.sort((a, b) => sortCompanies(a, b, sortBy, sortOrder));
  }, [allCompanies, search, sortBy, sortOrder]);

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

  function setSort(key: CompanySortKey, order: SortOrder) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sortBy', key);
      next.set('sortOrder', order);
      next.set('page', '1');
      return next;
    });
  }

  return {
    companies: pageData,
    total,
    totalPages,
    isLoading,
    error,
    // filter / sort / pagination state
    search,
    page: safePageIndex,
    limit,
    sortBy,
    sortOrder,
    // setters
    setSearch,
    setPage,
    setLimit,
    setSort,
  };
}
