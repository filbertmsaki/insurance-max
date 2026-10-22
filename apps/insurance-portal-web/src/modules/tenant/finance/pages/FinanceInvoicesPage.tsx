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
import type { FinanceInvoice } from '../types';
import { FinanceStatusBadge, formatMoney, partyName } from '../components';

const FILTER_KEYS = ['status'] as const;

const STATUS_OPTIONS = [
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
  'REVERSED',
].map((value) => ({ label: value.replace(/_/g, ' '), value }));

export function FinanceInvoicesPage() {
  const navigate = useNavigate();
  const { tableProps, state } = useServerTable<
    FinanceInvoice,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: ['finance', 'invoices'],
    fetcher: (params, signal) => financeTableApi.invoices(params, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinanceInvoice>[] = [
    {
      key: 'invoice_no',
      header: 'Invoice',
      sortable: true,
      cell: (row) => row.invoice_no,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => partyName(row.customer),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'total_amount',
      header: 'Total',
      sortable: true,
      cell: (row) =>
        formatMoney(row.total_amount, row.currency ?? row.currency_code),
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      sortable: true,
      cell: (row) =>
        formatMoney(row.paid_amount, row.currency ?? row.currency_code),
    },
    {
      key: 'balance_amount',
      header: 'Balance',
      sortable: true,
      cell: (row) =>
        formatMoney(row.balance_amount, row.currency ?? row.currency_code),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/apps/finance/invoices/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Authoritative invoice balances come from posted receipts, allocations, refunds, and write-offs."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search invoices"
        filters={tableFilters(state.filters, [
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
        ])}
        showColumnVisibility={false}
      />
    </div>
  );
}
