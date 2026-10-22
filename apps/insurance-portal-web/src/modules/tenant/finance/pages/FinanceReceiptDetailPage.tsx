import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import {
  DetailRow,
  FinanceStatusBadge,
  createIdempotencyKey,
  formatDate,
  formatMoney,
} from '../components';

export function FinanceReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['finance', 'receipt', id],
    queryFn: () => financeApi.getReceipt(id!),
    enabled: !!id,
  });

  const reverseMutation = useMutation({
    mutationFn: async () => {
      const reason = window.prompt('Reversal reason');
      if (!reason?.trim()) return null;
      return financeApi.reverseReceipt(id!, {
        reason: reason.trim(),
        idempotency_key: createIdempotencyKey('receipt-reverse'),
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      toast.success('Receipt reversed');
      queryClient.invalidateQueries({ queryKey: ['finance', 'receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'receipts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
      if (query.data?.invoice_id) {
        queryClient.invalidateQueries({
          queryKey: ['finance', 'invoice', query.data.invoice_id],
        });
      }
    },
  });

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  const receipt = query.data;
  if (!receipt) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Receipt not found</p>
        <Button
          variant="link"
          onClick={() => navigate('/apps/finance/receipts')}
        >
          Back to receipts
        </Button>
      </div>
    );
  }

  const currency = receipt.currency ?? receipt.currency_code ?? 'TZS';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/apps/finance/receipts')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={receipt.receipt_no}
          description="Finance receipt detail"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {['POSTED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED'].includes(
          receipt.status,
        ) ? (
          <Button
            variant="outline"
            onClick={() => reverseMutation.mutate()}
            disabled={reverseMutation.isPending}
          >
            Reverse Receipt
          </Button>
        ) : null}
        {receipt.payment_transaction_id ? (
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                `/apps/finance/payments/${receipt.payment_transaction_id}`,
              )
            }
          >
            Open Payment Transaction
          </Button>
        ) : null}
        {receipt.invoice_id ? (
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/apps/finance/invoices/${receipt.invoice_id}`)
            }
          >
            Open Invoice
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="Status"
            value={<FinanceStatusBadge status={receipt.status} />}
          />
          <DetailRow label="Payer" value={receipt.payer_name ?? ' - '} />
          <DetailRow
            label="Payment method"
            value={receipt.payment_method ?? ' - '}
          />
          <DetailRow
            label="Reference"
            value={receipt.payment_reference ?? ' - '}
          />
          <DetailRow
            label="Provider reference"
            value={receipt.provider_reference ?? ' - '}
          />
          <DetailRow
            label="Amount"
            value={formatMoney(receipt.amount, currency)}
          />
          <DetailRow
            label="Allocated"
            value={formatMoney(receipt.allocated_amount, currency)}
          />
          <DetailRow
            label="Unallocated"
            value={formatMoney(receipt.unallocated_amount, currency)}
          />
          <DetailRow label="Posted at" value={formatDate(receipt.posted_at)} />
          <DetailRow
            label="Reversed at"
            value={formatDate(receipt.reversed_at)}
          />
          <DetailRow
            label="Reversal reason"
            value={receipt.reversal_reason ?? ' - '}
          />
        </CardContent>
      </Card>
    </div>
  );
}
