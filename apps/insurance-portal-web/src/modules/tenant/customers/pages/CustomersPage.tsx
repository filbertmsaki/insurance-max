import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import {
  useCustomersList,
  useDeleteCustomer,
  useRestoreCustomer,
  type CustomerSortKey,
} from '../hooks';
import { CustomersTable } from '../components/CustomersTable';
import {
  CUSTOMER_KYC_STATUS_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  type CustomerRecord,
} from '../types';

export function CustomersPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('customers:create');
  const canUpdate = hasPermission('customers:update');
  const canDelete = hasPermission('customers:delete');

  const {
    customers,
    isLoading,
    search,
    customerType,
    status,
    kycStatus,
    page,
    limit,
    sortBy,
    sortOrder,
    total,
    totalPages,
    setSearch,
    setFilter,
    setPage,
    setLimit,
    setSort,
    clearFilters,
    hasActiveFilters,
  } = useCustomersList();

  const deleteMutation = useDeleteCustomer();
  const restoreMutation = useRestoreCustomer();

  const [deleteItem, setDeleteItem] = useState<CustomerRecord | null>(null);
  const [restoreItem, setRestoreItem] = useState<CustomerRecord | null>(null);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage your company customer database"
        action={
          canCreate ? (
            <Button onClick={() => navigate(underwritingPaths.customerCreate)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Customer
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="pl-9"
          />
        </div>

        <Select value={customerType} onValueChange={(value) => setFilter('customer_type', value)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Customer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CUSTOMER_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => setFilter('status', value)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CUSTOMER_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={kycStatus} onValueChange={(value) => setFilter('kyc_status', value)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="KYC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All KYC</SelectItem>
            {CUSTOMER_KYC_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      <CustomersTable
        customers={customers}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSortChange={(key, order) => setSort(key as CustomerSortKey, order)}
        canEdit={canUpdate}
        canDelete={canDelete}
        canRestore={canUpdate}
        onEdit={(customer) => navigate(underwritingPaths.customerEdit(customer.id))}
        onDelete={(customer) => setDeleteItem(customer)}
        onRestore={(customer) => setRestoreItem(customer)}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Customer"
        description="This will soft-delete the customer record."
        confirmLabel="Delete Customer"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(deleteItem.id, {
              onSuccess: () => setDeleteItem(null),
            });
          }
        }}
      />

      <ConfirmDialog
        open={!!restoreItem}
        onOpenChange={(open) => !open && setRestoreItem(null)}
        title="Restore Customer"
        description="This will restore the customer record and make it active again."
        confirmLabel="Restore Customer"
        loading={restoreMutation.isPending}
        onConfirm={() => {
          if (restoreItem) {
            restoreMutation.mutate(restoreItem.id, {
              onSuccess: () => setRestoreItem(null),
            });
          }
        }}
      />
    </div>
  );
}
