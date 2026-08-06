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

export function FinanceRefundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['finance', 'refund', id],
    queryFn: () => financeApi.getRefund(id!),
    enabled: !!id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'refund', id] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'refunds'] });
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      financeApi.approveRefund(id!, {
        idempotency_key: createIdempotencyKey('refund-approve'),
      }),
    onSuccess: () => {
      toast.success('Refund approved');
      refresh();
    },
  });

  const payMutation = useMutation({
    mutationFn: () =>
      financeApi.payRefund(id!, {
        idempotency_key: createIdempotencyKey('refund-pay'),
      }),
    onSuccess: () => {
      toast.success('Refund marked paid');
      refresh();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const reason = window.prompt('Cancellation reason');
      if (!reason?.trim()) return null;
      return financeApi.cancelRefund(id!, {
        reason: reason.trim(),
        idempotency_key: createIdempotencyKey('refund-cancel'),
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      toast.success('Refund cancelled');
      refresh();
    },
  });

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;

  const refund = query.data;
  if (!refund) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Refund not found</p>
        <Button variant="link" onClick={() => navigate('/finance/refunds')}>
          Back to refunds
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/refunds')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={refund.refund_no} description="Finance refund detail" />
      </div>

      <div className="flex flex-wrap gap-2">
        {refund.status === 'REQUESTED' ? (
          <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            Approve Refund
          </Button>
        ) : null}
        {refund.status === 'APPROVED' ? (
          <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending}>
            Mark Refund Paid
          </Button>
        ) : null}
        {['REQUESTED', 'APPROVED'].includes(refund.status) ? (
          <Button variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
            Cancel Refund
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent>
          <DetailRow label="Status" value={<FinanceStatusBadge status={refund.status} />} />
          <DetailRow label="Amount" value={formatMoney(refund.amount, refund.currency_code)} />
          <DetailRow label="Reason" value={refund.reason} />
          <DetailRow label="Requested at" value={formatDate(refund.requested_at)} />
          <DetailRow label="Approved at" value={formatDate(refund.approved_at)} />
          <DetailRow label="Paid at" value={formatDate(refund.paid_at)} />
          <DetailRow label="Failure" value={refund.failure_message ?? ' - '} />
        </CardContent>
      </Card>
    </div>
  );
}
