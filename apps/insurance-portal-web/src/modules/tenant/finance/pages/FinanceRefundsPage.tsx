import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import type { FinanceRefund } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceRefundsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['finance', 'refunds', 'list'],
    queryFn: () => financeApi.getRefunds({ limit: 100 }),
  });

  const rows = useMemo(() => {
    const items = query.data?.data ?? [];
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((item) =>
      [item.refund_no, item.status, item.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [query.data, search]);

  const columns: Column<FinanceRefund>[] = [
    { key: 'refund_no', header: 'Refund', cell: (row) => row.refund_no },
    { key: 'status', header: 'Status', cell: (row) => <FinanceStatusBadge status={row.status} /> },
    { key: 'amount', header: 'Amount', cell: (row) => formatMoney(row.amount, row.currency_code) },
    { key: 'reason', header: 'Reason', cell: (row) => row.reason },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/finance/refunds/${row.id}`)}>
          Open
        </Button>
      ),
    },
  ];

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Refunds" description="Refunds follow request, approval, payment, and immutable history." />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search refunds" />
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
