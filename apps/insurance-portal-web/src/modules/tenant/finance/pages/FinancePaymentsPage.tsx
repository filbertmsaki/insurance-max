import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { financeTableApi } from '../api';
import type { FinancePaymentTransaction } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinancePaymentsPage() {
  const navigate = useNavigate();
  const { tableProps } = useServerTable<FinancePaymentTransaction>({
    queryKey: ['finance', 'payments'],
    fetcher: (params, signal) => financeTableApi.payments(params, signal),
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinancePaymentTransaction>[] = [
    {
      key: 'transaction_no',
      header: 'Transaction',
      sortable: true,
      cell: (row) => row.transaction_no ?? row.id.slice(0, 8),
    },
    {
      key: 'provider',
      header: 'Provider',
      sortable: true,
      cell: (row) => row.provider_code ?? row.provider ?? 'MANUAL',
    },
    {
      key: 'payer_name',
      header: 'Payer',
      sortable: true,
      cell: (row) => row.payer_name ?? ' - ',
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
      cell: (row) => formatMoney(row.amount, row.currency ?? row.currency_code),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/apps/finance/payments/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Recorded payment transactions do not affect invoice balances until a receipt is posted and allocated."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search payments"
        showColumnVisibility={false}
      />
    </div>
  );
}
