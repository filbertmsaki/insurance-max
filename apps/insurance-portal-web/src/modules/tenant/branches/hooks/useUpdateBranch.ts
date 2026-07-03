import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  branchesApi,
  type UpdateBranchDto,
} from '@/modules/tenant/branches/api/branches';
import { getApiErrorMessage } from '@/lib/api-error';
import { branchesKeys } from './query-keys';

export function useUpdateBranch(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateBranchDto) => branchesApi.updateBranch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: branchesKeys.lists() });
      toast.success('Branch updated successfully');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
