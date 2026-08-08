import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { financeApi } from '../api';
import {
  DetailRow,
  FinanceStatusBadge,
  createIdempotencyKey,
  formatMoney,
} from '../components';

export function FinanceReconciliationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [payload, setPayload] = useState('[]');
  const query = useQuery({
    queryKey: ['finance', 'reconciliation', id],
    queryFn: () => financeApi.getReconciliationBatch(id!),
    enabled: !!id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['finance', 'reconciliation', id],
    });
    queryClient.invalidateQueries({
      queryKey: ['finance', 'reconciliation', 'batches'],
    });
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const items = JSON.parse(payload) as Array<{
        line_number?: number;
        transaction_date: string;
        value_date?: string;
        description?: string;
        external_reference?: string;
        payer_reference?: string;
        amount: number;
        currency_code: string;
      }>;
      return financeApi.importReconciliationBatch(id!, { items });
    },
    onSuccess: () => {
      toast.success('Batch imported');
      refresh();
    },
  });

  const autoMatchMutation = useMutation({
    mutationFn: () => financeApi.autoMatchReconciliationBatch(id!),
    onSuccess: () => {
      toast.success('Auto match complete');
      refresh();
    },
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      financeApi.approveReconciliationBatch(id!, {
        idempotency_key: createIdempotencyKey('reconciliation-approve'),
      }),
    onSuccess: () => {
      toast.success('Batch approved');
      refresh();
    },
  });

  const postMutation = useMutation({
    mutationFn: () =>
      financeApi.postReconciliationBatch(id!, {
        idempotency_key: createIdempotencyKey('reconciliation-post'),
      }),
    onSuccess: () => {
      toast.success('Batch posted');
      refresh();
    },
  });

  if (query.isLoading) return <Skeleton className="h-[720px] w-full" />;

  const batch = query.data;
  if (!batch) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Reconciliation batch not found</p>
        <Button
          variant="link"
          onClick={() => navigate('/finance/reconciliation')}
        >
          Back to reconciliation
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
          onClick={() => navigate('/finance/reconciliation')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={batch.batch_no}
          description="Reconciliation batch detail"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => autoMatchMutation.mutate()}
          disabled={autoMatchMutation.isPending}
        >
          Auto Match
        </Button>
        <Button
          variant="outline"
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
        >
          Approve Batch
        </Button>
        <Button
          onClick={() => postMutation.mutate()}
          disabled={postMutation.isPending}
        >
          Post Batch
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Batch Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="Status"
            value={<FinanceStatusBadge status={batch.status} />}
          />
          <DetailRow
            label="Statement total"
            value={formatMoney(batch.statement_total, batch.currency_code)}
          />
          <DetailRow
            label="Matched total"
            value={formatMoney(batch.matched_total, batch.currency_code)}
          />
          <DetailRow
            label="Unmatched total"
            value={formatMoney(batch.unmatched_total, batch.currency_code)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Import Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Paste a JSON array of normalized statement lines to import this
            batch.
          </p>
          <Textarea
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            className="min-h-48 font-mono text-xs"
          />
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? 'Importing...' : 'Import Lines'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(batch.items ?? []).map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    Line {item.line_number}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.description ??
                      item.external_reference ??
                      'No description'}
                  </p>
                </div>
                <FinanceStatusBadge status={item.status} />
              </div>
              <DetailRow
                label="Amount"
                value={formatMoney(item.amount, item.currency_code)}
              />
              <DetailRow
                label="Match score"
                value={item.match_score ?? ' - '}
              />
              <DetailRow
                label="Match reason"
                value={item.match_reason ?? ' - '}
              />
            </div>
          ))}
          {(batch.items ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">
              No statement items imported yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
