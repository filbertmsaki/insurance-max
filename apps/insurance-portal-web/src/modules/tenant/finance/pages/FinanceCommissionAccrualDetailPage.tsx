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
  JsonCard,
  createIdempotencyKey,
  formatDate,
  formatMoney,
} from '../components';

export function FinanceCommissionAccrualDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['finance', 'commission-accrual', id],
    queryFn: () => financeApi.getCommissionAccrual(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      financeApi.approveCommissionAccrual(id!, {
        idempotency_key: createIdempotencyKey('commission-accrual-approve'),
      }),
    onSuccess: () => {
      toast.success('Commission accrual approved');
      queryClient.invalidateQueries({ queryKey: ['finance', 'commission-accrual', id] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'commission-accruals'] });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async () => {
      const reason = window.prompt('Reversal reason');
      if (!reason?.trim()) return null;
      return financeApi.reverseCommissionAccrual(id!, {
        reason: reason.trim(),
        idempotency_key: createIdempotencyKey('commission-accrual-reverse'),
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      toast.success('Commission accrual reversed');
      queryClient.invalidateQueries({ queryKey: ['finance', 'commission-accrual', id] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'commission-accruals'] });
    },
  });

  if (query.isLoading) return <Skeleton className="h-[640px] w-full" />;

  const accrual = query.data;
  if (!accrual) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Commission accrual not found</p>
        <Button variant="link" onClick={() => navigate('/finance/commission-accruals')}>
          Back to commission accruals
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/commission-accruals')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={accrual.accrual_no ?? 'Commission Accrual'} description="Finance commission accrual detail" />
      </div>

      <div className="flex flex-wrap gap-2">
        {accrual.status === 'ACCRUED' ? (
          <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            Approve Accrual
          </Button>
        ) : null}
        {!['REVERSED', 'CANCELLED'].includes(accrual.status) ? (
          <Button variant="outline" onClick={() => reverseMutation.mutate()} disabled={reverseMutation.isPending}>
            Reverse Accrual
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent>
          <DetailRow label="Status" value={<FinanceStatusBadge status={accrual.status} />} />
          <DetailRow label="Commission amount" value={formatMoney(accrual.commission_amount)} />
          <DetailRow label="Paid amount" value={formatMoney(accrual.paid_amount)} />
          <DetailRow label="Balance" value={formatMoney(accrual.balance_amount)} />
          <DetailRow label="Rate" value={accrual.commission_rate ?? ' - '} />
          <DetailRow label="Accrued at" value={formatDate(accrual.accrued_at ?? accrual.earned_at)} />
          <DetailRow label="Approved at" value={formatDate(accrual.approved_at)} />
          <DetailRow label="Reversed at" value={formatDate(accrual.reversed_at)} />
          <DetailRow label="Reversal reason" value={accrual.reversal_reason ?? ' - '} />
        </CardContent>
      </Card>

      {accrual.commission_snapshot ? (
        <JsonCard title="Frozen Commission Snapshot" value={accrual.commission_snapshot} />
      ) : null}
    </div>
  );
}
