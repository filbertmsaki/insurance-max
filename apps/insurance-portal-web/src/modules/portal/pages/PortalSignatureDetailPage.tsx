import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { ErrorState } from '@/components/shared/ContentStates';
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

export function PortalSignatureDetailPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const { id = '' } = useParams();
  const signatureQuery = useQuery({
    queryKey: ['portal', audience, 'signatures', id],
    queryFn: () => portalApi.getSignature(audience, id),
    enabled: Boolean(id),
  });

  const request = signatureQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title={request?.request_no ?? 'Signature request'}
        description="Participants and lifecycle events visible through the portal."
        status={
          request ? (
            <Badge variant="outline" className={statusTone(request.status)}>
              {request.status}
            </Badge>
          ) : undefined
        }
      />

      {signatureQuery.isError ? (
        <ErrorState
          description="Signature request detail could not be loaded."
          onRetry={() => signatureQuery.refetch()}
        />
      ) : (
        <>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(request?.participants ?? []).map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{participant.name}</div>
                          <div className="text-xs text-slate-500">{participant.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{participant.participant_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusTone(participant.status)}>
                          {participant.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(participant.signed_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Event history</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(request?.events ?? []).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.event_type}</TableCell>
                      <TableCell>{event.actor_type}</TableCell>
                      <TableCell>{formatDateTime(event.created_at)}</TableCell>
                      <TableCell>{event.notes ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
