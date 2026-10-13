import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { financeApi, financeTableApi } from '../api';
import type { FinanceReconciliationBatch } from '../types';
import { FinanceStatusBadge, formatMoney } from '../components';

export function FinanceReconciliationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [providerCode, setProviderCode] = useState('BANK');
  const [statementDate, setStatementDate] = useState('');
  const [currencyCode, setCurrencyCode] = useState('TZS');
  const { tableProps } = useServerTable<FinanceReconciliationBatch>({
    queryKey: ['finance', 'reconciliation', 'batches'],
    fetcher: (params, signal) =>
      financeTableApi.reconciliationBatches(params, signal),
    defaultSortBy: 'created_at',
  });

  const columns: Column<FinanceReconciliationBatch>[] = [
    {
      key: 'batch_no',
      header: 'Batch',
      sortable: true,
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.batch_no}</span>
      ),
    },
    {
      key: 'provider_code',
      header: 'Provider',
      sortable: true,
      cell: (row) => row.provider_code,
    },
    {
      key: 'statement_date',
      header: 'Statement date',
      sortable: true,
      cell: (row) => row.statement_date,
    },
    {
      key: 'statement_total',
      header: 'Statement total',
      sortable: true,
      cell: (row) => formatMoney(row.statement_total, row.currency_code),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <FinanceStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/finance/reconciliation/${row.id}`)}
        >
          Open
        </Button>
      ),
    },
  ];

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

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search batches"
        showColumnVisibility={false}
      />
    </div>
  );
}
