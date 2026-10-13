import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { financeTableApi } from '../api';
import type { FinanceRefund } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceRefundsPage() {
  const navigate = useNavigate();
  const { tableProps } = useServerTable<FinanceRefund>({
    queryKey: ['finance', 'refunds'],
    fetcher: (params, signal) => financeTableApi.refunds(params, signal),
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinanceRefund>[] = [
    {
      key: 'refund_no',
      header: 'Refund',
      sortable: true,
      cell: (row) => row.refund_no,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      cell: (row) => formatMoney(row.amount, row.currency_code),
    },
    {
      key: 'reason',
      header: 'Reason',
      sortable: true,
      cell: (row) => row.reason,
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/finance/refunds/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        description="Refunds follow request, approval, payment, and immutable history."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search refunds"
        showColumnVisibility={false}
      />
    </div>
  );
}
