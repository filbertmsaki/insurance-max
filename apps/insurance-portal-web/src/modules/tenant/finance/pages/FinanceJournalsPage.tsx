import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { financeTableApi } from '../api';
import type { FinanceJournalEntry } from '../types';
import { FinanceStatusBadge } from '../components';

export function FinanceJournalsPage() {
  const navigate = useNavigate();
  const { tableProps } = useServerTable<FinanceJournalEntry>({
    queryKey: ['finance', 'journals'],
    fetcher: (params, signal) => financeTableApi.journals(params, signal),
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinanceJournalEntry>[] = [
    {
      key: 'journal_no',
      header: 'Journal',
      sortable: true,
      cell: (row) => row.journal_no,
    },
    {
      key: 'source_type',
      header: 'Source',
      sortable: true,
      cell: (row) => row.source_type,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'description',
      header: 'Description',
      sortable: true,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journals"
        description="Balanced finance journals are immutable; corrections use reversing entries."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search journals"
        showColumnVisibility={false}
      />
    </div>
  );
}
