import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  branchesApi,
  type CreateBranchDto,
} from '@/modules/tenant/branches/api/branches';
import { getApiErrorMessage } from '@/lib/api-error';
import { branchesKeys } from './query-keys';

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBranchDto) => branchesApi.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.lists() });
      toast.success('Branch created successfully');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
