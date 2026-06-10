import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { companiesApi, type UpdateCompanyDto } from '@/api/companies'
import { getApiErrorMessage } from '@/lib/api-error'
import { companiesKeys } from './query-keys'

export function useUpdateMyCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateCompanyDto) => companiesApi.updateMyCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.myCompany() })
      toast.success('Company profile updated')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
