import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { departmentsApi } from '@/modules/tenant/departments/api/departments';
import { getApiErrorMessage } from '@/lib/api-error';
import { departmentsKeys } from './query-keys';

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (departmentId: string) =>
      departmentsApi.deleteDepartment(departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      toast.success('Department deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}
