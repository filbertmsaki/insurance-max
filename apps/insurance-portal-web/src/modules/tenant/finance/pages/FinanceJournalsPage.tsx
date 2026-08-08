import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import type { FinanceJournalEntry } from '../types';
import { FinanceStatusBadge } from '../components';

export function FinanceJournalsPage() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['finance', 'journals', 'list'],
    queryFn: () => financeApi.getJournals({ limit: 100 }),
  });

  const rows = query.data?.data ?? [];
  const columns: Column<FinanceJournalEntry>[] = [
    { key: 'journal_no', header: 'Journal', cell: (row) => row.journal_no },
    { key: 'source_type', header: 'Source', cell: (row) => row.source_type },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => row.description,
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/finance/journals/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journals"
        description="Balanced finance journals are immutable; corrections use reversing entries."
      />
      <DataTable
        columns={columns}
        data={rows}
        page={1}
        limit={rows.length || 1}
        total={rows.length}
        totalPages={1}
        onPageChange={() => undefined}
        onLimitChange={() => undefined}
        showColumnVisibility={false}
      />
    </div>
  );
}
