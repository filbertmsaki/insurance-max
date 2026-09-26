import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  usersApi,
  type UpdateUserDataScopeDto,
} from '@/modules/tenant/users/api/users';
import { usersKeys } from './query-keys';

export function useUpdateUserDataScope(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDataScopeDto }) =>
      usersApi.updateUserDataScope(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) });
      }
      toast.success('Data scope updated');
    },
  });
}
