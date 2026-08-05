import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { BillingStatusBadge } from '../components/BillingStatusBadge';
import { useDeleteInvoice, useInvoicesList } from '../hooks';
import type { InvoiceRecord } from '../types';

export function InvoicesPage() {
  const navigate = useNavigate();
  const { data, isLoading, page, limit, search, setSearch, setPage, setLimit } =
    useInvoicesList();
  const deleteMutation = useDeleteInvoice();
  const [deleteItem, setDeleteItem] = useState<InvoiceRecord | null>(null);

  const columns: Column<InvoiceRecord>[] = [
    { key: 'invoice_no', header: 'Invoice No.', cell: (row) => row.invoice_no },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) =>
        row.customer ? getCustomerDisplayName(row.customer) : row.customer_id,
    },
    {
      key: 'policy',
      header: 'Policy',
      defaultVisible: false,
      cell: (row) => row.policy?.policy_no ?? row.policy_id ?? ' - ',
    },
    {
      key: 'quotation',
      header: 'Quotation',
      defaultVisible: false,
      cell: (row) => row.quotation?.quotation_no ?? row.quotation_id ?? ' - ',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <BillingStatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Total',
      cell: (row) => `${row.currency} ${row.total_amount}`,
    },
    {
      key: 'created_at',
      header: 'Created',
      defaultVisible: false,
      cell: (row) => new Date(row.created_at).toLocaleDateString(),
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
            onClick={() => navigate(`/billing/invoices/${row.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/billing/invoices/${row.id}/edit`)}
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
        title="Invoices"
        description="Manage billing invoices"
        action={
          <Button onClick={() => navigate('/billing/invoices/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search invoices..."
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
        title="Delete Invoice"
        description="This will soft-delete the invoice."
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
