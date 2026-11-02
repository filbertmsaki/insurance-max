import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  CheckCircle2,
  XCircle,
  Lock,
  Trash2,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { rolesApi } from '@/modules/platform/roles/api/roles';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useUser,
  useAssignRole,
  useRevokeRole,
  useUpdateUserDataScope,
  useSetUserInsuranceChannelAccess,
} from '@/modules/tenant/users/hooks';
import type { QuotationPolicyDataScope } from '@/types';
import { usePageTitle } from '@/modules/shared/meta/page-title';

const DATA_SCOPE_OPTIONS: Array<{
  value: QuotationPolicyDataScope;
  label: string;
  description: string;
}> = [
  {
    value: 'USER',
    label: 'User Only',
    description: 'Can see only their own quotations and policies.',
  },
  {
    value: 'DEPARTMENT',
    label: 'Department',
    description: 'Can see quotations and policies in their department.',
  },
  {
    value: 'BRANCH',
    label: 'Branch',
    description: 'Can see quotations and policies in authorized branches.',
  },
  {
    value: 'COMPANY',
    label: 'Company',
    description: 'Can see all quotations and policies in this company.',
  },
];

const DATA_SCOPE_LABELS = Object.fromEntries(
  DATA_SCOPE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<QuotationPolicyDataScope, string>;

const SELECT_INSURANCE_CHANNEL_PERMISSION =
  'quotations:select-insurance-channel';

// ─── Component ───────────────────────────────────────────────────────────────

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  // ── Permissions ───────────────────────────────────────────────────────────
  const canUpdate = hasPermission('users:update');
  const canAssignRole = hasPermission('users:assign-role');
  const canRevokeRole = hasPermission('users:revoke-role');
  const canManageDataScope = hasPermission('users:manage-data-scope');

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: user, isLoading } = useUser(id);
  usePageTitle(user && `User ${user.first_name} ${user.last_name}`);

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [revokeRoleId, setRevokeRoleId] = useState<string | null>(null);
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [dataScopeOpen, setDataScopeOpen] = useState(false);
  const [selectedDataScope, setSelectedDataScope] =
    useState<QuotationPolicyDataScope>('USER');
  const [dataScopeReason, setDataScopeReason] = useState('');

  // ── Roles list for assign dialog ─────────────────────────────────────────
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.getRoles,
    enabled: assignRoleOpen,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const assignRoleMutation = useAssignRole();
  const revokeRoleMutation = useRevokeRole();
  const updateDataScopeMutation = useUpdateUserDataScope(id);
  const insuranceChannelMutation = useSetUserInsuranceChannelAccess();

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`;
  const currentDataScope = user.quotation_policy_data_scope ?? 'USER';
  // Insurance channel selection is granted per user, never through a role.
  const hasInsuranceChannelAccess = (user.permissions ?? []).some(
    (permission) => permission.name === SELECT_INSURANCE_CHANNEL_PERMISSION,
  );

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/apps/users')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold text-slate-900">{fullName}</h1>
        <StatusBadge status={user.status} />
        <div className="ml-auto flex gap-2">
          {canManageDataScope && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDataScope(currentDataScope);
                setDataScopeReason('');
                setDataScopeOpen(true);
              }}
            >
              <Shield className="mr-2 h-4 w-4" /> Data scope
            </Button>
          )}
          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/apps/users/${user.id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {canAssignRole && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRoleId('');
                setAssignRoleOpen(true);
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" /> Assign role
            </Button>
          )}
        </div>
      </div>

      {/* ── Profile card ── */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-blue-100 text-blue-700">
                {user.first_name[0]}
                {user.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{fullName}</h2>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" /> {user.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {user.phone}
                </span>
              </div>
              <div className="mt-2">
                <Badge variant="secondary">
                  {user.user_type?.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'User Number', value: user.user_no ?? '—' },
                  {
                    label: 'Status',
                    value: <StatusBadge status={user.status} />,
                  },
                  {
                    label: 'Email verified',
                    value: user.is_email_verified ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="h-4 w-4" /> Not verified
                      </span>
                    ),
                  },
                  {
                    label: 'Phone verified',
                    value: user.is_phone_verified ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="h-4 w-4" /> Not verified
                      </span>
                    ),
                  },
                  {
                    label: 'Quotation & Policy Scope',
                    value: DATA_SCOPE_LABELS[currentDataScope],
                  },
                  {
                    label: 'Insurance channel selection',
                    value: (
                      <span className="flex items-center gap-2">
                        {hasInsuranceChannelAccess ? 'Granted' : 'Not granted'}
                        {canManageDataScope && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            disabled={insuranceChannelMutation.isPending}
                            onClick={() =>
                              id &&
                              insuranceChannelMutation.mutate({
                                id,
                                granted: !hasInsuranceChannelAccess,
                              })
                            }
                          >
                            {hasInsuranceChannelAccess ? 'Remove' : 'Grant'}
                          </Button>
                        )}
                      </span>
                    ),
                  },
                  {
                    label: 'Last login',
                    value: user.last_login_at
                      ? format(
                          new Date(user.last_login_at),
                          'MMM d, yyyy HH:mm',
                        )
                      : 'Never',
                  },
                  { label: 'Last login IP', value: user.last_login_ip ?? '—' },
                  {
                    label: 'Failed login attempts',
                    value: String(user.failed_login_attempts),
                  },
                  {
                    label: 'Locked until',
                    value: user.locked_until
                      ? format(new Date(user.locked_until), 'MMM d, yyyy HH:mm')
                      : '—',
                  },
                  {
                    label: 'Member since',
                    value: format(new Date(user.created_at), 'MMM d, yyyy'),
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles & Permissions tab */}
        <TabsContent value="roles" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!user.roles?.length ? (
                <p className="text-sm text-slate-400">No roles assigned</p>
              ) : (
                <div className="space-y-2">
                  {user.roles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {role.display_name}
                        </p>
                        <p className="text-xs text-slate-500">{role.name}</p>
                      </div>
                      {canRevokeRole && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevokeRoleId(role.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Direct Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!user.permissions?.length ? (
                <p className="text-sm text-slate-400">
                  No direct permissions assigned
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.permissions.map((p) => (
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="font-mono text-xs"
                    >
                      {p.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2FA tab */}
        <TabsContent value="2fa" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {user.is_two_factor_enabled ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-700">
                      2FA is enabled
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-slate-400" />
                    <span className="text-slate-500">2FA is not enabled</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Assign Role Dialog ── */}
      <Dialog open={assignRoleOpen} onOpenChange={setAssignRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>Assign a role to {fullName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span>{r.display_name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {user.roles.length > 0 && (
              <p className="text-xs text-slate-500">
                Current roles:{' '}
                {user.roles.map((r) => (
                  <Badge
                    key={r.id}
                    variant="secondary"
                    className="text-xs mr-1"
                  >
                    {r.display_name}
                  </Badge>
                ))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedRoleId || assignRoleMutation.isPending}
              onClick={() => {
                if (!id) return;
                assignRoleMutation.mutate(
                  { userId: id, roleId: selectedRoleId },
                  {
                    onSuccess: () => {
                      setAssignRoleOpen(false);
                      setSelectedRoleId('');
                    },
                  },
                );
              }}
            >
              {assignRoleMutation.isPending ? 'Assigning…' : 'Assign role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Role Confirm ── */}
      <Dialog open={dataScopeOpen} onOpenChange={setDataScopeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quotation & Policy Data Scope</DialogTitle>
            <DialogDescription>
              Change the maximum quotation and policy records {fullName} can
              view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select
              value={selectedDataScope}
              onValueChange={(value) =>
                setSelectedDataScope(value as QuotationPolicyDataScope)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              {
                DATA_SCOPE_OPTIONS.find(
                  (option) => option.value === selectedDataScope,
                )?.description
              }
            </p>
            <Input
              value={dataScopeReason}
              onChange={(event) => setDataScopeReason(event.target.value)}
              placeholder="Reason or remarks"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDataScopeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={updateDataScopeMutation.isPending}
              onClick={() => {
                if (!id) return;
                updateDataScopeMutation.mutate(
                  {
                    id,
                    data: {
                      quotation_policy_data_scope: selectedDataScope,
                      reason: dataScopeReason || undefined,
                    },
                  },
                  { onSuccess: () => setDataScopeOpen(false) },
                );
              }}
            >
              {updateDataScopeMutation.isPending ? 'Saving...' : 'Save scope'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeRoleId}
        onOpenChange={(o) => !o && setRevokeRoleId(null)}
        title="Revoke Role"
        description="Are you sure you want to revoke this role from the user?"
        confirmLabel="Revoke"
        onConfirm={() => {
          if (!id || !revokeRoleId) return;
          revokeRoleMutation.mutate(
            { userId: id, roleId: revokeRoleId },
            { onSuccess: () => setRevokeRoleId(null) },
          );
        }}
        loading={revokeRoleMutation.isPending}
      />
    </div>
  );
}
