import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, BarChart3, Filter, Sigma } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { phase16Api, type MetricCompareResponse } from '../../phase16/api/phase16';

type MetricFormState = {
  metricCode: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  branchId: string;
  dimensionKey: string;
  dimensionValue: string;
  compareEnabled: boolean;
  comparePeriodStart: string;
  comparePeriodEnd: string;
};

const defaultDates = {
  start: '2026-08-01',
  end: '2026-08-07',
  compareStart: '2026-07-25',
  compareEnd: '2026-07-31',
};

function formatMetricValue(value: string | null, currencyCode?: string | null) {
  if (value === null) {
    return 'No data';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  if (currencyCode) {
    return `${currencyCode} ${numeric.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  }

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

export function AnalyticsMetricsPage() {
  const definitionsQuery = useQuery({
    queryKey: ['phase16', 'metrics', 'definitions'],
    queryFn: phase16Api.getMetricDefinitions,
  });

  const [form, setForm] = useState<MetricFormState>({
    metricCode: '',
    periodType: 'MONTH',
    periodStart: defaultDates.start,
    periodEnd: defaultDates.end,
    branchId: '',
    dimensionKey: '',
    dimensionValue: '',
    compareEnabled: true,
    comparePeriodStart: defaultDates.compareStart,
    comparePeriodEnd: defaultDates.compareEnd,
  });

  const queryMutation = useMutation({
    mutationFn: (payload: Parameters<typeof phase16Api.queryMetric>[0]) =>
      phase16Api.queryMetric(payload),
  });

  const compareMutation = useMutation({
    mutationFn: (payload: Parameters<typeof phase16Api.compareMetric>[0]) =>
      phase16Api.compareMetric(payload),
  });

  const selectedDefinition = useMemo(() => {
    return definitionsQuery.data?.find((item) => item.code === form.metricCode) ?? null;
  }, [definitionsQuery.data, form.metricCode]);

  const latestCompareResult =
    compareMutation.data ??
    (queryMutation.data
      ? ({
          primary: queryMutation.data,
          comparison: null,
          delta: null,
        } as unknown as MetricCompareResponse)
      : null);

  const currentValue =
    latestCompareResult?.primary?.values[
      latestCompareResult.primary.values.length - 1
    ] ?? null;
  const comparisonValue =
    compareMutation.data?.comparison.values[
      compareMutation.data.comparison.values.length - 1
    ] ?? null;

  const isBusy = queryMutation.isPending || compareMutation.isPending;

  function updateField<Key extends keyof MetricFormState>(
    key: Key,
    value: MetricFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleRun() {
    if (!form.metricCode) {
      return;
    }

    const dimensions =
      form.dimensionKey.trim() && form.dimensionValue.trim()
        ? { [form.dimensionKey.trim()]: form.dimensionValue.trim() }
        : undefined;

    const payload = {
      metricCode: form.metricCode,
      periodType: form.periodType,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      branchId: form.branchId.trim() || undefined,
      dimensions,
      valueKind: 'ACTUAL',
    };

    if (form.compareEnabled) {
      compareMutation.mutate({
        ...payload,
        comparePeriodStart: form.comparePeriodStart,
        comparePeriodEnd: form.comparePeriodEnd,
      });
      return;
    }

    queryMutation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 16"
        title="Analytics Metrics"
        description="Use the governed metric catalogue for exploration, comparison, and freshness-aware review."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-blue-600" />
              Metric Explorer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metric-code">Metric</Label>
              <Select
                value={form.metricCode}
                onValueChange={(value) => updateField('metricCode', value)}
              >
                <SelectTrigger id="metric-code">
                  <SelectValue placeholder="Select a metric" />
                </SelectTrigger>
                <SelectContent>
                  {(definitionsQuery.data ?? []).map((metric) => (
                    <SelectItem key={metric.code} value={metric.code}>
                      {metric.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="metric-period-type">Period</Label>
                <Select
                  value={form.periodType}
                  onValueChange={(value) => updateField('periodType', value)}
                >
                  <SelectTrigger id="metric-period-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'DAY',
                      'WEEK',
                      'MONTH',
                      'QUARTER',
                      'YEAR',
                      'ROLLING_30_DAYS',
                      'ROLLING_12_MONTHS',
                    ].map((period) => (
                      <SelectItem key={period} value={period}>
                        {period}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-branch">Branch scope</Label>
                <Input
                  id="metric-branch"
                  placeholder="Optional branch UUID"
                  value={form.branchId}
                  onChange={(event) => updateField('branchId', event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="metric-period-start">Period start</Label>
                <Input
                  id="metric-period-start"
                  type="date"
                  value={form.periodStart}
                  onChange={(event) => updateField('periodStart', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-period-end">Period end</Label>
                <Input
                  id="metric-period-end"
                  type="date"
                  value={form.periodEnd}
                  onChange={(event) => updateField('periodEnd', event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dimension-key">Dimension key</Label>
                <Input
                  id="dimension-key"
                  placeholder="branch_id"
                  value={form.dimensionKey}
                  onChange={(event) => updateField('dimensionKey', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dimension-value">Dimension value</Label>
                <Input
                  id="dimension-value"
                  placeholder="Dimension value"
                  value={form.dimensionValue}
                  onChange={(event) =>
                    updateField('dimensionValue', event.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Compare prior period
                  </p>
                  <p className="text-xs text-slate-500">
                    Keep forecasts separate from actuals and compare periods explicitly.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={form.compareEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    updateField('compareEnabled', !form.compareEnabled)
                  }
                >
                  {form.compareEnabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              {form.compareEnabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="compare-period-start">Compare start</Label>
                    <Input
                      id="compare-period-start"
                      type="date"
                      value={form.comparePeriodStart}
                      onChange={(event) =>
                        updateField('comparePeriodStart', event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compare-period-end">Compare end</Label>
                    <Input
                      id="compare-period-end"
                      type="date"
                      value={form.comparePeriodEnd}
                      onChange={(event) =>
                        updateField('comparePeriodEnd', event.target.value)
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleRun}
              disabled={!form.metricCode || isBusy}
            >
              {isBusy ? 'Running query...' : 'Run metric query'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selectedDefinition ? (
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sigma className="h-4 w-4 text-blue-600" />
                  Metric Contract
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedDefinition.category}</Badge>
                  <Badge variant="outline">{selectedDefinition.valueType}</Badge>
                  <Badge variant="outline">
                    v{selectedDefinition.formulaVersion}
                  </Badge>
                  <Badge variant="outline">
                    {selectedDefinition.aggregationType}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {selectedDefinition.name}
                  </p>
                  <p className="text-sm text-slate-600">
                    {selectedDefinition.description}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Formula</p>
                  <p className="mt-1">{selectedDefinition.formulaDescription}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Supported periods
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {selectedDefinition.supportedPeriods.join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Supported dimensions
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {selectedDefinition.supportedDimensions.length > 0
                        ? selectedDefinition.supportedDimensions.join(', ')
                        : 'None'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert className="border-dashed">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Select a metric</AlertTitle>
              <AlertDescription>
                The explorer builds from the registered metric catalogue, so the same
                metric contract is reused by dashboards and reporting.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Current value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-950">
                  {formatMetricValue(
                    currentValue?.value ?? null,
                    currentValue?.currencyCode,
                  )}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Freshness: {currentValue?.freshness ?? 'Not queried'}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Comparison value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-950">
                  {formatMetricValue(
                    comparisonValue?.value ?? null,
                    comparisonValue?.currencyCode,
                  )}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Forecasts and actuals remain separated by value kind.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Delta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-950">
                  {formatMetricValue(compareMutation.data?.delta ?? null)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Applied filters stay server-scoped for company and branch context.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Metric Values
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Freshness</TableHead>
                    <TableHead>Calculated at</TableHead>
                    <TableHead>Formula</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(latestCompareResult?.primary.values ?? []).map((value) => (
                    <TableRow key={`${value.metricCode}-${value.periodStart}`}>
                      <TableCell>
                        {value.periodStart} to {value.periodEnd}
                      </TableCell>
                      <TableCell>
                        {formatMetricValue(value.value, value.currencyCode)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">{value.freshness}</Badge>
                          {value.freshnessReason && (
                            <p className="text-xs text-slate-500">
                              {value.freshnessReason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{value.calculatedAt}</TableCell>
                      <TableCell>v{value.formulaVersion}</TableCell>
                    </TableRow>
                  ))}
                  {(latestCompareResult?.primary.values ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">
                        Run a metric query to view server-scoped values, freshness,
                        and formula version.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
