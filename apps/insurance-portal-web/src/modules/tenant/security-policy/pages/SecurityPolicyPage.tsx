import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FilePlus2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDateTime } from '@/components/shared/detailFormat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import {
  securityPolicyApi,
  type EffectiveSecurityPolicy,
  type SecurityPolicyStatus,
  type SecurityPolicyVersion,
} from '../api';

const QUERY_KEY = ['tenant', 'security-policy'];

const statusVariant = (status: SecurityPolicyStatus) =>
  status === 'ACTIVE' ? 'success' : status === 'DRAFT' ? 'info' : 'muted';

const csv = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

function Codes({ values }: { values: string[] }) {
  return values.length ? (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant="outline">
          {value}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-slate-500">None</span>
  );
}

function PolicyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm sm:col-span-2">{children}</dd>
    </div>
  );
}

function PolicySummary({ policy }: { policy: EffectiveSecurityPolicy }) {
  return (
    <dl className="divide-y">
      <PolicyRow label="2FA for every user">
        {policy.requireTwoFactorForAllUsers ? 'Required' : 'Not required'}
      </PolicyRow>
      <PolicyRow label="2FA for roles">
        <Codes values={policy.requireTwoFactorForRoles} />
      </PolicyRow>
      <PolicyRow label="2FA for permissions">
        <Codes values={policy.requireTwoFactorForPermissions} />
      </PolicyRow>
      <PolicyRow label="2FA for user types">
        <Codes values={policy.requireTwoFactorForUserTypes} />
      </PolicyRow>
      <PolicyRow label="Trusted-device bypass">
        {policy.allowTrustedDeviceBypass ? 'Allowed' : 'Not allowed'}
      </PolicyRow>
    </dl>
  );
}

type PendingAction = {
  kind: 'activate' | 'retire';
  version: SecurityPolicyVersion;
};

/**
 * Company security policy. Company versions can only add 2FA requirements
 * on top of the platform baseline, and a draft must be activated by
 * someone other than its author.
 */
export function SecurityPolicyPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const canDraft = hasPermission('security-policies:update');
  const canActivate = hasPermission('security-policies:activate');

  const [requireAll, setRequireAll] = useState(false);
  const [roles, setRoles] = useState('');
  const [permissions, setPermissions] = useState('');
  const [userTypes, setUserTypes] = useState('');
  const [forbidBypass, setForbidBypass] = useState(false);
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: securityPolicyApi.overview,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const errorToast = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : 'Request failed');

  const draft = useMutation({
    mutationFn: () =>
      securityPolicyApi.createDraft({
        description: description.trim() || undefined,
        two_factor: {
          require_for_all_users: requireAll || undefined,
          require_for_roles: csv(roles),
          require_for_permissions: csv(permissions),
          require_for_user_types: csv(userTypes),
          ...(forbidBypass ? { allow_trusted_device_bypass: false } : {}),
        },
      }),
    onSuccess: async () => {
      setRequireAll(false);
      setRoles('');
      setPermissions('');
      setUserTypes('');
      setForbidBypass(false);
      setDescription('');
      await refresh();
      toast.success('Draft saved. Another administrator must activate it.');
    },
    onError: errorToast,
  });

  const action = useMutation({
    mutationFn: ({ kind, version }: PendingAction) =>
      kind === 'activate'
        ? securityPolicyApi.activate(version.id)
        : securityPolicyApi.retire(version.id),
    onSuccess: async (_result, { kind }) => {
      setPending(null);
      await refresh();
      toast.success(
        kind === 'activate'
          ? 'Security policy activated'
          : 'Policy retired; the platform baseline now applies',
      );
    },
    onError: errorToast,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Security Policy" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Security Policy" />
        <ErrorState
          description="The security policy could not be loaded."
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  }

  const overview = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Policy"
        description="Two-factor requirements for your company. Company versions can only add requirements on top of the platform baseline, and each version must be activated by a second administrator."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              In effect now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PolicySummary policy={overview.effective} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform baseline</CardTitle>
            <p className="text-sm text-slate-500">
              {overview.baseline_source === 'GLOBAL_POLICY'
                ? 'Set by the platform security policy.'
                : 'Set by the platform environment defaults.'}{' '}
              Your company cannot go below this.
            </p>
          </CardHeader>
          <CardContent>
            <PolicySummary policy={overview.baseline} />
          </CardContent>
        </Card>
      </div>

      {canDraft ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FilePlus2 className="h-4 w-4 text-slate-500" />
              Draft a new version
            </CardTitle>
            <p className="text-sm text-slate-500">
              Requirements entered here are added to the baseline. Separate
              several codes with commas.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={requireAll}
                onChange={(event) => setRequireAll(event.target.checked)}
              />
              Require 2FA for every user in the company
            </label>
            <div className="space-y-1">
              <Label htmlFor="policy-roles">Require 2FA for roles</Label>
              <Input
                id="policy-roles"
                value={roles}
                onChange={(event) => setRoles(event.target.value)}
                placeholder="CLAIMS_MANAGER, UNDERWRITER"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="policy-permissions">
                Require 2FA for permissions
              </Label>
              <Input
                id="policy-permissions"
                value={permissions}
                onChange={(event) => setPermissions(event.target.value)}
                placeholder="claims:approve"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="policy-user-types">
                Require 2FA for user types
              </Label>
              <Input
                id="policy-user-types"
                value={userTypes}
                onChange={(event) => setUserTypes(event.target.value)}
                placeholder="STAFF"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="policy-description">Reason for the change</Label>
              <Input
                id="policy-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={forbidBypass}
                onChange={(event) => setForbidBypass(event.target.checked)}
              />
              Do not let trusted devices skip the 2FA prompt
            </label>
            <div className="md:col-span-2 md:flex md:justify-end">
              <Button onClick={() => draft.mutate()} disabled={draft.isPending}>
                {draft.isPending ? 'Saving…' : 'Save draft'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.versions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No company versions yet; the platform baseline applies.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead className="w-[1%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.versions.map((version) => {
                    const ownDraft = version.created_by === currentUserId;
                    return (
                      <TableRow key={version.id}>
                        <TableCell>
                          <div className="font-medium">
                            v{version.version_number} · {version.profile_name}
                          </div>
                          {version.description ? (
                            <div className="text-xs text-slate-500">
                              {version.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(version.status)}>
                            {version.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(version.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {version.approved_at
                            ? formatDateTime(version.approved_at)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {canActivate ? (
                            <div className="flex justify-end gap-2">
                              {version.status === 'DRAFT' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={ownDraft}
                                  title={
                                    ownDraft
                                      ? 'Another administrator must activate your draft'
                                      : undefined
                                  }
                                  onClick={() =>
                                    setPending({ kind: 'activate', version })
                                  }
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Activate
                                </Button>
                              ) : null}
                              {version.status === 'ACTIVE' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPending({ kind: 'retire', version })
                                  }
                                >
                                  Retire
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !action.isPending) setPending(null);
          }}
          title={
            pending.kind === 'activate'
              ? `Activate version ${pending.version.version_number}`
              : `Retire version ${pending.version.version_number}`
          }
          description={
            pending.kind === 'activate'
              ? 'This version takes effect immediately for every sign-in in your company and replaces the current company version. Users it newly requires 2FA for must enrol before they can sign in.'
              : 'Your company falls back to the platform baseline immediately.'
          }
          confirmLabel={pending.kind === 'activate' ? 'Activate' : 'Retire'}
          variant={pending.kind === 'activate' ? 'default' : 'destructive'}
          loading={action.isPending}
          onConfirm={() => action.mutate(pending)}
        />
      ) : null}
    </div>
  );
}
