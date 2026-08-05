import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BillingStatusBadge } from '../components/BillingStatusBadge';
import { useCommissionTransactionDetail, useDeleteCommissionTransaction } from '../hooks';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function CommissionTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: record, isLoading } = useCommissionTransactionDetail(id);
  const deleteMutation = useDeleteCommissionTransaction();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-[600px] w-full" />;

  if (!record) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Commission transaction not found</p>
        <Button variant="link" onClick={() => navigate('/billing/commission-transactions')}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/billing/commission-transactions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{record.commission_type}</h1>
            <p className="text-sm text-slate-500">{record.policy?.policy_no ?? record.policy_id}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Commission Transaction</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Policy" value={record.policy?.policy_no ?? record.policy_id} />
          <Row label="Invoice" value={record.invoice?.invoice_no ?? record.invoice_id} />
          <Row label="Receipt" value={record.receipt?.receipt_no ?? record.receipt_id} />
          <Row label="Gross Premium" value={record.gross_premium} />
          <Row label="Net Premium" value={record.net_premium} />
          <Row label="Rate" value={record.commission_rate} />
          <Row label="Amount" value={record.commission_amount} />
          <Row label="Status" value={record.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <BillingStatusBadge status={record.status} />
          <Row label="Earned At" value={record.earned_at} />
          <Row label="Paid At" value={record.paid_at} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Commission Transaction"
        description="This will soft-delete the commission transaction."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(record.id, { onSuccess: () => navigate('/billing/commission-transactions') })}
      />
    </div>
  );
}

