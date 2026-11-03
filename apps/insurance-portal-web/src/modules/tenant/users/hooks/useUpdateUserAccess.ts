import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  usersApi,
  type UpdateUserAccessDto,
} from '@/modules/tenant/users/api/users';
import { usersKeys } from './query-keys';

export function useUpdateUserAccess(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateUserAccessDto) =>
      usersApi.updateUserAccess(userId, data),
    onSuccess: (access) => {
      queryClient.setQueryData(usersKeys.access(userId), access);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      toast.success('Access updated');
    },
  });
}
