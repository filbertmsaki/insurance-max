import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { billingApi } from '@/modules/tenant/billing/api';
import type { InvoiceRecord } from '@/modules/tenant/billing/types';
import { getApiErrorMessage } from '@/lib/api-error';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { useQuotationDetail } from '../hooks';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';

const PAYMENT_METHODS = [
  'Cash',
  'Cheque',
  'EFT',
  'Bank Transfer',
  'Mobile Money',
];

export function QuotationPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading: loadingQuotation } = useQuotationDetail(id);

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const currencyCode =
    quotation?.cover_note_dtl.fleet_hdr?.currency_code ??
    quotation?.cover_note_dtl.currency_code ??
    'TZS';
  const basicPremium =
    Number(
      quotation?.cover_note_dtl.fleet_hdr?.total_premium_excluding_tax ??
        quotation?.cover_note_dtl.total_premium_excluding_tax ??
        0,
    ) || 0;
  const totalPremium =
    Number(
      quotation?.cover_note_dtl.fleet_hdr?.total_premium_including_tax ??
        quotation?.cover_note_dtl.total_premium_including_tax ??
        0,
    ) || 0;
  const taxAmount = Math.max(0, totalPremium - basicPremium);
  const customerReference = quotation?.customer_id ?? '';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await billingApi.getInvoices({ limit: API_MAX_LIST_LIMIT });
        const existing = page.data.find((item) => item.quotation_id === id) ?? null;
        if (!cancelled) {
          setInvoice(existing);
          if (existing) setAmount(existing.balance_amount);
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      } finally {
        if (!cancelled) setLoadingInvoice(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function generateInvoice() {
    if (!quotation) return;
    if (!customerReference) {
      toast.error('Quotation customer is missing. Please reload the quotation or create it again.');
      return;
    }
    setGenerating(true);
    try {
      const created = await billingApi.createInvoice({
        insurer_company_id: quotation.internal_quotation.insurer_company_id,
        customer_id: customerReference,
        quotation_id: quotation.id,
        invoice_type: 'POLICY',
        currency: currencyCode,
        gross_amount: basicPremium,
        discount_amount: 0,
        tax_amount: taxAmount,
        charges_amount: 0,
        total_amount: totalPremium,
        paid_amount: 0,
        balance_amount: totalPremium,
        status: 'ISSUED',
      });
      setInvoice(created);
      setAmount(created.balance_amount);
      toast.success(`Invoice ${created.invoice_no} generated`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function recordPayment() {
    if (!invoice) return;
    const paidNow = Number(amount);
    if (!Number.isFinite(paidNow) || paidNow <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    setRecording(true);
    try {
      const receipt = await billingApi.createReceipt({
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        payment_method: paymentMethod,
        amount: paidNow,
        currency: invoice.currency,
        payment_reference: reference || null,
        status: 'RECEIVED',
      });
      await billingApi.createPaymentTransaction({
        invoice_id: invoice.id,
        receipt_id: receipt.id,
        provider: paymentMethod,
        provider_reference: reference || receipt.receipt_no,
        internal_reference: receipt.receipt_no,
        amount: paidNow,
        currency: invoice.currency,
        status: 'SUCCESS',
      });

      const newPaid = (Number(invoice.paid_amount) || 0) + paidNow;
      const totalAmount = Number(invoice.total_amount) || 0;
      const newBalance = Math.max(0, totalAmount - newPaid);
      const updated = await billingApi.updateInvoice(invoice.id, {
        paid_amount: newPaid,
        balance_amount: newBalance,
        status: newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      });
      setInvoice(updated);
      setAmount(updated.balance_amount);
      setReference('');
      toast.success('Payment recorded');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setRecording(false);
    }
  }

  if (loadingQuotation || loadingInvoice) {
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

  const isPaid = invoice?.status === 'PAID';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(underwritingPaths.quotationDetail(quotation.id))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Payment" description={quotation.quotation_no} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invoice</CardTitle>
          <PaymentStatusBadge status={invoice?.status} />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!invoice ? (
            <>
              <p className="text-slate-500">
                No invoice has been generated for this quotation yet. Generating one uses the authoritative quotation premium totals: {totalPremium} {currencyCode}.
              </p>
              <Button type="button" onClick={generateInvoice} disabled={generating}>
                {generating ? 'Generating...' : 'Generate Invoice'}
              </Button>
            </>
          ) : (
            <div className="grid gap-1 md:grid-cols-2">
              <p>Invoice No: {invoice.invoice_no}</p>
              <p>Currency: {invoice.currency}</p>
              <p>Total: {invoice.total_amount}</p>
              <p>Paid: {invoice.paid_amount}</p>
              <p className="font-medium text-slate-900">Balance: {invoice.balance_amount}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {invoice && !isPaid && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              Record money already received outside the system. This remains a manual billing flow.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-2 block">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Amount</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-2 block">Reference (optional)</Label>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Transaction or receipt reference"
                />
              </div>
            </div>
            <Button type="button" onClick={recordPayment} disabled={recording}>
              {recording ? 'Recording...' : 'Record Payment'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isPaid && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6 text-sm">
            <p className="text-emerald-700">
              Payment complete. This quotation can now proceed to TIRAMIS submission from the quotation detail page.
            </p>
            <Button
              type="button"
              onClick={() => navigate(underwritingPaths.quotationDetail(quotation.id))}
            >
              Back to Quotation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
