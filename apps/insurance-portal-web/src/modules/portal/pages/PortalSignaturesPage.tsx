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

export function PortalSignaturesPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const basePath = `/${audience}/signatures`;
  const signaturesQuery = useQuery({
    queryKey: ['portal', audience, 'signatures'],
    queryFn: () => portalApi.listSignatures(audience),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title="Signature Requests"
        description="Requests tied to portal-visible documents and their current execution state."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Request list</CardTitle>
        </CardHeader>
        <CardContent>
          {signaturesQuery.isError ? (
            <ErrorState
              description="Portal signature requests could not be loaded."
              onRetry={() => signaturesQuery.refetch()}
            />
          ) : (signaturesQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No signature requests"
              description="New requests will appear here when a shared document needs signature activity."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(signaturesQuery.data ?? []).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link
                        to={`${basePath}/${request.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700"
                      >
                        {request.request_no}
                      </Link>
                    </TableCell>
                    <TableCell>{request.signature_provider}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(request.status)}
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(request.created_at)}</TableCell>
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
