import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import type { FinanceCommissionAccrual } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceCommissionAccrualsPage() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['finance', 'commission-accruals', 'list'],
    queryFn: () => financeApi.getCommissionAccruals({ limit: 100 }),
  });

  const rows = query.data?.data ?? [];
  const columns: Column<FinanceCommissionAccrual>[] = [
    { key: 'accrual_no', header: 'Accrual', cell: (row) => row.accrual_no ?? row.id.slice(0, 8) },
    { key: 'status', header: 'Status', cell: (row) => <FinanceStatusBadge status={row.status} /> },
    { key: 'amount', header: 'Amount', cell: (row) => formatMoney(row.commission_amount) },
    { key: 'paid', header: 'Paid', cell: (row) => formatMoney(row.paid_amount) },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/finance/commission-accruals/${row.id}`)}>
          Open
        </Button>
      ),
    },
  ];

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Commission Accruals" description="Accrual amounts come from frozen distribution and pricing snapshots." />
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
