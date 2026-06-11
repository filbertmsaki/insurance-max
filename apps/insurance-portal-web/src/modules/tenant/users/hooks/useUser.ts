import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/modules/tenant/users/api/users'
import { usersKeys } from './query-keys'

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: () => usersApi.getUserById(id!),
    enabled: !!id,
  })
}
