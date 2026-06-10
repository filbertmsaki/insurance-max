import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi } from '@/api/users'
import { usersKeys } from './query-keys'

export function useAssignRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.assignRole(userId, roleId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(userId) })
      toast.success('Role assigned')
    },
  })
}
