import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import type { FinanceReceipt } from '../types';
import { FinanceStatusBadge, formatMoney, partyName } from '../components';

export function FinanceReceiptsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['finance', 'receipts', 'list'],
    queryFn: () => financeApi.getReceipts({ limit: 100 }),
  });

  const rows = useMemo(() => {
    const items = query.data?.data ?? [];
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((item) =>
      [
        item.receipt_no,
        item.payment_reference,
        item.provider_reference,
        item.payer_name,
        partyName(item.customer),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [query.data, search]);

  const columns: Column<FinanceReceipt>[] = [
    { key: 'receipt_no', header: 'Receipt', cell: (row) => row.receipt_no },
    { key: 'payer', header: 'Payer', cell: (row) => row.payer_name ?? partyName(row.customer) },
    { key: 'status', header: 'Status', cell: (row) => <FinanceStatusBadge status={row.status} /> },
    { key: 'amount', header: 'Amount', cell: (row) => formatMoney(row.amount, row.currency ?? row.currency_code) },
    { key: 'allocated', header: 'Allocated', cell: (row) => formatMoney(row.allocated_amount, row.currency ?? row.currency_code) },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/finance/receipts/${row.id}`)}>
          Open
        </Button>
      ),
    },
  ];

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Receipts" description="Posted receipts are immutable; corrections use reversals and new postings." />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipts" />
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
