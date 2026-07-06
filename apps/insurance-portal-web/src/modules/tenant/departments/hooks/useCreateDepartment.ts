import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { departmentsApi, type CreateDepartmentDto } from '@/modules/tenant/departments/api/departments';
import { getApiErrorMessage } from '@/lib/api-error';
import { departmentsKeys } from './query-keys';

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDepartmentDto) => departmentsApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      toast.success('Department created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}
