import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';

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

import { engagementApi } from '../api';
import { formatDateTime, safeInternalLink, statusTone } from '../utils';

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['engagement', 'notifications'],
    queryFn: engagementApi.listNotifications,
  });

  const unreadMutation = useMutation({
    mutationFn: () => engagementApi.markAllNotificationsRead(),
    onSuccess: () => {
      toast.success('Notifications marked as read');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'notifications'],
      });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'notifications', 'summary'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Notification</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(notificationsQuery.data ?? []).map((notification) => {
                const openLink = safeInternalLink(notification.deep_link);
                const derivedState = notification.dismissed_at
                  ? 'DISMISSED'
                  : notification.read_at
                    ? 'READ'
                    : 'UNREAD';

                return (
                  <TableRow key={notification.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">
                          {notification.title}
                        </div>
                        <div className="text-sm text-slate-500">
                          {notification.message}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(notification.priority)}
                      >
                        {notification.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(derivedState)}
                      >
                        {derivedState}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(notification.created_at)}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          engagementApi
                            .markNotificationRead(notification.id)
                            .then(() => {
                              queryClient.invalidateQueries({
                                queryKey: ['engagement', 'notifications'],
                              });
                              queryClient.invalidateQueries({
                                queryKey: [
                                  'engagement',
                                  'notifications',
                                  'summary',
                                ],
                              });
                            })
                        }
                      >
                        Read
                      </Button>
                      {openLink ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(openLink)}
                        >
                          Open
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
