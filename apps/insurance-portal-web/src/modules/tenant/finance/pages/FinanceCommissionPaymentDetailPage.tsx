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

export function FinanceCommissionPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['finance', 'commission-payment', id],
    queryFn: () => financeApi.getCommissionPayment(id!),
    enabled: !!id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['finance', 'commission-payment', id],
    });
    queryClient.invalidateQueries({
      queryKey: ['finance', 'commission-payments'],
    });
    queryClient.invalidateQueries({
      queryKey: ['finance', 'commission-accruals'],
    });
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      financeApi.approveCommissionPayment(id!, {
        idempotency_key: createIdempotencyKey('commission-payment-approve'),
      }),
    onSuccess: () => {
      toast.success('Commission payment approved');
      refresh();
    },
  });

  const payMutation = useMutation({
    mutationFn: () =>
      financeApi.payCommissionPayment(id!, {
        idempotency_key: createIdempotencyKey('commission-payment-pay'),
      }),
    onSuccess: () => {
      toast.success('Commission payment marked paid');
      refresh();
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async () => {
      const reason = window.prompt('Reversal reason');
      if (!reason?.trim()) return null;
      return financeApi.reverseCommissionPayment(id!, {
        reason: reason.trim(),
        idempotency_key: createIdempotencyKey('commission-payment-reverse'),
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      toast.success('Commission payment reversed');
      refresh();
    },
  });

  if (query.isLoading) return <Skeleton className="h-[640px] w-full" />;

  const payment = query.data;
  if (!payment) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Commission payment not found</p>
        <Button
          variant="link"
          onClick={() => navigate('/apps/finance/commission-payments')}
        >
          Back to commission payments
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
          onClick={() => navigate('/apps/finance/commission-payments')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={payment.payment_no}
          description="Finance commission payment detail"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {payment.status === 'DRAFT' ? (
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            Approve Payment
          </Button>
        ) : null}
        {payment.status === 'APPROVED' ? (
          <Button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
          >
            Mark Paid
          </Button>
        ) : null}
        {!['REVERSED', 'CANCELLED'].includes(payment.status) ? (
          <Button
            variant="outline"
            onClick={() => reverseMutation.mutate()}
            disabled={reverseMutation.isPending}
          >
            Reverse Payment
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
          <DetailRow label="Payment method" value={payment.payment_method} />
          <DetailRow
            label="Reference"
            value={payment.payment_reference ?? ' - '}
          />
          <DetailRow
            label="Total amount"
            value={formatMoney(payment.total_amount, payment.currency)}
          />
          <DetailRow
            label="Allocated"
            value={formatMoney(payment.allocated_amount, payment.currency)}
          />
          <DetailRow
            label="Unallocated"
            value={formatMoney(payment.unallocated_amount, payment.currency)}
          />
          <DetailRow
            label="Approved at"
            value={formatDate(payment.approved_at)}
          />
          <DetailRow label="Paid at" value={formatDate(payment.paid_at)} />
          <DetailRow
            label="Reversed at"
            value={formatDate(payment.reversed_at)}
          />
          <DetailRow
            label="Reversal reason"
            value={payment.reversal_reason ?? ' - '}
          />
        </CardContent>
      </Card>
    </div>
  );
}
