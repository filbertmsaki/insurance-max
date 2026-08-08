import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import type { FinancePaymentTransaction } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinancePaymentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['finance', 'payments', 'list'],
    queryFn: () => financeApi.getPaymentTransactions({ limit: 100 }),
  });

  const rows = useMemo(() => {
    const items = query.data?.data ?? [];
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((item) =>
      [
        item.transaction_no,
        item.provider_reference,
        item.provider_transaction_id,
        item.status,
        item.payer_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [query.data, search]);

  const columns: Column<FinancePaymentTransaction>[] = [
    {
      key: 'transaction_no',
      header: 'Transaction',
      cell: (row) => row.transaction_no ?? row.id.slice(0, 8),
    },
    {
      key: 'provider',
      header: 'Provider',
      cell: (row) => row.provider_code ?? row.provider ?? 'MANUAL',
    },
    { key: 'payer', header: 'Payer', cell: (row) => row.payer_name ?? ' - ' },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (row) => formatMoney(row.amount, row.currency ?? row.currency_code),
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/finance/payments/${row.id}`)}
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
        title="Payments"
        description="Recorded payment transactions do not affect invoice balances until a receipt is posted and allocated."
      />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search payments"
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
