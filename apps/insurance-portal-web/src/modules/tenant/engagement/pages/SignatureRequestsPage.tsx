import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function SignatureRequestsPage() {
  const queryClient = useQueryClient();
  const [documentId, setDocumentId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['engagement', 'signature-requests'],
    queryFn: engagementApi.listSignatureRequests,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      engagementApi.createSignatureRequest({
        document_id: documentId,
        participants: [
          {
            participant_type: 'EXTERNAL',
            name: participantName,
            email: participantEmail,
            signing_order: 1,
          },
        ],
      }),
    onSuccess: () => {
      toast.success('Signature request created');
      setDocumentId('');
      setParticipantName('');
      setParticipantEmail('');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'signature-requests'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title="Signature Requests"
        description="Signature orchestration for generated or uploaded documents."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">New signature request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="signature-document-id">Document UUID</Label>
            <Input
              id="signature-document-id"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signature-name">Signer name</Label>
            <Input
              id="signature-name"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signature-email">Signer email</Label>
            <Input
              id="signature-email"
              value={participantEmail}
              onChange={(e) => setParticipantEmail(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Create request
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="pt-6">
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
              {(requestsQuery.data ?? []).map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Link
                      to={`/signatures/${request.id}`}
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
        </CardContent>
      </Card>
    </div>
  );
}
