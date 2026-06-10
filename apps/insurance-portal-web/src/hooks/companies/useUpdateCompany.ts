import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { companiesApi, type UpdateCompanyDto } from '@/api/companies'
import { getApiErrorMessage } from '@/lib/api-error'
import { companiesKeys } from './query-keys'

export function useUpdateCompany(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateCompanyDto) => companiesApi.updateCompany(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() })
      toast.success('Company updated successfully')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
