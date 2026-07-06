import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, RotateCcw, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CustomerStatusBadge } from '../components/CustomerStatusBadge';
import { useCustomer, useDeleteCustomer, useRestoreCustomer, getCustomerDisplayName } from '../hooks';

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
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
        <Button variant="link" onClick={() => navigate('/customers')}>
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-11 w-11 rounded-lg bg-blue-100 flex items-center justify-center">
            <UserCircle2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{customerName}</h1>
              <CustomerStatusBadge status={customer.status} />
              <Badge variant="outline">{customer.customer_type.replace(/_/g, ' ')}</Badge>
            </div>
            <code className="text-xs text-slate-400">{customer.customer_no}</code>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRestoreOpen(true)} disabled={customer.status === 'ACTIVE'}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restore
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription>Core customer identity and policy holder information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Customer No." value={customer.customer_no} />
            <DetailRow label="Type" value={customer.customer_type.replace(/_/g, ' ')} />
            <DetailRow label="Status" value={customer.status.replace(/_/g, ' ')} />
            <DetailRow label="KYC Status" value={customer.kyc_status.replace(/_/g, ' ')} />
            <DetailRow label="ID Type" value={customer.id_type ?? ' - '} />
            <DetailRow label="ID Number" value={customer.id_number} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Phone" value={customer.phone} />
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Alternate Phone" value={customer.alternate_phone} />
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
            <CardTitle className="text-base">Corporate / Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.customer_type === 'INDIVIDUAL' ? (
              <>
                <DetailRow label="First Name" value={customer.first_name} />
                <DetailRow label="Middle Name" value={customer.middle_name} />
                <DetailRow label="Last Name" value={customer.last_name} />
                <DetailRow label="Gender" value={customer.gender} />
                <DetailRow label="Date of Birth" value={customer.date_of_birth} />
                <DetailRow label="Nationality" value={customer.nationality} />
              </>
            ) : (
              <>
                <DetailRow label="Company Name" value={customer.company_name} />
                <DetailRow label="Registration No." value={customer.registration_no} />
                <DetailRow label="Incorporation Cert No." value={customer.incorporation_certificate_no} />
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
          <DetailRow label="Document File Name" value={customer.document_file_name} />
          <DetailRow label="Document Mime Type" value={customer.document_mime_type} />
          <DetailRow label="Document Verified" value={customer.document_verified ? 'Yes' : 'No'} />
          <DetailRow label="Document Verified At" value={customer.document_verified_at} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Customer"
        description="This will soft-delete the customer record."
        confirmLabel="Delete Customer"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(customer.id, { onSuccess: () => navigate('/customers') })
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
          restoreMutation.mutate(customer.id, { onSuccess: () => setRestoreOpen(false) })
        }
      />
    </div>
  );
}
