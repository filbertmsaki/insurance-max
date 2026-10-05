import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { companiesApi } from '../api/companies';
import { companiesKeys } from '../hooks/query-keys';

const DEFAULT_BRANCH = 'use-default';

const READ_ACCESS_LABELS: Array<[string, string[]]> = [
  ['Quotations', ['quotations:read']],
  ['Policies', ['policies:read']],
  ['Renewals', ['renewals:read']],
  ['Cancellations', ['cancellations:read']],
  ['Endorsements and policy transactions', ['policy-transactions:read']],
];

export function CompanyDataAccessTab() {
  const queryClient = useQueryClient();
  const [draftBranches, setDraftBranches] = useState<Record<string, string>>(
    {},
  );
  const {
    data: members = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [...companiesKeys.myCompany(), 'data-access'],
    queryFn: companiesApi.getMyCompanyDataAccess,
  });

  const mutation = useMutation({
    mutationFn: ({
      userId,
      branchId,
    }: {
      userId: string;
      branchId: string | null;
    }) => companiesApi.updateMemberBranchReadAccess(userId, branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...companiesKeys.myCompany(), 'data-access'],
      });
      toast.success('Branch read access updated');
      setDraftBranches({});
    },
    onError: () => toast.error('Could not update branch read access'),
  });

  if (isLoading) {
    return <Skeleton className="h-56 w-full" />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-red-600">
          Could not load company data access. Refresh the page and try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" /> Branch data access
        </CardTitle>
        <CardDescription>
          Let a user read records shared by colleagues across all of their
          assigned branches. The selected branch enables sharing for that
          member; their branch assignments define which branches are visible.
          This changes data visibility only; it does not grant create, edit, approve,
          or issue permissions. Company administrator roles remain unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => {
          const currentValue = member.branch_id ?? DEFAULT_BRANCH;
          const selectedValue = draftBranches[member.user_id] ?? currentValue;
          const labels = READ_ACCESS_LABELS.filter(([, permissions]) =>
            permissions.some((permission) =>
              member.read_permissions.includes(permission),
            ),
          ).map(([label]) => label);
          const changed =
            selectedValue !== currentValue || member.scope_is_mixed;

          return (
            <div
              key={member.user_id}
              className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_15rem_auto] md:items-center"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {member.first_name} {member.last_name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {member.email}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {member.roles.map((role) => (
                    <Badge key={role} variant="outline" className="text-[10px]">
                      {role}
                    </Badge>
                  ))}
                  {labels.map((label) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {label} read
                    </Badge>
                  ))}
                </div>
              </div>

              <Select
                value={selectedValue}
                onValueChange={(value) =>
                  setDraftBranches((current) => ({
                    ...current,
                    [member.user_id]: value,
                  }))
                }
                disabled={!member.read_permissions.length}
              >
                <SelectTrigger aria-label={`Branch access for ${member.email}`}>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_BRANCH}>
                    Use default access
                  </SelectItem>
                  {member.branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.is_primary ? ' (primary)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={() =>
                  mutation.mutate({
                    userId: member.user_id,
                    branchId:
                      selectedValue === DEFAULT_BRANCH ? null : selectedValue,
                  })
                }
                disabled={
                  !changed ||
                  !member.read_permissions.length ||
                  mutation.isPending
                }
              >
                <Check className="mr-1.5 h-4 w-4" /> Save
              </Button>

              {!member.read_permissions.length && (
                <p className="text-xs text-amber-700 md:col-span-3">
                  This user has no supported record read permissions to scope.
                </p>
              )}
            </div>
          );
        })}
        {members.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No active company users found.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
