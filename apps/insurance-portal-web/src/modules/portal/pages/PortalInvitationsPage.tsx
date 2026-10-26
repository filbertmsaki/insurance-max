import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheck, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDateTime } from '@/components/shared/detailFormat';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import {
  portalInvitationsApi,
  type PortalInvitationDeliveryStatus,
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
  status === 'ACCEPTED' ? 'success' : status === 'PENDING' ? 'info' : 'muted';

const deliveryVariant = (status: PortalInvitationDeliveryStatus) =>
  status === 'SENT'
    ? 'success'
    : status === 'DEAD_LETTER'
      ? 'danger'
      : status === 'FAILED'
        ? 'warning'
        : 'muted';

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();

const INVITATION_FILTER_KEYS = [
  'status',
  'delivery_status',
  'actor_type',
] as const;
type InvitationFilterKey = (typeof INVITATION_FILTER_KEYS)[number];

const STATUS_OPTIONS = STATUSES.map((value) => ({
  label: label(value),
  value,
}));
const DELIVERY_OPTIONS = DELIVERY_STATUSES.map((value) => ({
  label: label(value),
  value,
}));
const ACTOR_OPTIONS = [
  { label: 'customer', value: 'CUSTOMER' },
  { label: 'intermediary', value: 'INTERMEDIARY' },
];

const columns: Column<PortalInvitationRecord>[] = [
  {
    key: 'email',
    header: 'Invitee',
    sortable: true,
    cell: (invitation) => (
      <>
        <div className="font-medium">
          {[invitation.first_name, invitation.last_name]
            .filter(Boolean)
            .join(' ') || '—'}
        </div>
        <div className="text-xs text-slate-500">{invitation.email}</div>
      </>
    ),
  },
  {
    key: 'actor_type',
    header: 'Type',
    sortable: true,
    cell: (invitation) => label(invitation.actor_type),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (invitation) => (
      <Badge variant={statusVariant(invitation.status)}>
        {label(invitation.status)}
      </Badge>
    ),
  },
  {
    key: 'delivery_status',
    header: 'Email delivery',
    sortable: true,
    cell: (invitation) => (
      <>
        <Badge variant={deliveryVariant(invitation.delivery_status)}>
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
      </>
    ),
  },
  {
    key: 'expires_at',
    header: 'Expires',
    sortable: true,
    className: 'whitespace-nowrap',
    cell: (invitation) => formatDateTime(invitation.expires_at),
  },
];

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
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { tableProps, state } = useServerTable<
    PortalInvitationRecord,
    InvitationFilterKey
  >({
    queryKey: ['tenant', 'portal', 'invitations'],
    fetcher: (params, signal) => portalInvitationsApi.page(params, signal),
    filterKeys: INVITATION_FILTER_KEYS,
    defaultSortBy: 'created_at',
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Portal Invitations"
        description="Track customer and intermediary invitations and their email delivery. Failed emails retry automatically; dead-lettered ones need a resend."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="h-4 w-4 text-slate-500" />
            Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search name, email or phone…"
            filters={tableFilters(state.filters, [
              { key: 'status', label: 'Status', options: STATUS_OPTIONS },
              {
                key: 'delivery_status',
                label: 'Delivery',
                options: DELIVERY_OPTIONS,
              },
              { key: 'actor_type', label: 'Type', options: ACTOR_OPTIONS },
            ])}
            rowActions={[
              {
                label: 'Resend',
                icon: RotateCcw,
                hidden: (invitation) =>
                  !canManage ||
                  !['PENDING', 'EXPIRED'].includes(invitation.status),
                onClick: (invitation) =>
                  setPending({ kind: 'resend', invitation }),
              },
              {
                label: 'Revoke',
                icon: XCircle,
                destructive: true,
                hidden: (invitation) =>
                  !canManage || invitation.status !== 'PENDING',
                onClick: (invitation) =>
                  setPending({ kind: 'revoke', invitation }),
              },
            ]}
            emptyMessage="No invitations. Invitations sent to customers and intermediaries will appear here."
          />
        </CardContent>
      </Card>

      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !action.isPending) setPending(null);
          }}
          title={
            pending.kind === 'resend'
              ? 'Resend invitation'
              : 'Revoke invitation'
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
