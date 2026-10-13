import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/data-table';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { useTiramisDashboard } from '../hooks';
import type { TiramisTrackingRecord } from '../types';
import { formatDateTime } from '../utils';

export function TiramisDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, page, limit, setPage, setLimit } =
    useTiramisDashboard();

  const columns: Column<TiramisTrackingRecord>[] = [
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <TiramisStatusBadge status={row.status} />,
    },
    {
      key: 'ref',
      header: 'Business Ref',
      cell: (row) => row.businessReference ?? ' - ',
    },
    {
      key: 'request',
      header: 'Request ID',
      defaultVisible: false,
      cell: (row) => row.tiramisRequestId ?? ' - ',
    },
    {
      key: 'type',
      header: 'Type',
      defaultVisible: false,
      cell: (row) => row.requestType ?? ' - ',
    },
    {
      key: 'created',
      header: 'Created',
      defaultVisible: false,
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/tiramis/submissions/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  const total = data?.total ?? data?.pagination?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Dashboard"
        description="Monitor submissions, status distribution, and recent activity"
        action={
          <Button variant="outline" onClick={() => navigate('/tiramis/health')}>
            Health
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Total"
          value={total}
          description="Tracked submissions"
        />
        <DashboardCard
          title="Success Rate"
          value={(data?.summary?.successRate ?? 0) + '%'}
          description="Successful processing rate"
        />
        <DashboardCard
          title="Final Success"
          value={data?.summary?.finalSuccess ?? 0}
          description="Completed submissions"
        />
        <DashboardCard
          title="Failed"
          value={data?.summary?.failed ?? 0}
          description="Requires attention"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.byStatus ?? []).slice(0, 8).map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between text-sm"
              >
                <span>{item.status}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Request Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.byRequestType ?? []).slice(0, 8).map((item) => (
              <div
                key={item.requestType}
                className="flex items-center justify-between text-sm"
              >
                <span>{item.requestType}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Source Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.bySourceModule ?? []).slice(0, 8).map((item) => (
              <div
                key={item.sourceModule}
                className="flex items-center justify-between text-sm"
              >
                <span>{item.sourceModule}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            loading={isLoading}
            page={data?.pagination?.page ?? page}
            limit={data?.pagination?.limit ?? limit}
            total={data?.pagination?.total ?? 0}
            totalPages={data?.pagination?.totalPages ?? 1}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
