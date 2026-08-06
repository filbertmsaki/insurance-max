import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import type { FinanceInvoice } from '../types';
import { FinanceStatusBadge, formatMoney, partyName } from '../components';

export function FinanceInvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['finance', 'invoices', 'list'],
    queryFn: () => financeApi.getInvoices({ limit: 100 }),
  });

  const rows = useMemo(() => {
    const items = query.data?.data ?? [];
    if (!search.trim()) return items;
    const term = search.trim().toLowerCase();
    return items.filter((item) =>
      [
        item.invoice_no,
        item.status,
        partyName(item.customer),
        item.quotation?.quotation_no,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [query.data, search]);

  const columns: Column<FinanceInvoice>[] = [
    { key: 'invoice_no', header: 'Invoice', cell: (row) => row.invoice_no },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => partyName(row.customer),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'total',
      header: 'Total',
      cell: (row) => formatMoney(row.total_amount, row.currency ?? row.currency_code),
    },
    {
      key: 'paid',
      header: 'Paid',
      cell: (row) => formatMoney(row.paid_amount, row.currency ?? row.currency_code),
    },
    {
      key: 'balance',
      header: 'Balance',
      cell: (row) => formatMoney(row.balance_amount, row.currency ?? row.currency_code),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/finance/invoices/${row.id}`)}>
          Open
        </Button>
      ),
    },
  ];

  if (query.isLoading) {
    return <Skeleton className="h-[520px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Authoritative invoice balances come from posted receipts, allocations, refunds, and write-offs."
      />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search invoices"
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
