import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellRing, CheckCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { engagementApi, type NotificationRecord } from '../api';
import { formatDateTime, safeInternalLink, statusTone } from '../utils';

const NOTIFICATION_FILTER_KEYS = ['state', 'priority'] as const;
type NotificationFilterKey = (typeof NOTIFICATION_FILTER_KEYS)[number];

const STATE_OPTIONS = [
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
  { label: 'Dismissed', value: 'dismissed' },
];
const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map(
  (value) => ({ label: value, value }),
);

function derivedState(notification: NotificationRecord) {
  return notification.dismissed_at
    ? 'DISMISSED'
    : notification.read_at
      ? 'READ'
      : 'UNREAD';
}

const columns: Column<NotificationRecord>[] = [
  {
    key: 'title',
    header: 'Notification',
    sortable: true,
    cell: (notification) => (
      <div className="space-y-1">
        <div className="font-medium text-slate-900">{notification.title}</div>
        <div className="text-sm text-slate-500">{notification.message}</div>
      </div>
    ),
  },
  {
    key: 'priority',
    header: 'Priority',
    sortable: true,
    cell: (notification) => (
      <Badge variant="outline" className={statusTone(notification.priority)}>
        {notification.priority}
      </Badge>
    ),
  },
  {
    key: 'state',
    header: 'Status',
    cell: (notification) => {
      const state = derivedState(notification);
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

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { tableProps, state } = useServerTable<
    NotificationRecord,
    NotificationFilterKey
  >({
    queryKey: ['engagement', 'notifications'],
    fetcher: (params, signal) =>
      engagementApi.pageNotifications(params, signal),
    filterKeys: NOTIFICATION_FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  // ['engagement', 'notifications'] is the base key of both the table and
  // the unread summary, so one invalidation refreshes both.
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['engagement', 'notifications'],
    });

  const unreadMutation = useMutation({
    mutationFn: () => engagementApi.markAllNotificationsRead(),
    onSuccess: () => {
      toast.success('Notifications marked as read');
      invalidate();
    },
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => engagementApi.markNotificationRead(id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Notifications"
        description="User-facing alerts with validated deep links and inbox state tracking."
        action={
          <Button
            variant="outline"
            onClick={() => unreadMutation.mutate()}
            disabled={unreadMutation.isPending}
          >
            Mark all as read
          </Button>
        }
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-blue-600" />
            Inbox
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search notifications…"
            filters={tableFilters(state.filters, [
              { key: 'state', label: 'State', options: STATE_OPTIONS },
              { key: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
            ])}
            rowActions={[
              {
                label: 'Mark as read',
                icon: CheckCheck,
                onClick: (notification) => readMutation.mutate(notification.id),
              },
              {
                label: 'Open',
                icon: ExternalLink,
                hidden: (notification) =>
                  !safeInternalLink(notification.deep_link),
                onClick: (notification) => {
                  const link = safeInternalLink(notification.deep_link);
                  if (link) navigate(link);
                },
              },
            ]}
            emptyMessage="No notifications"
          />
        </CardContent>
      </Card>
    </div>
  );
}
