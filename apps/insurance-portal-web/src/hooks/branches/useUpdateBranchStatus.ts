import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchesApi } from '@/api/branches'
import { getApiErrorMessage } from '@/lib/api-error'
import { branchesKeys } from './query-keys'

interface StatusPayload {
  id: string
  status: 'active' | 'inactive'
}

/**
 * Toggles a branch's active/inactive status.
 * Accepts { id, status } at call time so one hook instance can act on any branch.
 */
export function useUpdateBranchStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: StatusPayload) => branchesApi.setBranchStatus(id, status),
    onSuccess: (_, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: branchesKeys.lists() })
      toast.success(`Branch ${status === 'active' ? 'activated' : 'deactivated'}`)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
