import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
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
import {
  formatDateTime,
  safeInternalLink,
  statusTone,
} from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

export function PortalNotificationsPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['portal', audience, 'notifications'],
    queryFn: () => portalApi.listNotifications(audience),
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
        eyebrow="Phase 17"
        title="Notifications"
        description="Portal alerts tied to the current customer or intermediary account."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Notification inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {notificationsQuery.isError ? (
            <ErrorState
              description="Portal notifications could not be loaded."
              onRetry={() => notificationsQuery.refetch()}
            />
          ) : (notificationsQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No notifications"
              description="New alerts will appear here when portal activity requires attention."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notification</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(notificationsQuery.data ?? []).map((notification) => {
                  const deepLink = safeInternalLink(notification.action_url);

                  return (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{notification.title}</div>
                          <div className="text-sm text-slate-600">{notification.message}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusTone(notification.severity)}>
                          {notification.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusTone(notification.read_at ? 'READ' : 'UNREAD')}
                        >
                          {notification.read_at ? 'READ' : 'UNREAD'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(notification.created_at)}</TableCell>
                      <TableCell className="space-x-2">
                        {!notification.read_at ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => readMutation.mutate(notification.id)}
                          >
                            Mark read
                          </Button>
                        ) : null}
                        {deepLink ? (
                          <Button variant="ghost" size="sm" onClick={() => navigate(deepLink)}>
                            Open
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
