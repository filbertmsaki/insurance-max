import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { MotorFleetForm } from '../components/MotorFleetForm';
import {
  useMotorCustomers,
  useMotorFleet,
  useMotorPolicies,
  useMotorQuotations,
  useUpdateMotorFleet,
} from '../hooks';
import { motorFleetRecordToFormValues } from '../schemas';

export function MotorFleetEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const { data: quotationOptions = [] } = useMotorQuotations();
  const { data: policyOptions = [] } = useMotorPolicies();
  const { data: fleet, isLoading } = useMotorFleet(id);
  const updateMutation = useUpdateMotorFleet(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[700px] w-full" />
      </div>
    );
  }

  if (!fleet) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Fleet not found</p>
        <Button
          variant="link"
          onClick={() => navigate('/underwrite/fleet/fleets')}
        >
          Back to Fleets
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
          onClick={() => navigate(`/underwrite/fleet/fleets/${fleet.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Edit Motor Fleet" description={fleet.fleet_no} />
      </div>

      <MotorFleetForm
        customerOptions={customerOptions}
        quotationOptions={quotationOptions}
        policyOptions={policyOptions}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        defaultValues={motorFleetRecordToFormValues(fleet)}
        onSubmit={(values) =>
          updateMutation.mutate(values, {
            onSuccess: () => navigate(`/underwrite/fleet/fleets/${fleet.id}`),
          })
        }
      />
    </div>
  );
}
