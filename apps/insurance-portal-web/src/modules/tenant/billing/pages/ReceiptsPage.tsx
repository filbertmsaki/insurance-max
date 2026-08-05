import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { BillingStatusBadge } from '../components/BillingStatusBadge';
import { useDeleteReceipt, useReceiptsList } from '../hooks';
import type { ReceiptRecord } from '../types';

export function ReceiptsPage() {
  const navigate = useNavigate();
  const { data, isLoading, page, limit, search, setSearch, setPage, setLimit } =
    useReceiptsList();
  const deleteMutation = useDeleteReceipt();
  const [deleteItem, setDeleteItem] = useState<ReceiptRecord | null>(null);

  const columns: Column<ReceiptRecord>[] = [
    { key: 'receipt_no', header: 'Receipt No.', cell: (row) => row.receipt_no },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => row.customer?.customer_no ?? row.customer_id,
    },
    {
      key: 'invoice',
      header: 'Invoice',
      cell: (row) => row.invoice?.invoice_no ?? row.invoice_id ?? ' - ',
    },
    { key: 'method', header: 'Method', cell: (row) => row.payment_method },
    {
      key: 'amount',
      header: 'Amount',
      cell: (row) => `${row.currency} ${row.amount}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <BillingStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/billing/receipts/${row.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/billing/receipts/${row.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteItem(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Manage receipts and payments collected"
        action={
          <Button onClick={() => navigate('/billing/receipts/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Receipt
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search receipts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
        title="Delete Receipt"
        description="This will soft-delete the receipt."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteItem &&
          deleteMutation.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null),
          })
        }
      />
    </div>
  );
}
