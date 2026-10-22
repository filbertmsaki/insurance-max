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

export function FinancePaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['finance', 'payment', id],
    queryFn: () => financeApi.getPaymentTransaction(id!),
    enabled: !!id,
  });

  const postReceiptMutation = useMutation({
    mutationFn: async () => {
      const payment = query.data;
      if (!payment) throw new Error('Payment not loaded');

      return financeApi.postReceipt({
        payment_transaction_id: payment.id,
        invoice_id: payment.invoice_id ?? undefined,
        allocation_amount: Number(payment.amount),
        idempotency_key: createIdempotencyKey('receipt-post'),
      });
    },
    onSuccess: (receipt) => {
      toast.success(`Receipt ${receipt.receipt_no} posted`);
      queryClient.invalidateQueries({ queryKey: ['finance', 'payment', id] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'receipts'] });
      if (query.data?.invoice_id) {
        queryClient.invalidateQueries({
          queryKey: ['finance', 'invoice', query.data.invoice_id],
        });
      }
    },
  });

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  const payment = query.data;
  if (!payment) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Payment transaction not found</p>
        <Button
          variant="link"
          onClick={() => navigate('/apps/finance/payments')}
        >
          Back to payments
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
          onClick={() => navigate('/apps/finance/payments')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={payment.transaction_no ?? 'Payment Transaction'}
          description={payment.provider_reference ?? payment.id}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {payment.status === 'SUCCESSFUL' && !payment.receipt_id ? (
          <Button
            onClick={() => postReceiptMutation.mutate()}
            disabled={postReceiptMutation.isPending}
          >
            {postReceiptMutation.isPending ? 'Posting...' : 'Post Receipt'}
          </Button>
        ) : null}
        {payment.receipt_id ? (
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/apps/finance/receipts/${payment.receipt_id}`)
            }
          >
            Open Receipt
          </Button>
        ) : null}
        {payment.invoice_id ? (
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/apps/finance/invoices/${payment.invoice_id}`)
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
            value={<FinanceStatusBadge status={payment.status} />}
          />
          <DetailRow
            label="Provider"
            value={payment.provider_code ?? payment.provider ?? ' - '}
          />
          <DetailRow
            label="Payment method"
            value={payment.payment_method ?? ' - '}
          />
          <DetailRow
            label="Amount"
            value={formatMoney(
              payment.amount,
              payment.currency ?? payment.currency_code,
            )}
          />
          <DetailRow label="Payer" value={payment.payer_name ?? ' - '} />
          <DetailRow
            label="Reference"
            value={
              payment.payment_reference ?? payment.provider_reference ?? ' - '
            }
          />
          <DetailRow
            label="Provider transaction"
            value={payment.provider_transaction_id ?? ' - '}
          />
          <DetailRow
            label="Received at"
            value={formatDate(payment.received_at)}
          />
          <DetailRow
            label="Settled at"
            value={formatDate(payment.settled_at)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
