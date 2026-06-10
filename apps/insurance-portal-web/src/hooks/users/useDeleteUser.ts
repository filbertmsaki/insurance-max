import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersApi } from '@/api/users'
import { usersKeys } from './query-keys'

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      toast.success('User removed from company')
    },
  })
}
