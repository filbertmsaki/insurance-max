import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { CustomerForm } from '../components/CustomerForm';
import { useCreateCustomer } from '../hooks';

export function CustomerCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateCustomer();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(underwritingPaths.customers)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Create Customer"
          description="Add a new customer to the tenant database"
        />
      </div>

      <CustomerForm
        isPending={createMutation.isPending}
        submitLabel="Create Customer"
        onSubmit={(values) =>
          createMutation.mutate(values, {
            onSuccess: () => navigate(underwritingPaths.customers),
          })
        }
      />
    </div>
  );
}
