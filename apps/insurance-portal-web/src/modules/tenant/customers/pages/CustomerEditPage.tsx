import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { CustomerForm } from '../components/CustomerForm';
import { useCustomer, useUpdateCustomer } from '../hooks';

export function CustomerEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const updateMutation = useUpdateCustomer(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[700px] w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Customer not found</p>
        <Button
          variant="link"
          onClick={() => navigate(sharedUnderwritePaths.customers)}
        >
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate(sharedUnderwritePaths.customerDetail(customer.id))
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Edit Customer" description={customer.customer_no} />
      </div>

      <CustomerForm
        customer={customer}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        onSubmit={(values) =>
          updateMutation.mutate(values, {
            onSuccess: () =>
              navigate(sharedUnderwritePaths.customerDetail(customer.id)),
          })
        }
      />
    </div>
  );
}
