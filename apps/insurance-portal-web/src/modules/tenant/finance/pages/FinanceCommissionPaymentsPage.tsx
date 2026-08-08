import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import type { FinanceCommissionPayment } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceCommissionPaymentsPage() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['finance', 'commission-payments', 'list'],
    queryFn: () => financeApi.getCommissionPayments({ limit: 100 }),
  });

  const rows = query.data?.data ?? [];
  const columns: Column<FinanceCommissionPayment>[] = [
    { key: 'payment_no', header: 'Payment', cell: (row) => row.payment_no },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (row) => formatMoney(row.total_amount, row.currency),
    },
    {
      key: 'allocated',
      header: 'Allocated',
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

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Payments"
        description="Commission payouts stay linked to accrual balances and journal history."
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
