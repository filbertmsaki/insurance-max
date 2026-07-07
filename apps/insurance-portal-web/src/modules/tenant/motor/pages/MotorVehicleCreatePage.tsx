import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCreateMotorVehicle, useMotorCustomers } from '../hooks';
import { MotorVehicleForm } from '../components/MotorVehicleForm';

export function MotorVehicleCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useMotorCustomers();
  const createMutation = useCreateMotorVehicle();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/underwriting/motor/vehicles')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Create Motor Vehicle" description="Add a vehicle to the motor register" />
      </div>

      <MotorVehicleForm
        customerOptions={customerOptions}
        isPending={createMutation.isPending}
        submitLabel="Create Vehicle"
        onSubmit={(values) => createMutation.mutate(values, { onSuccess: () => navigate('/underwriting/motor/vehicles') })}
      />
    </div>
  );
}
