import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { departmentsApi } from '@/modules/tenant/departments/api/departments';
import { getApiErrorMessage } from '@/lib/api-error';
import { departmentsKeys } from './query-keys';

export function useUpdateDepartmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      departmentId,
      status,
    }: {
      departmentId: string;
      status: 'active' | 'inactive';
    }) => departmentsApi.updateDepartmentStatus(departmentId, status),
    onSuccess: (updated, vars) => {
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      queryClient.setQueryData(
        departmentsKeys.detail(vars.departmentId),
        updated,
      );
      toast.success(
        `Department ${vars.status === 'active' ? 'activated' : 'deactivated'}`,
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}
