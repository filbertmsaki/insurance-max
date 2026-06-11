import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { sessionsApi } from '@/modules/shared/sessions/api/sessions'
import type { UserSession } from '@/types'

export function SessionsPage() {
  const queryClient = useQueryClient()
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [revokeAllOpen, setRevokeAllOpen] = useState(false)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.getSessions,
  })

  const revokeMutation = useMutation({
    mutationFn: sessionsApi.revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setRevokeId(null)
      toast.success('Session revoked')
    },
  })

  const revokeAllMutation = useMutation({
    mutationFn: sessionsApi.revokeAllSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setRevokeAllOpen(false)
      toast.success('All sessions revoked')
    },
  })

  const paginatedData = sessions ?? []
  const total = paginatedData.length

  const columns: Column<UserSession>[] = [
    {
      key: 'ip',
      header: 'IP Address',
      cell: (r) => <span className="font-mono text-sm">{r.ip_address ?? '—'}</span>,
    },
    {
      key: 'ua',
      header: 'User Agent',
      cell: (r) => (
        <span className="text-sm text-slate-600 truncate max-w-xs block">{r.user_agent ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge variant={r.revoked ? 'danger' : 'success'}>{r.revoked ? 'Revoked' : 'Active'}</Badge>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      cell: (r) => (
        <span className="text-sm text-slate-500">
          {format(new Date(r.expires_at), 'MMM d, yyyy HH:mm')}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      cell: (r) => (
        <span className="text-sm text-slate-500">
          {format(new Date(r.created_at), 'MMM d, yyyy HH:mm')}
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
          disabled={r.revoked}
          onClick={() => setRevokeId(r.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="View and manage your active sessions"
        action={
          <Button
            variant="destructive"
            onClick={() => setRevokeAllOpen(true)}
            disabled={!sessions?.some((s) => !s.revoked)}
          >
            Revoke All Sessions
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={paginatedData}
        loading={isLoading}
        page={1}
        limit={paginatedData.length || 10}
        total={total}
        totalPages={1}
        onPageChange={() => {}}
        onLimitChange={() => {}}
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
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
        title="Revoke All Sessions"
        description="This will sign you out of all devices. You'll need to sign in again."
        confirmLabel="Revoke All"
        onConfirm={() => revokeAllMutation.mutate()}
        loading={revokeAllMutation.isPending}
      />
    </div>
  )
}
