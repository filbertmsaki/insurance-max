import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { financeTableApi } from '../api';
import type { FinanceCommissionPayment } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceCommissionPaymentsPage() {
  const navigate = useNavigate();
  const { tableProps } = useServerTable<FinanceCommissionPayment>({
    queryKey: ['finance', 'commission-payments'],
    fetcher: (params, signal) =>
      financeTableApi.commissionPayments(params, signal),
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinanceCommissionPayment>[] = [
    {
      key: 'payment_no',
      header: 'Payment',
      sortable: true,
      cell: (row) => row.payment_no,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'total_amount',
      header: 'Amount',
      sortable: true,
      cell: (row) => formatMoney(row.total_amount, row.currency),
    },
    {
      key: 'allocated_amount',
      header: 'Allocated',
      sortable: true,
      cell: (row) => formatMoney(row.allocated_amount, row.currency),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/finance/commission-payments/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Payments"
        description="Commission payouts stay linked to accrual balances and journal history."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search commission payments"
        showColumnVisibility={false}
      />
    </div>
  );
}
