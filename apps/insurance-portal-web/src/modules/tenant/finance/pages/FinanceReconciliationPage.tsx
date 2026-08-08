import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceReconciliationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [providerCode, setProviderCode] = useState('BANK');
  const [statementDate, setStatementDate] = useState('');
  const [currencyCode, setCurrencyCode] = useState('TZS');
  const batchesQuery = useQuery({
    queryKey: ['finance', 'reconciliation', 'batches'],
    queryFn: () => financeApi.getReconciliationBatches(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      financeApi.createReconciliationBatch({
        provider_code: providerCode,
        statement_date: statementDate,
        currency_code: currencyCode,
      }),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({
        queryKey: ['finance', 'reconciliation'],
      });
      navigate(`/finance/reconciliation/${batch.id}`);
    },
  });

  if (batchesQuery.isLoading) return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Import, match, approve, and post bank or provider statement batches."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Create Batch</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="provider-code">Provider code</Label>
            <Input
              id="provider-code"
              value={providerCode}
              onChange={(event) =>
                setProviderCode(event.target.value.toUpperCase())
              }
            />
          </div>
          <div>
            <Label htmlFor="statement-date">Statement date</Label>
            <Input
              id="statement-date"
              type="date"
              value={statementDate}
              onChange={(event) => setStatementDate(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="currency-code">Currency</Label>
            <Input
              id="currency-code"
              value={currencyCode}
              onChange={(event) =>
                setCurrencyCode(event.target.value.toUpperCase())
              }
            />
          </div>
          <div className="md:col-span-3">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !statementDate}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Batch'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(batchesQuery.data ?? []).map((batch) => (
          <Card key={batch.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div className="space-y-1">
                <p className="font-medium text-slate-900">{batch.batch_no}</p>
                <p className="text-sm text-slate-500">
                  {batch.provider_code} · {batch.statement_date} ·{' '}
                  {formatMoney(batch.statement_total, batch.currency_code)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <FinanceStatusBadge status={batch.status} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(`/finance/reconciliation/${batch.id}`)
                  }
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
