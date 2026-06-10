import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { companiesApi } from '@/api/companies'
import { getApiErrorMessage } from '@/lib/api-error'
import { companiesKeys } from './query-keys'

export function useDeleteCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => companiesApi.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() })
      toast.success('Company deleted')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}
