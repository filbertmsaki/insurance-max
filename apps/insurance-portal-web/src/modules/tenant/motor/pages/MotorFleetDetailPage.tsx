import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import { useDeleteMotorFleet, useMotorFleet } from '../hooks';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function MotorFleetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fleet, isLoading } = useMotorFleet(id);
  const deleteMutation = useDeleteMotorFleet();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!fleet) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Fleet not found</p>
        <Button variant="link" onClick={() => navigate('/motor/fleets')}>
          Back to Fleets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/motor/fleets')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{fleet.fleet_no}</h1>
              <MotorStatusBadge status={fleet.status} />
            </div>
            <p className="text-sm text-slate-500">
              {fleet.customer ? getCustomerDisplayName(fleet.customer) : fleet.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/motor/fleets/${fleet.id}/edit`)}>
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
          <CardTitle className="text-base">Fleet Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Customer" value={fleet.customer ? getCustomerDisplayName(fleet.customer) : fleet.customer_id} />
          <Row label="Quotation" value={fleet.quotation?.quotation_no ?? fleet.quotation_id} />
          <Row label="Fleet Name" value={fleet.fleet_name} />
          <Row label="Total Vehicles" value={fleet.total_vehicles} />
          <Row label="Total Sum Insured" value={fleet.total_sum_insured} />
          <Row label="Total Premium" value={fleet.total_premium} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Fleet"
        description="This will soft-delete the motor fleet."
        confirmLabel="Delete Fleet"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(fleet.id, { onSuccess: () => navigate('/motor/fleets') })}
      />
    </div>
  );
}
