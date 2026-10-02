import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersApi } from '@/modules/tenant/users/api/users';
import { usersKeys } from './query-keys';

export function useSetUserInsuranceChannelAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, granted }: { id: string; granted: boolean }) =>
      granted
        ? usersApi.grantInsuranceChannelAccess(id)
        : usersApi.revokeInsuranceChannelAccess(id),
    onSuccess: (_, { id, granted }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
      toast.success(
        granted
          ? 'Insurance channel access granted'
          : 'Insurance channel access removed',
      );
    },
  });
}
