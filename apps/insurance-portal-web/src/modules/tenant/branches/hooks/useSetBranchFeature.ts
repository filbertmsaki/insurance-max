import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchesApi } from '@/modules/tenant/branches/api/branches'
import { getApiErrorMessage } from '@/lib/api-error'
import { branchesKeys } from './query-keys'

interface SetFeaturePayload {
  branchId: string
  companyFeatureId: string
  is_enabled: boolean
}

export function useSetBranchFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ branchId, companyFeatureId, is_enabled }: SetFeaturePayload) =>
      branchesApi.setBranchFeature(branchId, companyFeatureId, is_enabled),
    onSuccess: (_, { branchId }) => {
      queryClient.invalidateQueries({
        queryKey: [...branchesKeys.detail(branchId), 'features'],
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
