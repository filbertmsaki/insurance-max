import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BillingStatusBadge } from '../components/BillingStatusBadge';
import { useDeleteInvoice, useInvoiceDetail } from '../hooks';

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoiceDetail(id);
  const deleteMutation = useDeleteInvoice();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-[600px] w-full" />;

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
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/billing/invoices')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {invoice.invoice_no}
              </h1>
              <BillingStatusBadge status={invoice.status} />
            </div>
            <p className="text-sm text-slate-500">
              {invoice.customer?.company_name ?? invoice.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/billing/invoices/${invoice.id}/edit`)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row
            label="Customer"
            value={invoice.customer?.company_name ?? invoice.customer_id}
          />
          <Row
            label="Policy"
            value={invoice.policy?.policy_no ?? invoice.policy_id}
          />
          <Row
            label="Quotation"
            value={invoice.quotation?.quotation_no ?? invoice.quotation_id}
          />
          <Row label="Type" value={invoice.invoice_type} />
          <Row
            label="Gross Amount"
            value={`${invoice.currency} ${invoice.gross_amount}`}
          />
          <Row
            label="Total Amount"
            value={`${invoice.currency} ${invoice.total_amount}`}
          />
          <Row
            label="Paid Amount"
            value={`${invoice.currency} ${invoice.paid_amount}`}
          />
          <Row
            label="Balance"
            value={`${invoice.currency} ${invoice.balance_amount}`}
          />
          <Row label="Due Date" value={invoice.due_date} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(invoice.items ?? []).map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <Row label="Item" value={item.item_name} />
              <Row label="Description" value={item.description} />
              <Row label="Qty" value={item.quantity} />
              <Row label="Amount" value={item.total_amount} />
            </div>
          ))}
          {(invoice.items ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No invoice items.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Invoice"
        description="This will soft-delete the invoice."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(invoice.id, {
            onSuccess: () => navigate('/billing/invoices'),
          })
        }
      />
    </div>
  );
}
