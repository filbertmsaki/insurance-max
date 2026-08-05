import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BillingStatusBadge } from '../components/BillingStatusBadge';
import { useCommissionPaymentDetail, useDeleteCommissionPayment } from '../hooks';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function CommissionPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: record, isLoading } = useCommissionPaymentDetail(id);
  const deleteMutation = useDeleteCommissionPayment();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-[600px] w-full" />;

  if (!record) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Commission payment not found</p>
        <Button variant="link" onClick={() => navigate('/billing/commission-payments')}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/billing/commission-payments')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{record.payment_no}</h1>
            <p className="text-sm text-slate-500">{record.payment_method}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Commission Payment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Intermediary Company" value={record.intermediary_company_id} />
          <Row label="Amount" value={`${record.currency} ${record.total_amount}`} />
          <Row label="Payment Reference" value={record.payment_reference} />
          <Row label="Status" value={record.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(record.items ?? []).map((item) => (
            <div key={item.id ?? item.commission_transaction_id} className="rounded-lg border border-slate-200 p-4">
              <Row label="Commission Transaction" value={item.commission_transaction?.policy?.policy_no ?? item.commission_transaction_id} />
              <Row label="Amount" value={item.amount} />
            </div>
          ))}
          {(record.items ?? []).length === 0 && <p className="text-sm text-slate-500">No commission items.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
        <CardContent>
          <BillingStatusBadge status={record.status} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Commission Payment"
        description="This will soft-delete the commission payment."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(record.id, { onSuccess: () => navigate('/billing/commission-payments') })}
      />
    </div>
  );
}

