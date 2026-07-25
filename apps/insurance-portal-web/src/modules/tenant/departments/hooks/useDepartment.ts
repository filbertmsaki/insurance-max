import { useQuery } from '@tanstack/react-query';
import { departmentsApi } from '@/modules/tenant/departments/api/departments';
import { departmentsKeys } from './query-keys';

export function useDepartment(departmentId?: string) {
  return useQuery({
    queryKey: departmentId
      ? departmentsKeys.detail(departmentId)
      : departmentsKeys.detail(''),
    queryFn: () => departmentsApi.getDepartment(departmentId!),
    enabled: !!departmentId,
    staleTime: 30_000,
  });
}
