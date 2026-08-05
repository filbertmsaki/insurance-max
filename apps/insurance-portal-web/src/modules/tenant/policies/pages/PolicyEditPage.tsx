import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  usePolicyCategories,
  usePolicyCustomers,
  usePolicyDetail,
  usePolicyProducts,
  useUpdatePolicy,
} from '../hooks';
import { PolicyForm } from '../components/PolicyForm';
import { policyRecordToFormValues } from '../schemas';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

export function PolicyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerOptions = [] } = usePolicyCustomers();
  const { data: categoryOptions = [] } = usePolicyCategories();
  const { data: productOptions = [] } = usePolicyProducts();
  const { data: policy, isLoading } = usePolicyDetail(id);
  const updateMutation = useUpdatePolicy(id);

  if (isLoading) {
    return <Skeleton className="h-[700px] w-full" />;
  }

  if (!policy) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Policy not found</p>
        <Button
          variant="link"
          onClick={() => navigate(underwritingPaths.policies)}
        >
          Back to Policies
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
          onClick={() => navigate(underwritingPaths.policyDetail(policy.id))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Edit Policy" description={policy.policy_no} />
      </div>

      <PolicyForm
        customerOptions={customerOptions}
        categoryOptions={categoryOptions}
        productOptions={productOptions}
        subClassOptions={[]}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        defaultValues={policyRecordToFormValues(policy)}
        onSubmit={(values) =>
          updateMutation.mutate(values, {
            onSuccess: () =>
              navigate(underwritingPaths.policyDetail(policy.id)),
          })
        }
      />
    </div>
  );
}
