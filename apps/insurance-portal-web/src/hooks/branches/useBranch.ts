import { useQuery } from '@tanstack/react-query'
import { branchesApi } from '@/api/branches'
import { branchesKeys } from './query-keys'

/** Fetches a single branch by ID. */
export function useBranch(id: string | undefined) {
  return useQuery({
    queryKey: branchesKeys.detail(id ?? ''),
    queryFn: () => branchesApi.getBranchById(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
