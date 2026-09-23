import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  RotateCcw,
  UserCircle2,
  History,
  FileText,
  Car,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { CustomerStatusBadge } from '../components/CustomerStatusBadge';
import {
  useCustomer,
  useCustomerAuditHistory,
  useCustomerVersions,
  useDeleteCustomer,
  useRestoreCustomer,
  getCustomerDisplayName,
} from '../hooks';
import { useMotorVehiclesByCustomer } from '@/modules/tenant/motor/hooks';

function DetailRow({
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

function maskIdentifier(value: string | null | undefined) {
  if (!value) return ' - ';
  const suffix = value.slice(-4);
  return `${'*'.repeat(Math.max(4, value.length - 4))}${suffix}`;
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return ' - ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function snapshotLabel(snapshot: Record<string, unknown>) {
  return (
    String(snapshot.displayName ?? '') ||
    String(snapshot.companyName ?? '') ||
    [snapshot.firstName, snapshot.middleName, snapshot.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Customer snapshot'
  );
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: versions = [] } = useCustomerVersions(id);
  const { data: auditHistory = [] } = useCustomerAuditHistory(id);
  const { data: customerVehicles } = useMotorVehiclesByCustomer(id);
  const deleteMutation = useDeleteCustomer();
  const restoreMutation = useRestoreCustomer();

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

  if (!customer) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Customer not found</p>
        <Button
          variant="link"
          onClick={() => navigate(underwritingPaths.customers)}
        >
          Back to Customers
        </Button>
      </div>
    );
  }

  const customerName = getCustomerDisplayName(customer);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(underwritingPaths.customers)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-11 w-11 rounded-lg bg-blue-100 flex items-center justify-center">
            <UserCircle2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {customerName}
              </h1>
              <CustomerStatusBadge status={customer.status} />
              <Badge variant="outline">
                {customer.customer_type.replace(/_/g, ' ')}
              </Badge>
            </div>
            <code className="text-xs text-slate-400">
              {customer.customer_no}
            </code>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(underwritingPaths.customerEdit(customer.id))
            }
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRestoreOpen(true)}
            disabled={customer.status === 'ACTIVE'}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restore
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription>
              Core customer identity and policy holder information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Customer No." value={customer.customer_no} />
            <DetailRow
              label="Type"
              value={customer.customer_type.replace(/_/g, ' ')}
            />
            <DetailRow
              label="Status"
              value={customer.status.replace(/_/g, ' ')}
            />
            <DetailRow
              label="KYC Status"
              value={customer.kyc_status.replace(/_/g, ' ')}
            />
            <DetailRow
              label="Current Version"
              value={
                versions.find((version) => version.is_current_version)
                  ?.version_number ?? 1
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identification</CardTitle>
            <CardDescription>
              TIRA policyholder identity fields for this customer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="ID Type" value={customer.id_type ?? ' - '} />
            <DetailRow
              label="ID Number"
              value={maskIdentifier(customer.id_number)}
            />
            <DetailRow label="NIN" value={maskIdentifier(customer.nida_no)} />
            <DetailRow
              label="Voter No."
              value={maskIdentifier(customer.voter_no)}
            />
            <DetailRow
              label="Passport"
              value={maskIdentifier(customer.passport_no)}
            />
            <DetailRow label="TIN" value={maskIdentifier(customer.tin)} />
            <DetailRow
              label="Incorporation Cert"
              value={maskIdentifier(customer.incorporation_certificate_no)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Phone" value={customer.phone} />
            <DetailRow label="Email" value={customer.email} />
            <DetailRow
              label="Alternate Phone"
              value={customer.alternate_phone}
            />
            <DetailRow label="Contact Name" value={customer.contact_name} />
            <DetailRow label="Contact Role" value={customer.contact_role} />
            <DetailRow label="Contact Phone" value={customer.contact_phone} />
            <DetailRow label="Contact Email" value={customer.contact_email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Country" value={customer.country} />
            <DetailRow label="Country Code" value={customer.country_code} />
            <DetailRow label="Region" value={customer.region} />
            <DetailRow label="District" value={customer.district} />
            <DetailRow label="Ward" value={customer.ward} />
            <DetailRow label="Street" value={customer.street} />
            <DetailRow label="Postal Address" value={customer.postal_address} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Corporate / Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.customer_type === 'INDIVIDUAL' ? (
              <>
                <DetailRow label="First Name" value={customer.first_name} />
                <DetailRow label="Middle Name" value={customer.middle_name} />
                <DetailRow label="Last Name" value={customer.last_name} />
                <DetailRow label="Gender" value={customer.gender} />
                <DetailRow
                  label="Date of Birth"
                  value={customer.date_of_birth}
                />
                <DetailRow label="Nationality" value={customer.nationality} />
              </>
            ) : (
              <>
                <DetailRow label="Company Name" value={customer.company_name} />
                <DetailRow
                  label="Registration No."
                  value={customer.registration_no}
                />
                <DetailRow
                  label="Incorporation Cert No."
                  value={customer.incorporation_certificate_no}
                />
                <DetailRow label="TIN" value={customer.tin} />
                <DetailRow label="VRN" value={customer.vrn} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Document Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DetailRow label="Document Type" value={customer.document_type} />
          <DetailRow label="Document No." value={customer.document_no} />
          <DetailRow
            label="Document File Name"
            value={customer.document_file_name}
          />
          <DetailRow
            label="Document Mime Type"
            value={customer.document_mime_type}
          />
          <DetailRow
            label="Document Verified"
            value={customer.document_verified ? 'Yes' : 'No'}
          />
          <DetailRow
            label="Document Verified At"
            value={customer.document_verified_at}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4" />
              Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(customerVehicles?.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">
                No vehicles are linked to this customer.
              </p>
            ) : (
              (customerVehicles?.data ?? []).slice(0, 5).map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  className="block w-full rounded-md border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                  onClick={() =>
                    navigate(underwritingPaths.motorVehicleDetail(vehicle.id))
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {vehicle.registration_no ??
                        vehicle.chassis_no ??
                        vehicle.id}
                    </span>
                    <Badge variant="outline">{vehicle.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {[vehicle.make, vehicle.model, vehicle.manufacture_year]
                      .filter(Boolean)
                      .join(' ') || 'Vehicle details pending'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Verification:{' '}
                    {vehicle.verification_status ?? 'NOT_VERIFIED'}
                  </div>
                </button>
              ))
            )}
            {(customerVehicles?.data ?? []).length > 5 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(
                    `${underwritingPaths.motorVehicles}?customer_id=${customer.id}`,
                  )
                }
              >
                View all vehicles
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quotations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Linked quotation snapshots remain tied to the policyholder version
            captured at creation.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Policies</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Policy records keep their issued customer snapshot for regulatory
            audit.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Claims</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Claims should reference the policyholder details in force for the
            related policy.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
          <CardDescription>
            Immutable customer snapshots used to protect historical quotations,
            policies, and submissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {versions.length === 0 ? (
            <p className="text-sm text-slate-500">No versions recorded.</p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id ?? version.version_number}
                className="rounded-md border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">
                    Version {version.version_number}
                    {version.is_current_version ? ' - Current' : ''}
                  </div>
                  <Badge variant="outline">
                    {formatDateTime(version.created_at)}
                  </Badge>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                  <span>{snapshotLabel(version.customer_snapshot)}</span>
                  <span>
                    ID:{' '}
                    {maskIdentifier(
                      String(
                        version.customer_snapshot.primaryIdNumber ??
                          version.customer_snapshot.idNumber ??
                          '',
                      ),
                    )}
                  </span>
                  <span>
                    Phone:{' '}
                    {String(
                      version.customer_snapshot.primaryPhone ??
                        version.customer_snapshot.phone ??
                        ' - ',
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Audit History
          </CardTitle>
          <CardDescription>
            Read-only record of customer lifecycle changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditHistory.length === 0 ? (
            <p className="text-sm text-slate-500">
              No audit entries available for this user.
            </p>
          ) : (
            auditHistory.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">
                    {entry.action.replace(/_/g, ' ')}
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Fields changed:{' '}
                  {entry.fields_changed?.length
                    ? entry.fields_changed.join(', ')
                    : 'None'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Source: {entry.source.replace(/_/g, ' ')}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Archive Customer"
        description="This will archive the customer while preserving all historical policyholder snapshots."
        confirmLabel="Archive Customer"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(customer.id, {
            onSuccess: () => navigate(underwritingPaths.customers),
          })
        }
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restore Customer"
        description="This will restore the customer and make it active again."
        confirmLabel="Restore Customer"
        loading={restoreMutation.isPending}
        onConfirm={() =>
          restoreMutation.mutate(customer.id, {
            onSuccess: () => setRestoreOpen(false),
          })
        }
      />
    </div>
  );
}
