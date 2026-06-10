import { useQuery } from '@tanstack/react-query'
import { branchesApi } from '@/api/branches'
import { branchesKeys } from './query-keys'

export function useBranchFeatures(branchId: string | undefined) {
  return useQuery({
    queryKey: [...branchesKeys.detail(branchId ?? ''), 'features'],
    queryFn: () => branchesApi.getBranchFeatures(branchId!),
    enabled: !!branchId,
    staleTime: 30_000,
  })
}
