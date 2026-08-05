import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useBillingCustomers,
  useBillingInvoices,
  useCreateReceipt,
} from '../hooks';
import { ReceiptForm } from '../components/ReceiptForm';

export function ReceiptCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useBillingCustomers();
  const { data: invoiceOptions = [] } = useBillingInvoices();
  const createMutation = useCreateReceipt();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/billing/receipts')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Create Receipt"
          description="Record a receipt against an invoice"
        />
      </div>

      <ReceiptForm
        customerOptions={customerOptions}
        invoiceOptions={invoiceOptions}
        isPending={createMutation.isPending}
        submitLabel="Create Receipt"
        onSubmit={(values) =>
          createMutation.mutate(values, {
            onSuccess: (receipt) => navigate(`/billing/receipts/${receipt.id}`),
          })
        }
      />
    </div>
  );
}
