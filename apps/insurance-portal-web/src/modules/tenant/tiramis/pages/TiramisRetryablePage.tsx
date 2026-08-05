import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { useRetryableSubmissions, useSyncAdminSubmission } from '../hooks';
import type { TiramisTrackingRecord } from '../types';
import { formatDateTime } from '../utils';

export function TiramisRetryablePage() {
  const { data = [], isLoading } = useRetryableSubmissions();
  const sync = useSyncAdminSubmission();

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
      key: 'nextRetryAt',
      header: 'Next Retry',
      cell: (row) => formatDateTime(row.nextRetryAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => sync.mutate(row.id)}>
          <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
          Sync
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retryable TIRAMIS Submissions"
        description="Records currently eligible for retry"
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
