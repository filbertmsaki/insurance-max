import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from '@/modules/shared/auth/api/auth';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { organizationApi } from '@/modules/shared/organization/api/organization';

type ApiErrorLike = { response?: { data?: { message?: string } } };

/**
 * Active branch/department and the switch action. Switching calls
 * `/auth/switch-organization-context`, which rotates the tokens so the JWT
 * claims follow the selection. Shared by the desktop switcher and the phone
 * account sheet.
 */
export function useOrganizationSwitch() {
  const { user, setSession } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: context } = useQuery({
    queryKey: ['organization-context', user?.companyId, user?.activeBranchId],
    queryFn: organizationApi.getContext,
    enabled: !!user?.companyId,
    staleTime: 15_000,
  });

  const switchMutation = useMutation({
    mutationFn: (params: { branchId: string; departmentId?: string | null }) =>
      authApi.switchOrganizationContext({
        branch_id: params.branchId,
        department_id: params.departmentId ?? undefined,
        refresh_token: useAuthStore.getState().refreshToken!,
      }),
    onSuccess: (tokens) => {
      setSession(tokens);
      queryClient.invalidateQueries({ queryKey: ['organization-context'] });
      queryClient.invalidateQueries();
      toast.success('Organization context switched');
    },
    onError: (error: ApiErrorLike) =>
      toast.error(
        error?.response?.data?.message ??
          'Unable to switch organization context',
      ),
  });

  return {
    context,
    branches: context?.assignedBranches ?? [],
    departments: context?.assignedDepartments ?? [],
    activeBranchName:
      context?.activeBranch?.name ?? user?.activeBranchName ?? null,
    switchMutation,
  };
}
