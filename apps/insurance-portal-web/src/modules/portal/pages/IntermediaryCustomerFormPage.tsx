import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { CustomerForm } from '@/modules/tenant/customers/components/CustomerForm';
import { buildCustomerPayload } from '@/modules/tenant/customers/schemas';
import type { CustomerFormValues } from '@/modules/tenant/customers/types';
import { getApiErrorMessage } from '@/lib/api-error';

import { portalApi } from '../api';

export function IntermediaryCustomerFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const customerQuery = useQuery({
    queryKey: ['portal', 'intermediary', 'customers', id],
    enabled: isEdit,
    queryFn: () => portalApi.getIntermediaryCustomer(id!),
  });

  const backPath = '/apps/intermediary/customers';

  const saveMutation = useMutation({
    mutationFn: (values: CustomerFormValues) => {
      const payload = buildCustomerPayload(values);

      return isEdit
        ? portalApi.updateIntermediaryCustomer(id!, payload)
        : portalApi.createIntermediaryCustomer(payload);
    },
    onSuccess: async (customer) => {
      toast.success(isEdit ? 'Customer updated' : 'Customer created');
      await queryClient.invalidateQueries({
        queryKey: ['portal', 'intermediary', 'customers'],
      });
      navigate(`/apps/intermediary/customers/${customer.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const archiveMutation = useMutation({
    mutationFn: () => portalApi.deleteIntermediaryCustomer(id!),
    onSuccess: async () => {
      toast.success('Customer archived');
      await queryClient.invalidateQueries({
        queryKey: ['portal', 'intermediary', 'customers'],
      });
      navigate(backPath);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const title = isEdit ? 'Edit Customer' : 'New Customer';
  const description = useMemo(
    () =>
      isEdit
        ? 'Update a customer owned by your intermediary company.'
        : 'Add a customer to your intermediary portfolio.',
    [isEdit],
  );

  if (isEdit && customerQuery.isError) {
    return (
      <ErrorState
        description="This customer could not be loaded for editing."
        onRetry={() => {
          void customerQuery.refetch();
        }}
      />
    );
  }

  if (isEdit && customerQuery.isLoading) {
    return (
      <EmptyState
        title="Loading customer"
        description="The customer form will appear in a moment."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive Customer"
        description="This removes the customer from active intermediary portfolio views. It will fail if the customer still has active insured assets."
        confirmLabel="Archive"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to={backPath}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader
            eyebrow="Intermediary Portal"
            title={title}
            description={description}
          />
        </div>

        {isEdit ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setArchiveOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Archive
          </Button>
        ) : null}
      </div>

      <CustomerForm
        customer={customerQuery.data ?? null}
        isPending={saveMutation.isPending}
        submitLabel={isEdit ? 'Update Customer' : 'Create Customer'}
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </div>
  );
}
