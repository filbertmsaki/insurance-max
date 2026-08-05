import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BillingStatusBadge } from '../components/BillingStatusBadge';
import { useDeleteReceipt, useReceiptDetail } from '../hooks';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: receipt, isLoading } = useReceiptDetail(id);
  const deleteMutation = useDeleteReceipt();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-[600px] w-full" />;

  if (!receipt) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Receipt not found</p>
        <Button variant="link" onClick={() => navigate('/billing/receipts')}>Back to Receipts</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/billing/receipts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{receipt.receipt_no}</h1>
              <BillingStatusBadge status={receipt.status} />
            </div>
            <p className="text-sm text-slate-500">{receipt.customer?.customer_no ?? receipt.customer_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/billing/receipts/${receipt.id}/edit`)}>
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
        <CardHeader className="pb-2"><CardTitle className="text-base">Receipt Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Customer" value={receipt.customer?.customer_no ?? receipt.customer_id} />
          <Row label="Invoice" value={receipt.invoice?.invoice_no ?? receipt.invoice_id} />
          <Row label="Payment Method" value={receipt.payment_method} />
          <Row label="Amount" value={`${receipt.currency} ${receipt.amount}`} />
          <Row label="Payment Reference" value={receipt.payment_reference} />
          <Row label="Received At" value={receipt.received_at} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Receipt"
        description="This will soft-delete the receipt."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(receipt.id, { onSuccess: () => navigate('/billing/receipts') })}
      />
    </div>
  );
}

