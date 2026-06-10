import { useQuery } from '@tanstack/react-query'
import { departmentsApi } from '@/api/product-engine/departments'
import { peKeys } from './query-keys'

export function useDepartments() {
  return useQuery({
    queryKey: peKeys.departments.all(),
    queryFn: departmentsApi.getAll,
    staleTime: 60_000,
  })
}
