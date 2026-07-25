import { useQuery } from '@tanstack/react-query';
import { departmentsApi } from '@/modules/tenant/product-engine/api/departments';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { peKeys } from './query-keys';

export function useDepartments() {
  return useQuery({
    queryKey: peKeys.departments.all(),
    queryFn: async () =>
      (await departmentsApi.getDepartments({ limit: API_MAX_LIST_LIMIT })).data,
    staleTime: 60_000,
  });
}
