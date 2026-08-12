import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { departmentsApi } from '@/modules/tenant/departments/api/departments';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { departmentsKeys } from './query-keys';
import type { DepartmentRecord } from '@/modules/tenant/departments/api/departments';

function matchesSearch(dept: DepartmentRecord, q: string) {
  if (!q) return true;
  const term = q.toLowerCase();
  return (
    dept.name.toLowerCase().includes(term) ||
    dept.code.toLowerCase().includes(term) ||
    (dept.description ?? '').toLowerCase().includes(term) ||
    (dept.branch?.name ?? '').toLowerCase().includes(term) ||
    (dept.branch?.code ?? '').toLowerCase().includes(term)
  );
}

export function useDepartmentsList() {
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? 'all';
  const branchId = params.get('branch_id') ?? 'all';

  const { data, isLoading, error } = useQuery({
    queryKey: departmentsKeys.lists(),
    queryFn: () =>
      departmentsApi.getDepartments({ page: 1, limit: API_MAX_LIST_LIMIT }),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const allDepartments = data?.data ?? [];

    return allDepartments.filter((dept) => {
      const statusMatches = status === 'all' ? true : dept.status === status;
      const branchMatches =
        branchId === 'all'
          ? true
          : (dept.branch_id ?? dept.branch?.id ?? '') === branchId;
      return statusMatches && branchMatches && matchesSearch(dept, search);
    });
  }, [branchId, data?.data, search, status]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const pageData = filtered.slice((safePage - 1) * limit, safePage * limit);

  const setParam = (key: string, value: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null) next.delete(key);
      else next.set(key, value);
      next.set('page', '1');
      return next;
    });
  };

  return {
    departments: pageData,
    total,
    totalPages,
    page: safePage,
    limit,
    search,
    status,
    branchId,
    isLoading,
    error,
    setSearch: (value: string) => setParam('search', value),
    setStatus: (value: string) =>
      setParam('status', value === 'all' ? null : value),
    setBranchId: (value: string) =>
      setParam('branch_id', value === 'all' ? null : value),
    setPage: (value: number) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(value));
        return next;
      });
    },
    setLimit: (value: number) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('limit', String(value));
        next.set('page', '1');
        return next;
      });
    },
  };
}
