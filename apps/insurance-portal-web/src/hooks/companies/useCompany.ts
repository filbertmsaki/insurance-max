import { useQuery } from '@tanstack/react-query'
import { companiesApi } from '@/api/companies'
import { companiesKeys } from './query-keys'

/** Fetches a single company by ID. Only callable by OWNER users. */
export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: companiesKeys.detail(id ?? ''),
    queryFn: () => companiesApi.getCompanyById(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
