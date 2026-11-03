import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/modules/tenant/users/api/users';
import { usersKeys } from './query-keys';

export function useUserAccess(id: string | undefined) {
  return useQuery({
    queryKey: usersKeys.access(id ?? ''),
    queryFn: () => usersApi.getUserAccess(id!),
    enabled: !!id,
  });
}
