import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  useDeletePaymentTransaction,
  usePaymentTransactionDetail,
} from '../hooks';

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function PaymentTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: record, isLoading } = usePaymentTransactionDetail(id);
  const deleteMutation = useDeletePaymentTransaction();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-[600px] w-full" />;

  if (!record) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Payment transaction not found</p>
        <Button
          variant="link"
          onClick={() => navigate('/billing/payment-transactions')}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/billing/payment-transactions')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {record.provider_reference}
            </h1>
            <p className="text-sm text-slate-500">{record.provider}</p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payment Transaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row
            label="Invoice"
            value={record.invoice?.invoice_no ?? record.invoice_id}
          />
          <Row
            label="Receipt"
            value={record.receipt?.receipt_no ?? record.receipt_id}
          />
          <Row label="Provider" value={record.provider} />
          <Row label="Internal Reference" value={record.internal_reference} />
          <Row label="Amount" value={`${record.currency} ${record.amount}`} />
          <Row label="Status" value={record.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payloads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">
            {JSON.stringify(record.request_payload ?? {}, null, 2)}
          </pre>
          <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">
            {JSON.stringify(record.response_payload ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Transaction"
        description="This will soft-delete the payment transaction."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(record.id, {
            onSuccess: () => navigate('/billing/payment-transactions'),
          })
        }
      />
    </div>
  );
}
