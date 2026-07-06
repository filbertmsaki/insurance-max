import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePolicyCategories, usePolicyCustomers, usePolicyProducts, useCreatePolicy } from '../hooks';
import { PolicyForm } from '../components/PolicyForm';

export function PolicyCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = usePolicyCustomers();
  const { data: categoryOptions = [] } = usePolicyCategories();
  const { data: productOptions = [] } = usePolicyProducts();
  const createMutation = useCreatePolicy();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/policies')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Create Policy" description="Create a new policy record" />
      </div>

      <PolicyForm
        customerOptions={customerOptions}
        categoryOptions={categoryOptions}
        productOptions={productOptions}
        subClassOptions={[]}
        isPending={createMutation.isPending}
        submitLabel="Create Policy"
        onSubmit={(values) => createMutation.mutate(values, { onSuccess: (policy) => navigate(`/policies/${policy.id}`) })}
      />
    </div>
  );
}

