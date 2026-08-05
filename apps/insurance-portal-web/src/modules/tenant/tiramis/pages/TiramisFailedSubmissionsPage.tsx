import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { useFailedSubmissions, useRetryAdminSubmission } from '../hooks';
import type { TiramisTrackingRecord } from '../types';
import { formatDateTime } from '../utils';

export function TiramisFailedSubmissionsPage() {
  const { data = [], isLoading } = useFailedSubmissions();
  const retry = useRetryAdminSubmission();

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
      key: 'error',
      header: 'Last Error',
      cell: (row) => row.lastErrorMessage ?? ' - ',
    },
    {
      key: 'created',
      header: 'Created',
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => retry.mutate(row.id)}>
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
          Retry
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Failed TIRAMIS Submissions"
        description="Quick access to failed records that may need attention"
      />
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data}
            loading={isLoading}
            page={1}
            limit={data.length || 1}
            total={data.length}
            totalPages={1}
            onPageChange={() => {}}
            onLimitChange={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}
