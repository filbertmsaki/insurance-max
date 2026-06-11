import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchesApi } from '@/modules/tenant/branches/api/branches'
import { getApiErrorMessage } from '@/lib/api-error'
import { branchesKeys } from './query-keys'

interface RemoveOverridePayload {
  branchId: string
  companyFeatureId: string
}

export function useRemoveBranchFeatureOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ branchId, companyFeatureId }: RemoveOverridePayload) =>
      branchesApi.removeBranchFeatureOverride(branchId, companyFeatureId),
    onSuccess: (_, { branchId }) => {
      queryClient.invalidateQueries({
        queryKey: [...branchesKeys.detail(branchId), 'features'],
      })
      toast.success('Feature reset to company default')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
