import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { financeApi } from '../api';
import {
  DetailRow,
  FinanceStatusBadge,
  JsonCard,
  createIdempotencyKey,
  formatDate,
  formatMoney,
  partyName,
} from '../components';

export function FinanceInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [payerName, setPayerName] = useState('');

  const invoiceQuery = useQuery({
    queryKey: ['finance', 'invoice', id],
    queryFn: () => financeApi.getInvoice(id!),
    enabled: !!id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'invoice', id] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'receipts'] });
  };

  const issueMutation = useMutation({
    mutationFn: () =>
      financeApi.issueInvoice(id!, {
        expected_state_version: invoiceQuery.data?.state_version ?? 1,
        idempotency_key: createIdempotencyKey('invoice-issue'),
      }),
    onSuccess: () => {
      toast.success('Invoice issued');
      refresh();
    },
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      const reason = window.prompt('Void reason');
      if (!reason?.trim()) return null;
      return financeApi.voidInvoice(id!, {
        reason: reason.trim(),
        idempotency_key: createIdempotencyKey('invoice-void'),
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      toast.success('Invoice voided');
      refresh();
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const invoice = invoiceQuery.data;
      if (!invoice) throw new Error('Invoice not loaded');

      const amount = Number(paymentAmount || invoice.balance_amount || 0);
      const payment = await financeApi.recordManualPayment({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        payment_method: paymentMethod,
        provider_code: 'MANUAL',
        payment_reference: paymentReference || `INV-${invoice.invoice_no}`,
        amount,
        currency_code: invoice.currency ?? invoice.currency_code ?? 'TZS',
        payer_name: payerName || partyName(invoice.customer),
        idempotency_key: createIdempotencyKey('manual-payment'),
      });

      await financeApi.postReceipt({
        payment_transaction_id: payment.id,
        invoice_id: invoice.id,
        allocation_amount: amount,
        idempotency_key: createIdempotencyKey('receipt-post'),
      });

      return payment;
    },
    onSuccess: () => {
      toast.success('Payment transaction, receipt, and allocation posted');
      setPaymentAmount('');
      setPaymentReference('');
      refresh();
    },
  });

  if (invoiceQuery.isLoading) {
    return <Skeleton className="h-[720px] w-full" />;
  }

  const invoice = invoiceQuery.data;
  if (!invoice) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Invoice not found</p>
        <Button variant="link" onClick={() => navigate('/finance/invoices')}>
          Back to invoices
        </Button>
      </div>
    );
  }

  const currency = invoice.currency ?? invoice.currency_code ?? 'TZS';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/finance/invoices')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={invoice.invoice_no}
          description="Finance invoice detail"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Status</p>
              <FinanceStatusBadge status={invoice.status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-xl font-semibold">
              {formatMoney(invoice.total_amount, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Paid</p>
            <p className="text-xl font-semibold">
              {formatMoney(invoice.paid_amount, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Balance</p>
            <p className="text-xl font-semibold">
              {formatMoney(invoice.balance_amount, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {invoice.status === 'DRAFT' ? (
          <Button
            onClick={() => issueMutation.mutate()}
            disabled={issueMutation.isPending}
          >
            {issueMutation.isPending ? 'Issuing...' : 'Issue Invoice'}
          </Button>
        ) : null}
        {['DRAFT', 'ISSUED'].includes(invoice.status) ? (
          <Button
            variant="outline"
            onClick={() => voidMutation.mutate()}
            disabled={voidMutation.isPending}
          >
            Void Invoice
          </Button>
        ) : null}
        {invoice.quotation_id ? (
          <Button variant="outline" asChild>
            <Link
              to={`/underwriting/quotations/${invoice.quotation_id}/payment`}
            >
              Open Quotation Payment
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="Customer" value={partyName(invoice.customer)} />
          <DetailRow
            label="Quotation"
            value={
              invoice.quotation?.quotation_no ?? invoice.quotation_id ?? ' - '
            }
          />
          <DetailRow
            label="Policy"
            value={invoice.policy?.policy_no ?? invoice.policy_id ?? ' - '}
          />
          <DetailRow label="Source" value={invoice.source_type ?? 'MANUAL'} />
          <DetailRow label="Due date" value={invoice.due_date ?? ' - '} />
          <DetailRow label="Issued at" value={formatDate(invoice.issued_at)} />
          <DetailRow label="Voided at" value={formatDate(invoice.voided_at)} />
          <DetailRow
            label="Refunded"
            value={formatMoney(invoice.refunded_amount, currency)}
          />
          <DetailRow
            label="Written off"
            value={formatMoney(invoice.written_off_amount, currency)}
          />
        </CardContent>
      </Card>

      {['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status) ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Record Manual Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              This records a successful payment transaction, posts the receipt,
              and allocates it through finance commands.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="payment-method">Payment method</Label>
                <Input
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value.toUpperCase())
                  }
                />
              </div>
              <div>
                <Label htmlFor="payment-amount">Amount</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder={invoice.balance_amount}
                />
              </div>
              <div>
                <Label htmlFor="payment-reference">Reference</Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="payer-name">Payer name</Label>
                <Input
                  id="payer-name"
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder={partyName(invoice.customer)}
                />
              </div>
            </div>
            <Button
              onClick={() => recordPaymentMutation.mutate()}
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending
                ? 'Posting...'
                : 'Record and Allocate Payment'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invoice Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(invoice.items ?? []).map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <DetailRow
                label="Description"
                value={item.description ?? item.item_name ?? ' - '}
              />
              <DetailRow label="Quantity" value={item.quantity ?? ' - '} />
              <DetailRow
                label="Total"
                value={formatMoney(item.total_amount, currency)}
              />
            </div>
          ))}
          {(invoice.items ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">
              No invoice items available.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {invoice.source_snapshot ? (
        <JsonCard title="Source Snapshot" value={invoice.source_snapshot} />
      ) : null}

      {invoice.void_reason ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Void Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={invoice.void_reason}
              readOnly
              className="min-h-24"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
