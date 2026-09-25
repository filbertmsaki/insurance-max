import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MotorStatusBadge } from '../components/MotorStatusBadge';
import {
  useDeleteMotorVehicle,
  useMotorVehicle,
  useMotorVehicleAuditHistory,
  useMotorVehicleInsuranceHistory,
  useMotorVehicleVersions,
  useRestoreMotorVehicle,
} from '../hooks';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
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
  const { data: versions = [] } = useMotorVehicleVersions(id);
  const { data: auditHistory = [] } = useMotorVehicleAuditHistory(id);
  const { data: insuranceHistory } = useMotorVehicleInsuranceHistory(id);
  const deleteMutation = useDeleteMotorVehicle();
  const restoreMutation = useRestoreMotorVehicle();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

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
        <Button
          variant="link"
          onClick={() => navigate('/underwriting/motor/vehicles')}
        >
          Back to Vehicles
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/underwriting/motor/vehicles')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {vehicle.registration_no ?? vehicle.id}
              </h1>
              <MotorStatusBadge status={vehicle.status} />
            </div>
            <p className="text-sm text-slate-500">
              {vehicle.customer
                ? getCustomerDisplayName(vehicle.customer)
                : vehicle.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/underwriting/motor/vehicles/${vehicle.id}/edit`)
            }
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Archive
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRestoreOpen(true)}
            disabled={vehicle.status === 'ACTIVE'}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restore
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              label="Customer"
              value={
                vehicle.customer
                  ? getCustomerDisplayName(vehicle.customer)
                  : vehicle.customer_id
              }
            />
            <Row label="Registration No." value={vehicle.registration_no} />
            <Row label="Chassis No." value={vehicle.chassis_no} />
            <Row label="Motor Category" value={vehicle.motor_category} />
            <Row label="Motor Type" value={vehicle.motor_type} />
            <Row label="Motor Usage" value={vehicle.motor_usage} />
            <Row label="Status" value={vehicle.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Owner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Owner Name" value={vehicle.owner_name} />
            <Row label="Owner Category" value={vehicle.owner_category} />
            <Row label="Owner Address" value={vehicle.owner_address} />
            <Row
              label="Current Customer"
              value={
                vehicle.customer
                  ? getCustomerDisplayName(vehicle.customer)
                  : vehicle.customer_id
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Technical Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Engine No." value={vehicle.engine_no} />
            <Row
              label="Make / Model"
              value={[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
            />
            <Row label="Model No." value={vehicle.model_no} />
            <Row label="Body Type" value={vehicle.body_type} />
            <Row label="Color" value={vehicle.color} />
            <Row label="Fuel" value={vehicle.fuel_type} />
            <Row label="Engine Capacity" value={vehicle.cubic_capacity} />
            <Row label="Axles" value={vehicle.number_of_axles} />
            <Row label="Axle Distance" value={vehicle.axle_distance} />
            <Row label="Sitting Capacity" value={vehicle.seating_capacity} />
            <Row label="Year" value={vehicle.manufacture_year} />
            <Row label="Tare Weight" value={vehicle.tare_weight} />
            <Row label="Gross Weight" value={vehicle.gross_weight} />
            <Row
              label="Vehicle Value"
              value={`${vehicle.currency} ${vehicle.vehicle_value}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              TIRA Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Verified" value={vehicle.is_verified ? 'Yes' : 'No'} />
            <Row label="Status" value={vehicle.verification_status} />
            <Row label="Source" value={vehicle.verification_source} />
            <Row label="Request ID" value={vehicle.tira_request_id} />
            <Row label="Response ID" value={vehicle.tira_response_id} />
            <Row label="Last Verified" value={vehicle.last_verified_at} />
            <Row label="Reference" value={vehicle.tira_vehicle_reference} />
            <Row label="Error" value={vehicle.verification_error} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Insurance History</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Row
            label="Policies"
            value={insuranceHistory?.policies.length ?? 0}
          />
          <Row
            label="Fleet Records"
            value={insuranceHistory?.fleet_items.length ?? 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ownership History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(vehicle.ownership_history ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No ownership records.</p>
          ) : (
            (vehicle.ownership_history ?? []).map((ownership) => (
              <div key={ownership.id} className="rounded-md border p-3">
                <div className="font-medium text-slate-900">
                  {ownership.owner_customer
                    ? getCustomerDisplayName(ownership.owner_customer)
                    : ownership.owner_customer_id}
                </div>
                <div className="text-sm text-slate-600">
                  {ownership.effective_from} to{' '}
                  {ownership.effective_to ?? 'Current'}
                </div>
                <div className="text-xs text-slate-500">
                  {ownership.change_reason ?? 'No change reason recorded'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {versions.length === 0 ? (
            <p className="text-sm text-slate-500">No versions recorded.</p>
          ) : (
            versions.map((version) => (
              <div key={version.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">
                    Version {version.version_number}
                    {version.is_current_version ? ' - Current' : ''}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(version.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {String(
                    version.vehicle_snapshot.registrationNo ??
                      version.vehicle_snapshot.chassisNo ??
                      'Vehicle snapshot',
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Audit History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No audit entries.</p>
          ) : (
            auditHistory.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Fields changed:{' '}
                  {entry.fields_changed?.length
                    ? entry.fields_changed.join(', ')
                    : 'None'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Archive Vehicle"
        description="This archives the vehicle while preserving quotation, policy, and TIRA history."
        confirmLabel="Archive Vehicle"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(vehicle.id, {
            onSuccess: () => navigate('/underwriting/motor/vehicles'),
          })
        }
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restore Vehicle"
        description="This makes the archived vehicle active again."
        confirmLabel="Restore Vehicle"
        loading={restoreMutation.isPending}
        onConfirm={() =>
          restoreMutation.mutate(vehicle.id, {
            onSuccess: () => setRestoreOpen(false),
          })
        }
      />
    </div>
  );
}
