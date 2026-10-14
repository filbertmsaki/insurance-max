import { useState } from 'react';
import { Eye, RefreshCcw, RotateCcw, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, tableFilters, type Column } from '@/components/data-table';
import { TiramisTextFilter } from '../components/TiramisTextFilter';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import {
  formatDateTime,
  isTiramisFinalSuccess,
  TIRAMIS_TRACKING_STATUS_OPTIONS,
} from '../utils';
import {
  useLocalTrackingDetail,
  useLocalTrackingTable,
  useRetryLocalTracking,
  useRetryOneLocalTracking,
  useSyncOneLocalTracking,
} from '../hooks';
import type { TiramisTrackingRecord } from '../types';

export function TiramisTrackingPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const { tableProps, state } = useLocalTrackingTable();
  const detail = useLocalTrackingDetail(selectedId);
  const retryAll = useRetryLocalTracking();
  const retryOne = useRetryOneLocalTracking();
  const syncOne = useSyncOneLocalTracking();

  const columns: Column<TiramisTrackingRecord>[] = [
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <TiramisStatusBadge status={row.status} />,
    },
    {
      key: 'requestType',
      header: 'Request Type',
      cell: (row) => row.requestType,
    },
    {
      key: 'businessReference',
      header: 'Business Ref',
      cell: (row) => row.businessReference ?? ' - ',
    },
    {
      key: 'requestId',
      header: 'Request ID',
      cell: (row) => row.tiramisRequestId ?? ' - ',
    },
    {
      key: 'source',
      header: 'Source',
      cell: (row) => row.sourceModule ?? ' - ',
    },
    {
      key: 'created',
      header: 'Created',
      cell: (row) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Tracking"
        description="Inspect tracking records, retry, and sync submissions"
        action={
          <Button variant="outline" onClick={() => retryAll.mutate()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry All
          </Button>
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search"
        filters={tableFilters(state.filters, [
          {
            key: 'status',
            label: 'Status',
            options: TIRAMIS_TRACKING_STATUS_OPTIONS,
          },
        ])}
        toolbarActions={
          <>
            <TiramisTextFilter
              value={state.filters.tiramisRequestId ?? ''}
              onChange={(value) => state.setFilter('tiramisRequestId', value)}
              placeholder="Request ID"
            />
            <TiramisTextFilter
              value={state.filters.businessReference ?? ''}
              onChange={(value) => state.setFilter('businessReference', value)}
              placeholder="Business reference"
            />
          </>
        }
        rowActions={[
          { label: 'Open', icon: Eye, onClick: (row) => setSelectedId(row.id) },
          {
            label: 'Retry',
            icon: RotateCcw,
            hidden: (row) => isTiramisFinalSuccess(row.status),
            onClick: (row) => retryOne.mutate(row.id),
          },
          {
            label: 'Sync',
            icon: UploadCloud,
            onClick: (row) => syncOne.mutate(row.id),
          },
        ]}
        emptyMessage="No tracking records"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tracking Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedId && (
            <p className="text-sm text-slate-500">
              Select a tracking row to inspect its details.
            </p>
          )}
          {selectedId && detail.isLoading && (
            <p className="text-sm text-slate-500">Loading detail...</p>
          )}
          {detail.data && (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div>
                <span className="text-slate-500">Status: </span>
                <TiramisStatusBadge status={detail.data.status} />
              </div>
              <div>
                <span className="text-slate-500">Request ID: </span>
                {detail.data.tiramisRequestId ?? ' - '}
              </div>
              <div>
                <span className="text-slate-500">Business Ref: </span>
                {detail.data.businessReference ?? ' - '}
              </div>
              <div>
                <span className="text-slate-500">Retryable: </span>
                {detail.data.isRetryable ? 'Yes' : 'No'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
