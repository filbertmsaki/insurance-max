import { UploadCloud } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/data-table';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import {
  useRetryableSubmissionsTable,
  useSyncAdminSubmission,
} from '../hooks';
import type { TiramisTrackingRecord } from '../types';
import { formatDateTime } from '../utils';

const columns: Column<TiramisTrackingRecord>[] = [
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (row) => <TiramisStatusBadge status={row.status} />,
  },
  {
    key: 'requestType',
    header: 'Request Type',
    sortable: true,
    cell: (row) => row.requestType,
  },
  {
    key: 'businessReference',
    header: 'Business Ref',
    sortable: true,
    cell: (row) => row.businessReference ?? ' - ',
  },
  {
    key: 'nextRetry',
    header: 'Next Retry',
    sortable: true,
    cell: (row) => formatDateTime(row.nextRetryAt),
  },
];

export function TiramisRetryablePage() {
  const { tableProps } = useRetryableSubmissionsTable();
  const sync = useSyncAdminSubmission();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retryable TIRAMIS Submissions"
        description="Records currently eligible for retry"
      />
      <Card>
        <CardContent className="pt-6">
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search reference, request ID or error"
            rowActions={[
              {
                label: 'Sync',
                icon: UploadCloud,
                onClick: (row) => sync.mutate(row.id),
              },
            ]}
            emptyMessage="No submissions are waiting for retry"
          />
        </CardContent>
      </Card>
    </div>
  );
}
