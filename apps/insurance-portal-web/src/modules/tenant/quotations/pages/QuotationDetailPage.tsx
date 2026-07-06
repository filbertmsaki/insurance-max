import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import { useDeleteQuotation, useQuotationDetail } from '../hooks';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading } = useQuotationDetail(id);
  const deleteMutation = useDeleteQuotation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Quotation not found</p>
        <Button variant="link" onClick={() => navigate('/quotations')}>Back to Quotations</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/quotations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{quotation.quotation_no}</h1>
              <QuotationStatusBadge status={quotation.status} />
            </div>
            <p className="text-sm text-slate-500">{quotation.customer?.company_name ?? quotation.customer_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/quotations/${quotation.id}/edit`)}>
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
          <TabsTrigger value="breakdowns">Premium Breakdown</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Customer" value={quotation.customer?.company_name ?? quotation.customer_id} />
              <Row label="Category" value={quotation.category?.name ?? quotation.category_id} />
              <Row label="Product" value={quotation.product?.product_name ?? quotation.product_id} />
              <Row label="Sub-Class" value={quotation.sub_class?.name ?? quotation.sub_class_id} />
              <Row label="Type" value={quotation.quotation_type} />
              <Row label="Channel" value={quotation.channel_type} />
              <Row label="Sum Insured" value={`${quotation.currency} ${quotation.sum_insured}`} />
              <Row label="Premium" value={`${quotation.currency} ${quotation.total_premium}`} />
              <Row label="Validity" value={`${quotation.valid_from} to ${quotation.valid_until}`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {(quotation.risks ?? []).map((risk) => (
            <Card key={risk.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Risk" value={risk.risk?.risk_name ?? risk.risk_id} />
                <Row label="Sum Insured" value={risk.sum_insured} />
                <Row label="Rate" value={risk.rate} />
                <Row label="Premium" value={risk.total_premium} />
                <Row label="Vehicle" value={risk.motor_vehicle?.registration_no ?? risk.motor_vehicle_id} />
              </CardContent>
            </Card>
          ))}
          {(quotation.risks ?? []).length === 0 && <p className="text-sm text-slate-500">No risks attached.</p>}
        </TabsContent>

        <TabsContent value="breakdowns" className="space-y-4">
          {(quotation.premium_breakdowns ?? []).map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Item" value={item.item_name} />
                <Row label="Code" value={item.item_code} />
                <Row label="Amount" value={item.amount} />
              </CardContent>
            </Card>
          ))}
          {(quotation.premium_breakdowns ?? []).length === 0 && <p className="text-sm text-slate-500">No breakdown items.</p>}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {(quotation.status_history ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="From" value={entry.old_status} />
                <Row label="To" value={entry.new_status} />
                <Row label="Reason" value={entry.reason} />
                <Row label="Changed At" value={entry.created_at} />
              </CardContent>
            </Card>
          ))}
          {(quotation.status_history ?? []).length === 0 && <p className="text-sm text-slate-500">No history yet.</p>}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Quotation"
        description="This will soft-delete the quotation."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(quotation.id, { onSuccess: () => navigate('/quotations') })}
      />
    </div>
  );
}
