import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { customersKeys, useDeleteCustomer, useRestoreCustomer } from '../hooks';
import { customersApi } from '../api';
import { CustomersTable } from '../components/CustomersTable';
import type { CustomerRecord } from '../types';

export function CustomersPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('customers:create');
  const canUpdate = hasPermission('customers:update');
  const canDelete = hasPermission('customers:delete');

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
            <Button
              onClick={() => navigate(sharedUnderwritePaths.customerCreate)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Customer
            </Button>
          ) : undefined
        }
      />

      <CustomersTable
        queryKey={customersKeys.lists()}
        fetcher={customersApi.getCustomers}
        canEdit={canUpdate}
        canDelete={canDelete}
        canRestore={canUpdate}
        onEdit={(customer) =>
          navigate(sharedUnderwritePaths.customerEdit(customer.id))
        }
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
