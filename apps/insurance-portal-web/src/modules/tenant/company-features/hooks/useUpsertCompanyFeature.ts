import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { companyFeaturesApi, type UpsertCompanyFeatureDto } from '@/modules/tenant/company-features/api/company-features'
import { getApiErrorMessage } from '@/lib/api-error'
import { companyFeaturesKeys } from './query-keys'

export function useUpsertCompanyFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpsertCompanyFeatureDto) => companyFeaturesApi.upsertCompanyFeature(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyFeaturesKeys.lists() })
      toast.success('Feature saved successfully')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
