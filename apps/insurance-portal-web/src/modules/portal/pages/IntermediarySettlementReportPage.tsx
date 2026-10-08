import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api-error';
import { portalApi } from '../api';

export function IntermediarySettlementReportPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const reportQuery = useQuery({
    queryKey: ['portal', 'intermediary', 'settlement-report', fromDate, toDate],
    queryFn: () =>
      portalApi.getIntermediarySettlementReport({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }),
  });

  if (reportQuery.isError) {
    return (
      <ErrorState
        description={getApiErrorMessage(reportQuery.error)}
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }

  const report = reportQuery.data;
  const money = (value: string | number) =>
    Number(value ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intermediary Portal"
        title="Commission settlement report"
        description="Review earned, paid, and outstanding commission by insurer, bank branch, and sales point."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report period</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="settlement-from">From</Label>
            <Input
              id="settlement-from"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settlement-to">To</Label>
            <Input
              id="settlement-to"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
          >
            Clear dates
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          title="Transactions"
          value={report?.totals.transaction_count ?? 0}
        />
        <Metric
          title="Commission"
          value={money(report?.totals.commission_amount ?? 0)}
        />
        <Metric title="Paid" value={money(report?.totals.paid_amount ?? 0)} />
        <Metric
          title="Outstanding"
          value={money(report?.totals.balance_amount ?? 0)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            By distribution location and status
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insurer</TableHead>
                <TableHead>Bank branch</TableHead>
                <TableHead>Sales point</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.groups ?? []).map((group, index) => (
                <TableRow
                  key={`${group.insurer_company_id}-${group.branch_id}-${group.sale_point_id}-${group.status}-${index}`}
                >
                  <TableCell>
                    {group.insurer_name ?? group.insurer_company_id}
                  </TableCell>
                  <TableCell>{group.branch_name}</TableCell>
                  <TableCell>
                    {group.sale_point_name}
                    {group.sale_point_code ? ` (${group.sale_point_code})` : ''}
                  </TableCell>
                  <TableCell>{group.status}</TableCell>
                  <TableCell className="text-right">
                    {group.transaction_count}
                  </TableCell>
                  <TableCell className="text-right">
                    {money(group.commission_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {money(group.paid_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {money(group.balance_amount)}
                  </TableCell>
                </TableRow>
              ))}
              {!reportQuery.isLoading && !report?.groups.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No commission transactions found for this period.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
