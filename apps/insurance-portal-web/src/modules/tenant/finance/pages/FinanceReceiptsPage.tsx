import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { financeTableApi } from '../api';
import type { FinanceReceipt } from '../types';
import { FinanceStatusBadge, formatMoney, partyName } from '../components';

const FILTER_KEYS = ['status'] as const;

const STATUS_OPTIONS = [
  'RECEIVED',
  'POSTED',
  'PARTIALLY_ALLOCATED',
  'ALLOCATED',
  'REVERSED',
].map((value) => ({ label: value.replace(/_/g, ' '), value }));

export function FinanceReceiptsPage() {
  const navigate = useNavigate();
  const { tableProps, state } = useServerTable<
    FinanceReceipt,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: ['finance', 'receipts'],
    fetcher: (params, signal) => financeTableApi.receipts(params, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinanceReceipt>[] = [
    {
      key: 'receipt_no',
      header: 'Receipt',
      sortable: true,
      cell: (row) => row.receipt_no,
    },
    {
      key: 'payer',
      header: 'Payer',
      cell: (row) => row.payer_name ?? partyName(row.customer),
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
      key: 'allocated_amount',
      header: 'Allocated',
      sortable: true,
      cell: (row) =>
        formatMoney(row.allocated_amount, row.currency ?? row.currency_code),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/apps/finance/receipts/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        description="Posted receipts are immutable; corrections use reversals and new postings."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search receipts"
        filters={tableFilters(state.filters, [
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
        ])}
        showColumnVisibility={false}
      />
    </div>
  );
}
