import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Eye, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalBusinessRecord } from '../api';

export function PortalRequestsReviewPage() {
  const [search, setSearch] = useState('');
  const params = useMemo(
    () => ({ search: search.trim() || undefined, limit: 50 }),
    [search],
  );
  const query = useQuery({
    queryKey: ['tenant', 'portal', 'requests', params],
    queryFn: () => portalApi.listAdminRequests(params),
  });
  const requests = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Portal Requests"
        description="Review customer and intermediary submissions, approvals, payment proofs, and completion evidence."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-slate-500" />
            Requests
          </CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request or subject"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {query.isError ? (
            <ErrorState
              description="Portal requests could not be loaded."
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : requests.length === 0 ? (
            <EmptyState
              title="No portal requests"
              description="Customer and intermediary submissions will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[1%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{text(request.request_no)}</TableCell>
                    <TableCell>{actorLabel(request)}</TableCell>
                    <TableCell>{text(request.request_type)}</TableCell>
                    <TableCell>{text(request.subject)}</TableCell>
                    <TableCell>
                      {date(request.submitted_at ?? request.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(status(request))}
                      >
                        {status(request)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/portal-requests/${request.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </Link>
                      </Button>
                    </TableCell>
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

function status(record: PortalBusinessRecord) {
  return text(record.status) ?? 'UNKNOWN';
}

function text(value: unknown) {
  const result = typeof value === 'string' ? value.trim() : value?.toString();
  return result || '-';
}

function date(value: unknown) {
  return value ? formatDateTime(String(value)) : '-';
}

function actorLabel(record: PortalBusinessRecord) {
  const actor = record.portal_actor as Record<string, unknown> | undefined;
  const intermediary = actor?.intermediary_company as
    | Record<string, unknown>
    | undefined;
  const customer = actor?.customer as Record<string, unknown> | undefined;
  const user = actor?.user as Record<string, unknown> | undefined;

  return (
    text(intermediary?.name) ||
    text(customer?.customer_no) ||
    text(user?.name) ||
    text(actor?.actor_type)
  );
}
