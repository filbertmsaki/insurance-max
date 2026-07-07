import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { BillingStatusBadge } from '../components/BillingStatusBadge';
import { useDeletePaymentTransaction, usePaymentTransactionsList } from '../hooks';
import type { PaymentTransactionRecord } from '../types';

export function PaymentTransactionsPage() {
  const navigate = useNavigate();
  const { data, isLoading, page, limit, search, setSearch, setPage, setLimit } = usePaymentTransactionsList();
  const deleteMutation = useDeletePaymentTransaction();
  const [deleteItem, setDeleteItem] = useState<PaymentTransactionRecord | null>(null);

  const columns: Column<PaymentTransactionRecord>[] = [
    { key: 'provider_reference', header: 'Provider Ref', cell: (row) => row.provider_reference },
    { key: 'provider', header: 'Provider', cell: (row) => row.provider },
    { key: 'amount', header: 'Amount', cell: (row) => `${row.currency} ${row.amount}` },
    { key: 'status', header: 'Status', cell: (row) => <BillingStatusBadge status={row.status} /> },
    { key: 'invoice', header: 'Invoice', cell: (row) => row.invoice?.invoice_no ?? row.invoice_id ?? ' - ' },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/billing/payment-transactions/${row.id}`)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteItem(row)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Payment Transactions" description="Track gateway and manual payment transactions" />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        limit={limit}
        total={data?.pagination.total ?? 0}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Transaction"
        description="This will soft-delete the payment transaction."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })}
      />
    </div>
  );
}

