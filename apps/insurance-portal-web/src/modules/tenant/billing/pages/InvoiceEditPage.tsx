import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useBillingCustomers,
  useBillingPolicies,
  useBillingQuotations,
  useInvoiceDetail,
  useUpdateInvoice,
} from '../hooks';
import { InvoiceForm } from '../components/InvoiceForm';

export function InvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useBillingCustomers();
  const { data: policyPage } = useBillingPolicies();
  const { data: quotationPage } = useBillingQuotations();
  const { data: invoice, isLoading } = useInvoiceDetail(id);
  const updateMutation = useUpdateInvoice(id);

  if (isLoading) return <Skeleton className="h-[700px] w-full" />;

  if (!invoice) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Invoice not found</p>
        <Button variant="link" onClick={() => navigate('/billing/invoices')}>
          Back to Invoices
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
          onClick={() => navigate(`/billing/invoices/${invoice.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Edit Invoice" description={invoice.invoice_no} />
      </div>

      <InvoiceForm
        customerOptions={customerOptions}
        policyOptions={policyPage ?? []}
        quotationOptions={quotationPage ?? []}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        defaultValues={{
          insurer_company_id: invoice.insurer_company_id,
          intermediary_company_id: invoice.intermediary_company_id ?? '',
          customer_id: invoice.customer_id,
          quotation_id: invoice.quotation_id ?? '',
          policy_id: invoice.policy_id ?? '',
          endorsement_id: invoice.endorsement_id ?? '',
          cancellation_id: invoice.cancellation_id ?? '',
          renewal_id: invoice.renewal_id ?? '',
          invoice_type: invoice.invoice_type,
          currency: invoice.currency,
          gross_amount: invoice.gross_amount,
          discount_amount: invoice.discount_amount,
          tax_amount: invoice.tax_amount,
          charges_amount: invoice.charges_amount,
          total_amount: invoice.total_amount,
          paid_amount: invoice.paid_amount,
          balance_amount: invoice.balance_amount,
          status: invoice.status,
          due_date: invoice.due_date ?? '',
        }}
        onSubmit={(values) =>
          updateMutation.mutate(values, {
            onSuccess: () => navigate(`/billing/invoices/${invoice.id}`),
          })
        }
      />
    </div>
  );
}
