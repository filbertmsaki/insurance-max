import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { financeTableApi } from '../api';
import type { FinanceCommissionAccrual } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceCommissionAccrualsPage() {
  const navigate = useNavigate();
  const { tableProps } = useServerTable<FinanceCommissionAccrual>({
    queryKey: ['finance', 'commission-accruals'],
    fetcher: (params, signal) =>
      financeTableApi.commissionAccruals(params, signal),
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinanceCommissionAccrual>[] = [
    {
      key: 'accrual_no',
      header: 'Accrual',
      sortable: true,
      cell: (row) => row.accrual_no ?? row.id.slice(0, 8),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'commission_amount',
      header: 'Amount',
      sortable: true,
      cell: (row) => formatMoney(row.commission_amount),
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      sortable: true,
      cell: (row) => formatMoney(row.paid_amount),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigate(`/apps/finance/commission-accruals/${row.id}`)
          }
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Accruals"
        description="Accrual amounts come from frozen distribution and pricing snapshots."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search accruals"
        showColumnVisibility={false}
      />
    </div>
  );
}
