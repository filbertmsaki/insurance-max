import { Building, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { useOrganizationSwitch } from './useOrganizationSwitch';

/**
 * Switches the active branch/department for the current company by calling
 * the backend `/auth/switch-organization-context` endpoint, which rotates the
 * access/refresh tokens so the JWT claims stay in sync with the selection.
 * This replaces the previous local-only `setActiveBranch` mutation, which
 * left the access token pointing at the old branch.
 */
export function OrganizationSwitcher() {
  const { user } = useAuthStore();
  const { context, branches, departments, switchMutation } =
    useOrganizationSwitch();

  if (branches.length <= 1 && departments.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex gap-2 max-w-52"
          disabled={switchMutation.isPending}
        >
          <Building className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate text-xs">
            {context?.activeBranch?.name ?? user?.activeBranchName ?? 'Branch'}
            {context?.activeDepartment?.name
              ? ` · ${context.activeDepartment.name}`
              : ''}
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {branches.length > 1 && (
          <>
            <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {branches.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() =>
                  switchMutation.mutate({
                    branchId: branch.id,
                    departmentId: context?.activeDepartment?.id ?? null,
                  })
                }
                className={
                  branch.id === context?.activeBranch?.id
                    ? 'bg-slate-50 font-medium'
                    : ''
                }
              >
                {branch.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {departments.length > 1 && (
          <>
            <DropdownMenuLabel>Switch Department</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {departments.map((department) => (
              <DropdownMenuItem
                key={department.id}
                onClick={() =>
                  switchMutation.mutate({
                    branchId: context!.activeBranch!.id,
                    departmentId: department.id,
                  })
                }
                disabled={!context?.activeBranch}
                className={
                  department.id === context?.activeDepartment?.id
                    ? 'bg-slate-50 font-medium'
                    : ''
                }
              >
                {department.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
