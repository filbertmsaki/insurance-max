import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

export function PortalMessagesPage({ audience }: { audience: PortalAudience }) {
  const basePath = `/${audience}/messages`;
  const messagesQuery = useQuery({
    queryKey: ['portal', audience, 'messages'],
    queryFn: () => portalApi.listMessages(audience),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer portal"
        title="Messages"
        description="Communication threads shared to this portal account."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Conversation list</CardTitle>
        </CardHeader>
        <CardContent>
          {messagesQuery.isError ? (
            <ErrorState
              description="Portal messages could not be loaded."
              onRetry={() => messagesQuery.refetch()}
            />
          ) : (messagesQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No conversations"
              description="Threads will appear here when the insurer opens communication with this portal account."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thread</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(messagesQuery.data ?? []).map((thread) => (
                  <TableRow key={thread.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          to={`${basePath}/${thread.id}`}
                          className="font-medium text-slate-900 hover:text-blue-700"
                        >
                          {thread.subject}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {thread.thread_no}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{thread.thread_type}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(
                          thread.closed_at ? 'CLOSED' : 'OPEN',
                        )}
                      >
                        {thread.closed_at ? 'CLOSED' : 'OPEN'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(thread.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
