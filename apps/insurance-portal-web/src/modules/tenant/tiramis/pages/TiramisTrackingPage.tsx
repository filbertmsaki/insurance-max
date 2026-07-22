import { useState } from 'react';
import { RefreshCcw, RotateCcw, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { formatDateTime, prettyJson } from '../utils';
import { useLocalTrackingDetail, useLocalTrackingList, useRetryLocalTracking, useRetryOneLocalTracking, useSyncOneLocalTracking } from '../hooks';
import type { TiramisTrackingRecord } from '../types';

export function TiramisTrackingPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const list = useLocalTrackingList();
  const detail = useLocalTrackingDetail(selectedId);
  const retryAll = useRetryLocalTracking();
  const retryOne = useRetryOneLocalTracking();
  const syncOne = useSyncOneLocalTracking();

  const columns: Column<TiramisTrackingRecord>[] = [
    { key: 'status', header: 'Status', cell: (row) => <TiramisStatusBadge status={row.status} /> },
    { key: 'requestType', header: 'Request Type', cell: (row) => row.requestType },
    { key: 'businessReference', header: 'Business Ref', cell: (row) => row.businessReference ?? ' - ' },
    { key: 'requestId', header: 'Request ID', cell: (row) => row.tiramisRequestId ?? ' - ' },
    { key: 'source', header: 'Source', cell: (row) => row.sourceModule ?? ' - ' },
    { key: 'created', header: 'Created', cell: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(row.id)}>Open</Button>
          <Button variant="ghost" size="sm" onClick={() => retryOne.mutate(row.id)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Retry</Button>
          <Button variant="ghost" size="sm" onClick={() => syncOne.mutate(row.id)}><UploadCloud className="mr-1.5 h-3.5 w-3.5" />Sync</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="TIRAMIS Tracking" description="Inspect tracking records, retry, and sync submissions" action={<Button variant="outline" onClick={() => retryAll.mutate()}><RefreshCcw className="mr-2 h-4 w-4" />Retry All</Button>} />

      <div className="grid gap-3 md:grid-cols-4">
        <Input value={list.search} onChange={(e) => list.setSearch(e.target.value)} placeholder="Search" />
        <Input value={list.requestId} onChange={(e) => list.setRequestId(e.target.value)} placeholder="Request ID" />
        <Input value={list.businessReference} onChange={(e) => list.setBusinessReference(e.target.value)} placeholder="Business reference" />
        <Input value={list.status} onChange={(e) => list.setStatus(e.target.value)} placeholder="Status" />
      </div>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        loading={list.isLoading}
        page={list.data?.pagination.page ?? list.page}
        limit={list.data?.pagination.limit ?? list.limit}
        total={list.data?.pagination.total ?? 0}
        totalPages={list.data?.pagination.totalPages ?? 1}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tracking Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedId && <p className="text-sm text-slate-500">Select a tracking row to inspect request and response payloads.</p>}
          {selectedId && detail.isLoading && <p className="text-sm text-slate-500">Loading detail...</p>}
          {detail.data && (
            <>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div><span className="text-slate-500">Status: </span><TiramisStatusBadge status={detail.data.status} /></div>
                <div><span className="text-slate-500">Request ID: </span>{detail.data.tiramisRequestId ?? ' - '}</div>
                <div><span className="text-slate-500">Business Ref: </span>{detail.data.businessReference ?? ' - '}</div>
                <div><span className="text-slate-500">Retryable: </span>{detail.data.isRetryable ? 'Yes' : 'No'}</div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Request Payload</p>
                  <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{prettyJson(detail.data.requestPayload ?? detail.data.requestPayloadSnapshot)}</pre>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">TIRAMIS Response</p>
                  <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{prettyJson(detail.data.tiramisResponsePayload ?? detail.data.responsePayloadSnapshot ?? detail.data.finalResponsePayload)}</pre>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
