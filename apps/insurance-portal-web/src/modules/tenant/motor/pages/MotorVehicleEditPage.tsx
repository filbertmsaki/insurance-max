import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useMotorCustomers, useMotorVehicle, useUpdateMotorVehicle } from '../hooks';
import { MotorVehicleForm } from '../components/MotorVehicleForm';

export function MotorVehicleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const { data: vehicle, isLoading } = useMotorVehicle(id);
  const updateMutation = useUpdateMotorVehicle(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[700px] w-full" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Vehicle not found</p>
        <Button variant="link" onClick={() => navigate('/motor/vehicles')}>
          Back to Vehicles
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/motor/vehicles/${vehicle.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Edit Motor Vehicle" description={vehicle.registration_no ?? vehicle.id} />
      </div>

      <MotorVehicleForm
        customerOptions={customerOptions}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        defaultValues={vehicle}
        onSubmit={(values) => updateMutation.mutate(values, { onSuccess: () => navigate(`/motor/vehicles/${vehicle.id}`) })}
      />
    </div>
  );
}
