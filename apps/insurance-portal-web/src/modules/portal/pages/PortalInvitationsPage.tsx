import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailCheck, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDateTime } from '@/components/shared/detailFormat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  portalInvitationsApi,
  type PortalInvitationDeliveryStatus,
  type PortalInvitationFilters,
  type PortalInvitationRecord,
  type PortalInvitationStatus,
} from '../invitations-api';

const STATUSES: PortalInvitationStatus[] = [
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED',
];
const DELIVERY_STATUSES: PortalInvitationDeliveryStatus[] = [
  'QUEUED',
  'SENDING',
  'SENT',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED',
];

const statusVariant = (status: PortalInvitationStatus) =>
  status === 'ACCEPTED'
    ? 'success'
    : status === 'PENDING'
      ? 'info'
      : 'muted';

const deliveryVariant = (status: PortalInvitationDeliveryStatus) =>
  status === 'SENT'
    ? 'success'
    : status === 'DEAD_LETTER'
      ? 'danger'
      : status === 'FAILED'
        ? 'warning'
        : 'muted';

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();

type PendingAction = {
  kind: 'resend' | 'revoke';
  invitation: PortalInvitationRecord;
};

/**
 * Portal invitations with their lifecycle and email delivery status. Failed
 * deliveries retry automatically; dead-lettered ones need a resend.
 */
export function PortalInvitationsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('portal:account-invite');

  const [filters, setFilters] = useState<PortalInvitationFilters>({
    page: 1,
    limit: 25,
  });
  const [pending, setPending] = useState<PendingAction | null>(null);

  const query = useQuery({
    queryKey: ['tenant', 'portal', 'invitations', filters],
    queryFn: () => portalInvitationsApi.list(filters),
  });

  const action = useMutation({
    mutationFn: ({ kind, invitation }: PendingAction) =>
      kind === 'resend'
        ? portalInvitationsApi.resend(invitation.id)
        : portalInvitationsApi.revoke(invitation.id),
    onSuccess: async (_result, { kind }) => {
      setPending(null);
      await queryClient.invalidateQueries({
        queryKey: ['tenant', 'portal', 'invitations'],
      });
      toast.success(
        kind === 'resend'
          ? 'Invitation re-issued; a new email is queued'
          : 'Invitation revoked',
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Invitation action failed',
      ),
  });

  const setFilter = (patch: Partial<PortalInvitationFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));

  const page = query.data;
  const rows = page?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Portal Invitations"
        description="Track customer and intermediary invitations and their email delivery. Failed emails retry automatically; dead-lettered ones need a resend."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="h-4 w-4 text-slate-500" />
            Invitations
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Invitation status"
              className="h-9 rounded-md border px-2 text-sm"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilter({
                  status:
                    (event.target.value as PortalInvitationStatus) ||
                    undefined,
                })
              }
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
            <select
              aria-label="Delivery status"
              className="h-9 rounded-md border px-2 text-sm"
              value={filters.delivery_status ?? ''}
              onChange={(event) =>
                setFilter({
                  delivery_status:
                    (event.target.value as PortalInvitationDeliveryStatus) ||
                    undefined,
                })
              }
            >
              <option value="">All deliveries</option>
              {DELIVERY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isError ? (
            <ErrorState
              description="Portal invitations could not be loaded."
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : query.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading invitations…
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No invitations"
              description="Invitations sent to customers and intermediaries will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invitee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email delivery</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[1%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="font-medium">
                          {[invitation.first_name, invitation.last_name]
                            .filter(Boolean)
                            .join(' ') || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {invitation.email}
                        </div>
                      </TableCell>
                      <TableCell>{label(invitation.actor_type)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(invitation.status)}>
                          {label(invitation.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={deliveryVariant(invitation.delivery_status)}
                        >
                          {label(invitation.delivery_status)}
                        </Badge>
                        <div className="mt-1 text-xs text-slate-500">
                          {invitation.sent_at
                            ? `Sent ${formatDateTime(invitation.sent_at)}`
                            : invitation.next_delivery_attempt_at &&
                                invitation.delivery_status === 'FAILED'
                              ? `Retry ${formatDateTime(invitation.next_delivery_attempt_at)}`
                              : null}
                          {invitation.delivery_attempts > 1
                            ? ` · ${invitation.delivery_attempts} attempts`
                            : null}
                        </div>
                        {invitation.last_delivery_error &&
                        invitation.delivery_status !== 'SENT' ? (
                          <div
                            className="mt-1 max-w-xs truncate text-xs text-red-600"
                            title={invitation.last_delivery_error}
                          >
                            {invitation.last_delivery_error}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(invitation.expires_at)}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <div className="flex justify-end gap-2">
                            {['PENDING', 'EXPIRED'].includes(
                              invitation.status,
                            ) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPending({ kind: 'resend', invitation })
                                }
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Resend
                              </Button>
                            ) : null}
                            {invitation.status === 'PENDING' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPending({ kind: 'revoke', invitation })
                                }
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Revoke
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {page && page.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {page.page} of {page.totalPages} · {page.total} invitations
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page.page <= 1}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: (current.page ?? 1) - 1,
                    }))
                  }
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page.page >= page.totalPages}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: (current.page ?? 1) + 1,
                    }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !action.isPending) setPending(null);
          }}
          title={
            pending.kind === 'resend' ? 'Resend invitation' : 'Revoke invitation'
          }
          description={
            pending.kind === 'resend'
              ? `A new link will be emailed to ${pending.invitation.email}. Any earlier link stops working.`
              : `${pending.invitation.email} will no longer be able to accept this invitation.`
          }
          confirmLabel={pending.kind === 'resend' ? 'Resend' : 'Revoke'}
          variant={pending.kind === 'resend' ? 'default' : 'destructive'}
          loading={action.isPending}
          onConfirm={() => action.mutate(pending)}
        />
      ) : null}
    </div>
  );
}
