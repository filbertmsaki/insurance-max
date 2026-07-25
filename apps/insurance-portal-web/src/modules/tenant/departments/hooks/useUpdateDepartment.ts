import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  departmentsApi,
  type UpdateDepartmentDto,
} from '@/modules/tenant/departments/api/departments';
import { getApiErrorMessage } from '@/lib/api-error';
import { departmentsKeys } from './query-keys';

export function useUpdateDepartment(departmentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateDepartmentDto) =>
      departmentsApi.updateDepartment(departmentId!, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      if (departmentId) {
        queryClient.setQueryData(departmentsKeys.detail(departmentId), updated);
      }
      toast.success('Department updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}
