import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { useDeletePolicy, usePoliciesList, usePolicyCustomers, useRestorePolicy } from '../hooks';
import { PolicyStatusBadge } from '../components/PolicyStatusBadge';
import type { PolicyRecord } from '../types';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

export function PoliciesPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = usePolicyCustomers();
  const {
    data,
    isLoading,
    page,
    limit,
    search,
    policyStatus,
    customerId,
    setSearch,
    setPolicyStatus,
    setCustomerId,
    setPage,
    setLimit,
  } = usePoliciesList();
  const deleteMutation = useDeletePolicy();
  const restoreMutation = useRestorePolicy();
  const [deleteItem, setDeleteItem] = useState<PolicyRecord | null>(null);
  const [restoreItem, setRestoreItem] = useState<PolicyRecord | null>(null);

  const columns: Column<PolicyRecord>[] = [
    { key: 'policy_no', header: 'Policy No.', cell: (row) => row.policy_no },
    { key: 'customer', header: 'Customer', cell: (row) => row.customer ? getCustomerDisplayName(row.customer) : row.customer_id },
    { key: 'product', header: 'Product', cell: (row) => row.product?.product_name ?? row.product_id },
    { key: 'status', header: 'Status', cell: (row) => <PolicyStatusBadge status={row.policy_status} /> },
    { key: 'premium', header: 'Premium', cell: (row) => `${row.currency} ${row.total_premium}` },
    { key: 'created_at', header: 'Created', cell: (row) => new Date(row.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(underwritingPaths.policyDetail(row.id))}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(underwritingPaths.policyEdit(row.id))}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteItem(row)}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setRestoreItem(row)}><RotateCcw className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Create and manage policy records"
        action={<Button onClick={() => navigate(underwritingPaths.policyCreate)}><Plus className="mr-2 h-4 w-4" />Create Policy</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search policies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={policyStatus} onValueChange={setPolicyStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {['DRAFT', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'LAPSED'].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
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
        title="Delete Policy"
        description="This will soft-delete the policy."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })}
      />
      <ConfirmDialog
        open={!!restoreItem}
        onOpenChange={(open) => !open && setRestoreItem(null)}
        title="Restore Policy"
        description="This will restore the policy."
        confirmLabel="Restore"
        loading={restoreMutation.isPending}
        onConfirm={() => restoreItem && restoreMutation.mutate(restoreItem.id, { onSuccess: () => setRestoreItem(null) })}
      />
    </div>
  );
}
