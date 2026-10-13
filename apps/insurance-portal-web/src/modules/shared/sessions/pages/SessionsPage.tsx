import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { sessionsApi } from '@/modules/shared/sessions/api/sessions';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { UserSession } from '@/types';

export function SessionsPage() {
  const queryClient = useQueryClient();
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  const {
    tableProps,
    rows: sessions,
    total,
  } = useServerTable<UserSession>({
    queryKey: ['sessions'],
    fetcher: (params, signal) => sessionsApi.listSessions(params, signal),
    defaultSortBy: 'last_used_at',
    defaultLimit: 10,
  });

  const revokeMutation = useMutation({
    mutationFn: sessionsApi.revokeSession,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setRevokeId(null);
      toast.success('Session revoked');

      const revokedCurrent = sessions.find((s) => s.id === id)?.is_current;
      if (revokedCurrent) {
        useAuthStore.getState().logout();
        window.location.assign('/login');
      }
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: sessionsApi.revokeOtherSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setRevokeOthersOpen(false);
      toast.success('Other sessions revoked');
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: sessionsApi.revokeAllSessions,
    onSuccess: () => {
      setRevokeAllOpen(false);
      useAuthStore.getState().logout();
      window.location.assign('/login');
    },
  });

  const columns: Column<UserSession>[] = [
    {
      key: 'ip_address',
      header: 'IP Address',
      sortable: true,
      cell: (r) => (
        <span className="font-mono text-sm">{r.ip_address ?? '—'}</span>
      ),
    },
    {
      key: 'ua',
      header: 'User Agent',
      cell: (r) => (
        <span className="text-sm text-slate-600 truncate max-w-xs block">
          {r.user_agent ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) =>
        r.is_current ? <Badge variant="success">Current</Badge> : null,
    },
    {
      key: 'last_used_at',
      header: 'Last Used',
      sortable: true,
      cell: (r) => (
        <span className="text-sm text-slate-500">
          {format(new Date(r.last_used_at), 'MMM d, yyyy HH:mm')}
        </span>
      ),
    },
    {
      key: 'expires_at',
      header: 'Expires',
      sortable: true,
      cell: (r) => (
        <span className="text-sm text-slate-500">
          {format(new Date(r.expires_at), 'MMM d, yyyy HH:mm')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500"
          onClick={() => setRevokeId(r.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="View and manage your active sessions"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setRevokeOthersOpen(true)}
              disabled={total <= 1}
            >
              Revoke Other Sessions
            </Button>
            <Button
              variant="destructive"
              onClick={() => setRevokeAllOpen(true)}
              disabled={total === 0}
            >
              Revoke All Sessions
            </Button>
          </div>
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search IP address or user agent…"
        emptyMessage="No active sessions"
      />

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(o) => !o && setRevokeId(null)}
        title="Revoke Session"
        description="This will immediately invalidate this session."
        confirmLabel="Revoke"
        onConfirm={() => revokeMutation.mutate(revokeId!)}
        loading={revokeMutation.isPending}
      />

      <ConfirmDialog
        open={revokeOthersOpen}
        onOpenChange={setRevokeOthersOpen}
        title="Revoke Other Sessions"
        description="This will sign you out of all devices except this one."
        confirmLabel="Revoke Others"
        onConfirm={() => revokeOthersMutation.mutate()}
        loading={revokeOthersMutation.isPending}
      />

      <ConfirmDialog
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
        title="Revoke All Sessions"
        description="This will sign you out of all devices, including this one. You'll need to sign in again."
        confirmLabel="Revoke All"
        onConfirm={() => revokeAllMutation.mutate()}
        loading={revokeAllMutation.isPending}
      />
    </div>
  );
}
