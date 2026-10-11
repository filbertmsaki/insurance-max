import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { MotorFleetForm } from '../components/MotorFleetForm';
import {
  useCreateMotorFleet,
  useMotorCustomers,
  useMotorPolicies,
  useMotorQuotations,
} from '../hooks';

export function MotorFleetCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const { data: quotationOptions = [] } = useMotorQuotations();
  const { data: policyOptions = [] } = useMotorPolicies();
  const createMutation = useCreateMotorFleet();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/underwrite/fleet/fleets')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Create Motor Fleet"
          description="Add a fleet record"
        />
      </div>

      <MotorFleetForm
        customerOptions={customerOptions}
        quotationOptions={quotationOptions}
        policyOptions={policyOptions}
        isPending={createMutation.isPending}
        submitLabel="Create Fleet"
        onSubmit={(values) =>
          createMutation.mutate(values, {
            onSuccess: () => navigate('/underwrite/fleet/fleets'),
          })
        }
      />
    </div>
  );
}
