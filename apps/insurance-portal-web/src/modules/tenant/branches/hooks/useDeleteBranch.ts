import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchesApi } from '@/modules/tenant/branches/api/branches'
import { getApiErrorMessage } from '@/lib/api-error'
import { branchesKeys } from './query-keys'

export function useDeleteBranch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => branchesApi.deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.lists() })
      toast.success('Branch deleted')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
