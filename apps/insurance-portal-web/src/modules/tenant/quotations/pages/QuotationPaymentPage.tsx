import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { financeApi } from '@/modules/tenant/finance/api';
import {
  FinanceStatusBadge,
  createIdempotencyKey,
  formatMoney,
  partyName,
} from '@/modules/tenant/finance/components';
import {
  useQuotationDetail,
  useQuotationWorkflow,
  useRequestQuotationPayment,
} from '../hooks';

type PaymentMethodCode =
  | 'BANK_TRANSFER'
  | 'EFT'
  | 'MOBILE_MONEY'
  | 'CARD'
  | 'CASH'
  | 'CHEQUE';

export function QuotationPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: quotation, isLoading: loadingQuotation } =
    useQuotationDetail(id);
  const { data: workflow, isLoading: loadingWorkflow } =
    useQuotationWorkflow(id);
  const requestPaymentMutation = useRequestQuotationPayment(id);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodCode>('BANK_TRANSFER');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [payerName, setPayerName] = useState('');

  const invoicesQuery = useQuery({
    queryKey: ['finance', 'quotation-payment', 'invoices', id],
    queryFn: () => financeApi.getInvoices({ limit: 100 }),
    enabled: !!id,
  });

  const invoice = useMemo(() => {
    const items = invoicesQuery.data?.data ?? [];
    return (
      items.find(
        (item) =>
          item.quotation_id === id &&
          !['VOIDED', 'CANCELLED'].includes(String(item.status).toUpperCase()),
      ) ?? null
    );
  }, [id, invoicesQuery.data]);

  const issueMutation = useMutation({
    mutationFn: () =>
      financeApi.issueInvoice(invoice!.id, {
        expected_state_version: invoice?.state_version ?? 1,
        idempotency_key: createIdempotencyKey('quotation-invoice-issue'),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['finance', 'quotation-payment', 'invoices', id],
      });
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error('Invoice not found');

      const paymentAmount = Number(amount || invoice.balance_amount || 0);
      const payment = await financeApi.recordManualPayment({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        payment_method: paymentMethod,
        provider_code: 'MANUAL',
        payment_reference: reference || invoice.invoice_no,
        amount: paymentAmount,
        currency_code: invoice.currency ?? invoice.currency_code ?? 'TZS',
        payer_name: payerName || partyName(invoice.customer),
        idempotency_key: createIdempotencyKey('quotation-manual-payment'),
      });

      await financeApi.postReceipt({
        payment_transaction_id: payment.id,
        invoice_id: invoice.id,
        allocation_amount: paymentAmount,
        idempotency_key: createIdempotencyKey('quotation-receipt-post'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['finance', 'quotation-payment', 'invoices', id],
      });
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'receipts'] });
      queryClient.invalidateQueries({ queryKey: ['quotations', 'detail', id] });
      queryClient.invalidateQueries({
        queryKey: ['quotations', 'workflow', id],
      });
      setAmount('');
      setReference('');
    },
  });

  if (loadingQuotation || loadingWorkflow || invoicesQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!quotation) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Quotation not found</p>
        <Button
          variant="link"
          onClick={() => navigate(underwritingPaths.quotations)}
        >
          Back to Quotations
        </Button>
      </div>
    );
  }

  const paymentBlockingReasons = workflow?.blockingReasons ?? [];
  const canRequestPayment =
    workflow?.availableCommands.REQUEST_PAYMENT ?? false;
  const currencyCode =
    quotation?.cover_note_dtl.fleet_hdr?.currency_code ??
    quotation?.cover_note_dtl.currency_code ??
    'TZS';
  const totalPremium =
    Number(
      quotation?.cover_note_dtl.fleet_hdr?.total_premium_including_tax ??
        quotation?.cover_note_dtl.total_premium_including_tax ??
        0,
    ) || 0;
  const isPaid = ['PAID', 'OVERPAID'].includes(
    String(invoice?.status).toUpperCase(),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate(underwritingPaths.quotationDetail(quotation.id))
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Payment" description={quotation.quotation_no} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invoice</CardTitle>
          <FinanceStatusBadge
            status={invoice?.status ?? workflow?.payment.status ?? 'REQUESTED'}
          />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!invoice ? (
            <>
              <p className="text-slate-500">
                No finance invoice exists for this quotation yet. Requesting
                payment will create or reuse the quotation invoice snapshot from
                the authoritative workflow.
              </p>
              <p className="font-medium text-slate-900">
                Required premium: {formatMoney(totalPremium, currencyCode)}
              </p>
              {paymentBlockingReasons.length > 0 && !canRequestPayment ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {paymentBlockingReasons.map((reason) => (
                    <p key={`${reason.code}:${reason.message}`}>
                      {reason.message}
                    </p>
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                onClick={() => requestPaymentMutation.mutate()}
                disabled={
                  requestPaymentMutation.isPending || !canRequestPayment
                }
              >
                {requestPaymentMutation.isPending
                  ? 'Requesting...'
                  : 'Request Payment'}
              </Button>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <p>Invoice No: {invoice.invoice_no}</p>
              <p>Status: {invoice.status}</p>
              <p>
                Total:{' '}
                {formatMoney(
                  invoice.total_amount,
                  invoice.currency ?? invoice.currency_code,
                )}
              </p>
              <p>
                Paid:{' '}
                {formatMoney(
                  invoice.paid_amount,
                  invoice.currency ?? invoice.currency_code,
                )}
              </p>
              <p>
                Balance:{' '}
                {formatMoney(
                  invoice.balance_amount,
                  invoice.currency ?? invoice.currency_code,
                )}
              </p>
              <p>
                Workflow Payment Status: {workflow?.payment.status ?? 'N/A'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {invoice?.status === 'DRAFT' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              Draft quotation invoices do not open the payment gate until they
              are issued.
            </p>
            <Button
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending}
            >
              {issueMutation.isPending ? 'Issuing...' : 'Issue Invoice'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {invoice &&
      !isPaid &&
      ['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record Manual Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              This records a payment transaction, posts the receipt, and
              allocates it through backend finance commands.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-2 block">Payment Method</Label>
                <Input
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value.toUpperCase() as PaymentMethodCode,
                    )
                  }
                />
              </div>
              <div>
                <Label className="mb-2 block">Amount</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={invoice.balance_amount}
                />
              </div>
              <div>
                <Label className="mb-2 block">Reference</Label>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Transaction reference"
                />
              </div>
              <div>
                <Label className="mb-2 block">Payer Name</Label>
                <Input
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder={partyName(invoice.customer)}
                />
              </div>
            </div>
            <Button
              type="button"
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

      {isPaid ? (
        <Card>
          <CardContent className="flex items-center justify-between pt-6 text-sm">
            <p className="text-emerald-700">
              Payment complete. The quotation payment gate can now move forward
              from finance-backed allocations.
            </p>
            <Button
              type="button"
              onClick={() =>
                navigate(underwritingPaths.quotationDetail(quotation.id))
              }
            >
              Back to Quotation
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
