import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { useTenantSubmissionsList } from '../hooks';
import type { TiramisSubmissionRecord } from '../types';

export function TiramisSubmissionsPage() {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    page,
    limit,
    search,
    status,
    requestId,
    businessReference,
    setSearch,
    setStatus,
    setRequestId,
    setBusinessReference,
    setPage,
    setLimit,
  } = useTenantSubmissionsList({ sourceModule: 'quotations' });

  const columns: Column<TiramisSubmissionRecord>[] = [
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <TiramisStatusBadge status={row.status} />,
    },
    {
      key: 'quotation',
      header: 'Quotation',
      cell: (row) =>
        row.quotation?.quotation_no ??
        row.quotation_id ??
        row.business_reference ??
        ' - ',
    },
    {
      key: 'requestId',
      header: 'Request ID',
      cell: (row) => row.tiramis_request_id ?? ' - ',
    },
    {
      key: 'businessReference',
      header: 'Business Ref',
      cell: (row) => row.business_reference ?? ' - ',
    },
    { key: 'type', header: 'Type', cell: (row) => row.request_type ?? ' - ' },
    {
      key: 'source',
      header: 'Source',
      cell: (row) => row.source_module ?? ' - ',
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/tiramis/submissions/${row.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Submissions"
        description="Monitor quotation submissions sent to TIRAMIS"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search submissions"
        />
        <Input
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          placeholder="Request ID"
        />
        <Input
          value={businessReference}
          onChange={(e) => setBusinessReference(e.target.value)}
          placeholder="Business reference"
        />
        <Input
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status"
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() =>
            navigate(
              `/tiramis/submissions?search=${encodeURIComponent(search)}`,
            )
          }
        >
          <Search className="mr-2 h-4 w-4" />
          Apply Filters
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={data?.pagination.page ?? page}
        limit={data?.pagination.limit ?? limit}
        total={data?.pagination.total ?? 0}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </div>
  );
}
