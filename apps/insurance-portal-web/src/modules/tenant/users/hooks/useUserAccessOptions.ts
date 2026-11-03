import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/modules/tenant/users/api/users';
import { usersKeys } from './query-keys';

export function useUserAccessOptions() {
  return useQuery({
    queryKey: usersKeys.accessOptions(),
    queryFn: usersApi.getAccessOptions,
    staleTime: 60_000,
  });
}
