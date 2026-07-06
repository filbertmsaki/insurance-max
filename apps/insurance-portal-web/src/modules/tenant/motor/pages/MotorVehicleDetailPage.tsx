import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import { useDeleteMotorVehicle, useMotorVehicle } from '../hooks';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function MotorVehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vehicle, isLoading } = useMotorVehicle(id);
  const deleteMutation = useDeleteMotorVehicle();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/motor/vehicles')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{vehicle.registration_no ?? vehicle.id}</h1>
              <MotorStatusBadge status={vehicle.status} />
            </div>
            <p className="text-sm text-slate-500">
              {vehicle.customer ? getCustomerDisplayName(vehicle.customer) : vehicle.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/motor/vehicles/${vehicle.id}/edit`)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vehicle Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Customer" value={vehicle.customer ? getCustomerDisplayName(vehicle.customer) : vehicle.customer_id} />
          <Row label="Registration No." value={vehicle.registration_no} />
          <Row label="Chassis No." value={vehicle.chassis_no} />
          <Row label="Engine No." value={vehicle.engine_no} />
          <Row label="Make / Model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ')} />
          <Row label="Vehicle Value" value={`${vehicle.currency} ${vehicle.vehicle_value}`} />
          <Row label="Status" value={vehicle.status} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Vehicle"
        description="This will soft-delete the motor vehicle."
        confirmLabel="Delete Vehicle"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(vehicle.id, { onSuccess: () => navigate('/motor/vehicles') })}
      />
    </div>
  );
}
