import { RefreshCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/data-table';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { useFailedSubmissionsTable, useRetryAdminSubmission } from '../hooks';
import type { TiramisTrackingRecord } from '../types';
import { formatDateTime, isTiramisFinalSuccess } from '../utils';

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
    key: 'error',
    header: 'Last Error',
    hideOnMobile: true,
    cell: (row) => row.lastErrorMessage ?? ' - ',
  },
  {
    key: 'created',
    header: 'Created',
    sortable: true,
    cell: (row) => formatDateTime(row.createdAt),
  },
];

export function TiramisFailedSubmissionsPage() {
  const { tableProps } = useFailedSubmissionsTable();
  const retry = useRetryAdminSubmission();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Failed TIRAMIS Submissions"
        description="Quick access to failed records that may need attention"
      />
      <Card>
        <CardContent className="pt-6">
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search reference, request ID or error"
            rowActions={[
              {
                label: 'Retry',
                icon: RefreshCcw,
                hidden: (row) => isTiramisFinalSuccess(row.status),
                onClick: (row) => retry.mutate(row.id),
              },
            ]}
            emptyMessage="No failed submissions"
          />
        </CardContent>
      </Card>
    </div>
  );
}
