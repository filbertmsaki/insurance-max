import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { engagementApi, type SignatureRequestRecord } from '../api';
import { formatDateTime, statusTone } from '../utils';

const SIGNATURE_FILTER_KEYS = ['status'] as const;
type SignatureFilterKey = (typeof SIGNATURE_FILTER_KEYS)[number];

const SIGNATURE_STATUS_OPTIONS = [
  'DRAFT',
  'SENT',
  'PARTIALLY_SIGNED',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
].map((value) => ({ label: value, value }));

const columns: Column<SignatureRequestRecord>[] = [
  {
    key: 'request_no',
    header: 'Request',
    sortable: true,
    cell: (request) => (
      <Link
        to={`/apps/signatures/${request.id}`}
        className="font-medium text-slate-900 hover:text-blue-700"
      >
        {request.request_no}
      </Link>
    ),
  },
  {
    key: 'signature_provider',
    header: 'Provider',
    sortable: true,
    cell: (request) => request.signature_provider,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (request) => (
      <Badge variant="outline" className={statusTone(request.status)}>
        {request.status}
      </Badge>
    ),
  },
  {
    key: 'created_at',
    header: 'Created',
    sortable: true,
    cell: (request) => formatDateTime(request.created_at),
  },
];

export function SignatureRequestsPage() {
  const queryClient = useQueryClient();
  const [documentId, setDocumentId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');

  const { tableProps, state } = useServerTable<
    SignatureRequestRecord,
    SignatureFilterKey
  >({
    queryKey: ['engagement', 'signature-requests'],
    fetcher: (params, signal) =>
      engagementApi.pageSignatureRequests(params, signal),
    filterKeys: SIGNATURE_FILTER_KEYS,
    defaultSortBy: 'created_at',
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
        eyebrow="Engagement"
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
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search signature requests…"
            filters={tableFilters(state.filters, [
              {
                key: 'status',
                label: 'Status',
                options: SIGNATURE_STATUS_OPTIONS,
              },
            ])}
            emptyMessage="No signature requests yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
