import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ExternalLink } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatDateTime,
  safeInternalLink,
  statusTone,
} from '@/modules/tenant/engagement/utils';

import {
  portalApi,
  type PortalAudience,
  type PortalNotificationRecord,
} from '../api';

const NOTIFICATION_FILTER_KEYS = ['unread_only'] as const;
type NotificationFilterKey = (typeof NOTIFICATION_FILTER_KEYS)[number];

const READ_OPTIONS = [{ label: 'Unread only', value: 'true' }];

const columns: Column<PortalNotificationRecord>[] = [
  {
    key: 'title',
    header: 'Notification',
    sortable: true,
    cell: (notification) => (
      <div className="space-y-1">
        <div className="font-medium text-slate-900">{notification.title}</div>
        <div className="text-sm text-slate-600">{notification.message}</div>
      </div>
    ),
  },
  {
    key: 'severity',
    header: 'Severity',
    sortable: true,
    cell: (notification) => (
      <Badge variant="outline" className={statusTone(notification.severity)}>
        {notification.severity}
      </Badge>
    ),
  },
  {
    key: 'read_at',
    header: 'Status',
    cell: (notification) => {
      const state = notification.read_at ? 'READ' : 'UNREAD';
      return (
        <Badge variant="outline" className={statusTone(state)}>
          {state}
        </Badge>
      );
    },
  },
  {
    key: 'created_at',
    header: 'Created',
    sortable: true,
    cell: (notification) => formatDateTime(notification.created_at),
  },
];

export function PortalNotificationsPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { tableProps, state } = useServerTable<
    PortalNotificationRecord,
    NotificationFilterKey
  >({
    queryKey: ['portal', audience, 'notifications'],
    fetcher: (params, signal) =>
      portalApi.pageNotifications(audience, params, signal),
    filterKeys: NOTIFICATION_FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => portalApi.markNotificationRead(audience, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['portal', audience, 'notifications'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer portal"
        title="Notifications"
        description="Portal alerts tied to the current customer or intermediary account."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Notification inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search notifications…"
            filters={tableFilters(state.filters, [
              { key: 'unread_only', label: 'Read state', options: READ_OPTIONS },
            ])}
            rowActions={[
              {
                label: 'Mark read',
                icon: CheckCheck,
                hidden: (notification) => Boolean(notification.read_at),
                onClick: (notification) => readMutation.mutate(notification.id),
              },
              {
                label: 'Open',
                icon: ExternalLink,
                hidden: (notification) =>
                  !safeInternalLink(notification.action_url),
                onClick: (notification) => {
                  const link = safeInternalLink(notification.action_url);
                  if (link) navigate(link);
                },
              },
            ]}
            emptyMessage="No notifications. New alerts will appear here when portal activity requires attention."
          />
        </CardContent>
      </Card>
    </div>
  );
}
