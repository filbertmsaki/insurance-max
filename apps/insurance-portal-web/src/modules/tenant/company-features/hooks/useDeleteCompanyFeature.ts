import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { companyFeaturesApi } from '@/modules/tenant/company-features/api/company-features'
import { getApiErrorMessage } from '@/lib/api-error'
import { companyFeaturesKeys } from './query-keys'

export function useDeleteCompanyFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => companyFeaturesApi.deleteCompanyFeature(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyFeaturesKeys.lists() })
      toast.success('Feature deleted')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
