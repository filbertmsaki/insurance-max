import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { PolicyStatusBadge } from '../components/PolicyStatusBadge';
import { useDeletePolicy, usePolicyDetail } from '../hooks';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: policy, isLoading } = usePolicyDetail(id);
  const deleteMutation = useDeletePolicy();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Policy not found</p>
        <Button variant="link" onClick={() => navigate('/policies')}>Back to Policies</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/policies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{policy.policy_no}</h1>
              <PolicyStatusBadge status={policy.policy_status} />
            </div>
            <p className="text-sm text-slate-500">{policy.customer?.company_name ?? policy.customer_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/policies/${policy.id}/edit`)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="breakdown">Premium Breakdown</TabsTrigger>
          <TabsTrigger value="motor">Motor Details</TabsTrigger>
          <TabsTrigger value="nonmotor">Non-Motor Details</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="tiramis">TIRAMIS</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Policy Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Row label="Customer" value={policy.customer?.company_name ?? policy.customer_id} />
              <Row label="Quotation" value={policy.quotation_id} />
              <Row label="Category" value={policy.category?.name ?? policy.category_id} />
              <Row label="Product" value={policy.product?.product_name ?? policy.product_id} />
              <Row label="Channel" value={policy.channel_type} />
              <Row label="Dates" value={`${policy.start_date} to ${policy.end_date}`} />
              <Row label="Sum Insured" value={`${policy.currency} ${policy.sum_insured}`} />
              <Row label="Premium" value={`${policy.currency} ${policy.total_premium}`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {(policy.risks ?? []).map((risk) => (
            <Card key={risk.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Risk" value={risk.risk?.risk_name ?? risk.risk_id} />
                <Row label="Sum Insured" value={risk.sum_insured} />
                <Row label="Premium" value={risk.total_premium} />
                <Row label="Vehicle" value={risk.motor_vehicle?.registration_no ?? risk.motor_vehicle_id} />
              </CardContent>
            </Card>
          ))}
          {(policy.risks ?? []).length === 0 && <p className="text-sm text-slate-500">No policy risks yet.</p>}
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          {(policy.premium_breakdowns ?? []).map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Item" value={item.item_name} />
                <Row label="Code" value={item.item_code} />
                <Row label="Amount" value={item.amount} />
              </CardContent>
            </Card>
          ))}
          {(policy.premium_breakdowns ?? []).length === 0 && <p className="text-sm text-slate-500">No breakdown items.</p>}
        </TabsContent>

        <TabsContent value="motor" className="space-y-4">
          <Card><CardContent className="pt-6 text-sm text-slate-500">Motor details will surface here once motor-linked policy risks are added.</CardContent></Card>
        </TabsContent>
        <TabsContent value="nonmotor" className="space-y-4">
          <Card><CardContent className="pt-6 text-sm text-slate-500">Non-motor details will surface here once subject matters are added.</CardContent></Card>
        </TabsContent>
        <TabsContent value="billing" className="space-y-4">
          <Card><CardContent className="pt-6 text-sm text-slate-500">Billing data can be connected here later.</CardContent></Card>
        </TabsContent>
        <TabsContent value="tiramis" className="space-y-4">
          <Card><CardContent className="pt-6 text-sm text-slate-500">TIRAMIS submissions are stored on the policy record and can be expanded later.</CardContent></Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {(policy.status_history ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="From" value={entry.old_status} />
                <Row label="To" value={entry.new_status} />
                <Row label="Reason" value={entry.reason} />
                <Row label="Changed At" value={entry.created_at} />
              </CardContent>
            </Card>
          ))}
          {(policy.status_history ?? []).length === 0 && <p className="text-sm text-slate-500">No history yet.</p>}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card><CardContent className="pt-6 text-sm text-slate-500">Document management can be connected here later.</CardContent></Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Policy"
        description="This will soft-delete the policy."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(policy.id, { onSuccess: () => navigate('/policies') })}
      />
    </div>
  );
}

