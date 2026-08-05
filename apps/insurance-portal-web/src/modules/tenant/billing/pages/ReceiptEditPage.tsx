import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useBillingCustomers,
  useBillingInvoices,
  useReceiptDetail,
  useUpdateReceipt,
} from '../hooks';
import { ReceiptForm } from '../components/ReceiptForm';

export function ReceiptEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useBillingCustomers();
  const { data: invoiceOptions = [] } = useBillingInvoices();
  const { data: receipt, isLoading } = useReceiptDetail(id);
  const updateMutation = useUpdateReceipt(id);

  if (isLoading) return <Skeleton className="h-[700px] w-full" />;

  if (!receipt) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Receipt not found</p>
        <Button variant="link" onClick={() => navigate('/billing/receipts')}>
          Back to Receipts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/billing/receipts/${receipt.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Edit Receipt" description={receipt.receipt_no} />
      </div>

      <ReceiptForm
        customerOptions={customerOptions}
        invoiceOptions={invoiceOptions}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        defaultValues={{
          customer_id: receipt.customer_id,
          invoice_id: receipt.invoice_id ?? '',
          payment_method: receipt.payment_method,
          amount: receipt.amount,
          currency: receipt.currency,
          payment_reference: receipt.payment_reference ?? '',
          received_by: receipt.received_by ?? '',
          received_at: receipt.received_at ?? '',
          status: receipt.status,
        }}
        onSubmit={(values) =>
          updateMutation.mutate(values, {
            onSuccess: () => navigate(`/billing/receipts/${receipt.id}`),
          })
        }
      />
    </div>
  );
}
