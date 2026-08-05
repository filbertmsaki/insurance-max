import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useBillingCustomers,
  useBillingPolicies,
  useBillingQuotations,
  useCreateInvoice,
} from '../hooks';
import { InvoiceForm } from '../components/InvoiceForm';

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useBillingCustomers();
  const { data: policyPage } = useBillingPolicies();
  const { data: quotationPage } = useBillingQuotations();
  const createMutation = useCreateInvoice();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/billing/invoices')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Create Invoice"
          description="Create a new billing invoice"
        />
      </div>

      <InvoiceForm
        customerOptions={customerOptions}
        policyOptions={policyPage ?? []}
        quotationOptions={quotationPage ?? []}
        isPending={createMutation.isPending}
        submitLabel="Create Invoice"
        onSubmit={(values) =>
          createMutation.mutate(values, {
            onSuccess: (invoice) => navigate(`/billing/invoices/${invoice.id}`),
          })
        }
      />
    </div>
  );
}
