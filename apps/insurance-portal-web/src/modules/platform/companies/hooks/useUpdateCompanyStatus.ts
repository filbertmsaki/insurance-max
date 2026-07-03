import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { companiesApi } from '@/modules/platform/companies/api/companies';
import { getApiErrorMessage } from '@/lib/api-error';
import { companiesKeys } from './query-keys';

interface StatusPayload {
  id: string;
  status: 'active' | 'inactive';
}

/**
 * Toggles a company's active/inactive status.
 * Accepts { id, status } at call time so one hook instance can act on any company
 * (useful for list pages with multiple rows).
 */
export function useUpdateCompanyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: StatusPayload) =>
      companiesApi.setCompanyStatus(id, status),
    onSuccess: (_, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      toast.success(
        `Company ${status === 'active' ? 'activated' : 'deactivated'}`,
      );
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
