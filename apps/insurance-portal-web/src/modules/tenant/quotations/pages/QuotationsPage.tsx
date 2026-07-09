import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { useQuotationCustomers, useDeleteQuotation, useQuotationsList, useRestoreQuotation } from '../hooks';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import type { QuotationRecord } from '../types';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

export function QuotationsPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useQuotationCustomers();
  const {
    data,
    isLoading,
    page,
    limit,
    search,
    status,
    quotationType,
    customerId,
    productId,
    setSearch,
    setStatus,
    setQuotationType,
    setCustomerId,
    setProductId,
    setPage,
    setLimit,
  } = useQuotationsList();
  const deleteMutation = useDeleteQuotation();
  const restoreMutation = useRestoreQuotation();
  const [deleteItem, setDeleteItem] = useState<QuotationRecord | null>(null);
  const [restoreItem, setRestoreItem] = useState<QuotationRecord | null>(null);

  const columns: Column<QuotationRecord>[] = [
    { key: 'quotation_no', header: 'Quotation No.', cell: (row) => row.quotation_no },
    { key: 'customer', header: 'Customer', cell: (row) => row.customer ? getCustomerDisplayName(row.customer) : row.customer_id },
    { key: 'product', header: 'Product', cell: (row) => row.product?.product_name ?? row.product_id },
    { key: 'type', header: 'Type', cell: (row) => row.quotation_type },
    { key: 'status', header: 'Status', cell: (row) => <QuotationStatusBadge status={row.status} /> },
    { key: 'premium', header: 'Premium', cell: (row) => `${row.currency} ${row.total_premium}` },
    { key: 'created_at', header: 'Created', cell: (row) => new Date(row.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/underwriting/quotations/${row.id}`)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/underwriting/quotations/${row.id}/edit`)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteItem(row)}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setRestoreItem(row)}><RotateCcw className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Create and manage insurance quotations"
        action={<Button onClick={() => navigate(underwritingPaths.quotationWizard)}><Plus className="mr-2 h-4 w-4" />Create Quotation</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search quotations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {['DRAFT', 'RATED', 'REFERRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED', 'CANCELLED'].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quotationType} onValueChange={setQuotationType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="MOTOR">Motor</SelectItem>
            <SelectItem value="NON_MOTOR">Non-Motor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customerOptions.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>{getCustomerDisplayName(customer)} ({customer.customer_no})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Product ID" value={productId === 'all' ? '' : productId} onChange={(e) => setProductId(e.target.value || 'all')} className="w-56" />
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
        title="Delete Quotation"
        description="This will soft-delete the quotation."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })}
      />
      <ConfirmDialog
        open={!!restoreItem}
        onOpenChange={(open) => !open && setRestoreItem(null)}
        title="Restore Quotation"
        description="This will restore the quotation."
        confirmLabel="Restore"
        loading={restoreMutation.isPending}
        onConfirm={() => restoreItem && restoreMutation.mutate(restoreItem.id, { onSuccess: () => setRestoreItem(null) })}
      />
    </div>
  );
}
