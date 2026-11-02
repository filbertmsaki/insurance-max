import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { usersApi } from '@/modules/tenant/users/api/users';
import { rolesApi } from '@/modules/platform/roles/api/roles';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  usersKeys,
  useUpdateUser,
  useDeleteUser,
  useAssignRole,
} from '@/modules/tenant/users/hooks';
import type { UserProfile, UserStatus, UserType } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_STATUSES: UserStatus[] = [
  'active',
  'inactive',
  'suspended',
  'locked',
];

const USER_FILTER_KEYS = ['status', 'user_type'] as const;
type UserFilterKey = (typeof USER_FILTER_KEYS)[number];

const STATUS_OPTIONS = USER_STATUSES.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));

const STATUS_NEXT: Record<
  UserStatus,
  { label: string; next: UserStatus; icon: typeof UserCheck }
> = {
  active: { label: 'Deactivate', next: 'inactive', icon: UserX },
  inactive: { label: 'Activate', next: 'active', icon: UserCheck },
  suspended: { label: 'Activate', next: 'active', icon: UserCheck },
  locked: { label: 'Unlock', next: 'active', icon: UserCheck },
};

const ALL_USER_TYPES: { value: UserType; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'COMPANY_ADMIN', label: 'Company Admin' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'BROKER', label: 'Broker' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'COMPANY_USER', label: 'Company User' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function UsersListPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  // ── Permissions ───────────────────────────────────────────────────────────
  const canCreate = hasPermission('users:create');
  const canUpdate = hasPermission('users:update');
  const canDelete = hasPermission('users:delete');
  const canAssignRole = hasPermission('users:assign-role');

  // ── Server-side table (search / filters / sort / paging in the DB) ──────
  const { tableProps, state } = useServerTable<UserProfile, UserFilterKey>({
    queryKey: usersKeys.lists(),
    fetcher: (params, signal) => usersApi.listUsers(params, signal),
    filterKeys: USER_FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignRoleUser, setAssignRoleUser] = useState<UserProfile | null>(
    null,
  );
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // ── Roles for assign-role dialog ─────────────────────────────────────────
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.getRoles,
    enabled: !!assignRoleUser,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const assignRoleMutation = useAssignRole();

  const handleToggleStatus = (user: UserProfile) => {
    const next = STATUS_NEXT[user.status].next;
    updateMutation.mutate({ id: user.id, data: { status: next } });
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: Column<UserProfile>[] = [
    {
      key: 'user_no',
      header: 'User No.',
      cell: (row) => (
        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
          {row.user_no}
        </code>
      ),
    },
    {
      key: 'user',
      header: 'User',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-blue-100 text-blue-700 font-semibold">
              {row.first_name?.[0]}
              {row.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">
              {row.first_name} {row.last_name}
            </p>
            <p className="text-xs text-slate-500 truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.phone}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {format(new Date(row.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  const rowActions = [
    {
      label: 'View profile',
      icon: Eye,
      onClick: (row: UserProfile) => navigate(`/apps/users/${row.id}`),
    },
    {
      label: 'Edit',
      icon: Pencil,
      hidden: !canUpdate,
      onClick: (row: UserProfile) => navigate(`/apps/users/${row.id}/edit`),
    },
    {
      label: 'Deactivate',
      icon: UserX,
      hidden: (row: UserProfile) => !canUpdate || row.status !== 'active',
      onClick: handleToggleStatus,
    },
    {
      label: 'Activate',
      icon: UserCheck,
      hidden: (row: UserProfile) =>
        !canUpdate || (row.status !== 'inactive' && row.status !== 'suspended'),
      onClick: handleToggleStatus,
    },
    {
      label: 'Unlock',
      icon: UserCheck,
      hidden: (row: UserProfile) => !canUpdate || row.status !== 'locked',
      onClick: handleToggleStatus,
    },
    {
      label: 'Assign role',
      icon: ShieldCheck,
      hidden: !canAssignRole,
      onClick: (row: UserProfile) => {
        setAssignRoleUser(row);
        setSelectedRoleId('');
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      destructive: true,
      separator: true,
      hidden: !canDelete,
      onClick: (row: UserProfile) => setDeleteId(row.id),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage all users in this company"
        action={
          canCreate ? (
            <Button onClick={() => navigate('/apps/users/new')}>
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          ) : undefined
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search name, email, phone…"
        filters={tableFilters(state.filters, [
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          {
            key: 'user_type',
            label: 'Type',
            options: ALL_USER_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            })),
          },
        ])}
        rowActions={rowActions}
        emptyMessage="No users yet"
      />

      {/* ── Assign Role Dialog ── */}
      <Dialog
        open={!!assignRoleUser}
        onOpenChange={(o) => !o && setAssignRoleUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {assignRoleUser?.first_name}{' '}
              {assignRoleUser?.last_name}.
            </DialogDescription>
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

            {assignRoleUser && assignRoleUser.roles.length > 0 && (
              <p className="text-xs text-slate-500">
                Current roles:{' '}
                {assignRoleUser.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs mr-1">
                    {r}
                  </Badge>
                ))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleUser(null)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedRoleId || assignRoleMutation.isPending}
              onClick={() => {
                if (!assignRoleUser) return;
                assignRoleMutation.mutate(
                  { userId: assignRoleUser.id, roleId: selectedRoleId },
                  { onSuccess: () => setAssignRoleUser(null) },
                );
              }}
            >
              {assignRoleMutation.isPending ? 'Assigning…' : 'Assign role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Remove User"
        description="This will remove the user from the active company. The action cannot be undone."
        confirmLabel="Remove user"
        onConfirm={() => {
          if (!deleteId) return;
          deleteMutation.mutate(deleteId, {
            onSuccess: () => setDeleteId(null),
          });
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
