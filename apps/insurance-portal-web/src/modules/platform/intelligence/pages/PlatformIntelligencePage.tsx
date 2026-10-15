import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BarChart3, RefreshCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { TrendBarChart } from '@/components/shared/charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, useServerTable, type Column } from '@/components/data-table';
import { formatNumber } from '@/modules/shared/formatting/number-format';

import {
  platformIntelligenceApi,
  type AnomalyFinding,
  type BenchmarkSnapshot,
  type CompanyHealthRow,
  type ForecastRun,
} from '../api';

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function asNumber(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function severityVariant(severity?: string | null) {
  const normalized = severity?.toUpperCase();
  if (['CRITICAL', 'HIGH'].includes(normalized ?? '')) return 'danger' as const;
  if (['MEDIUM', 'WARNING'].includes(normalized ?? '')) return 'warning' as const;
  if (['LOW', 'INFO'].includes(normalized ?? '')) return 'info' as const;
  return 'muted' as const;
}

function statusVariant(status?: string | null) {
  const normalized = status?.toUpperCase();
  if (['PUBLISHED', 'COMPLETED', 'CLOSED', 'RESOLVED', 'SUCCEEDED'].includes(normalized ?? '')) {
    return 'success' as const;
  }
  if (['OPEN', 'FAILED', 'ERROR'].includes(normalized ?? '')) {
    return 'danger' as const;
  }
  if (['RUNNING', 'PENDING', 'QUEUED'].includes(normalized ?? '')) {
    return 'warning' as const;
  }
  return 'muted' as const;
}

export function PlatformIntelligencePage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    metricCode: '',
    cohortKey: '',
    from: '',
    to: '',
    companyId: '',
    branchId: '',
    forecastStatus: '',
  });

  const healthQuery = useQuery({
    queryKey: ['platform', 'intelligence', 'company-health'],
    // Summary cards only; the table below pages through every company.
    queryFn: () => platformIntelligenceApi.companyHealth({ limit: 500 }),
  });
  const benchmarksQuery = useQuery({
    queryKey: [
      'platform',
      'intelligence',
      'benchmarks',
      filters.metricCode,
      filters.cohortKey,
      filters.from,
      filters.to,
    ],
    queryFn: () =>
      platformIntelligenceApi.benchmarks({
        // The trend chart only plots the latest 12 snapshots.
        limit: 12,
        metricCode: filters.metricCode,
        cohortKey: filters.cohortKey,
        from: filters.from,
        to: filters.to,
      }),
  });
  const healthTable = useServerTable<CompanyHealthRow>({
    queryKey: ['platform', 'intelligence', 'company-health'],
    fetcher: (params, signal) =>
      platformIntelligenceApi.page<CompanyHealthRow>('company-health', params, signal),
  });
  const benchmarksTable = useServerTable<BenchmarkSnapshot>({
    queryKey: ['platform', 'intelligence', 'benchmarks'],
    fetcher: (params, signal) =>
      platformIntelligenceApi.page<BenchmarkSnapshot>('benchmarks', params, signal),
    extraParams: {
      metricCode: filters.metricCode,
      cohortKey: filters.cohortKey,
      from: filters.from,
      to: filters.to,
    },
  });
  const anomaliesTable = useServerTable<AnomalyFinding>({
    queryKey: ['platform', 'intelligence', 'anomalies'],
    fetcher: (params, signal) =>
      platformIntelligenceApi.page<AnomalyFinding>('anomalies', params, signal),
    extraParams: {
      companyId: filters.companyId,
      branchId: filters.branchId,
      from: filters.from,
      to: filters.to,
    },
  });
  const forecastsTable = useServerTable<ForecastRun>({
    queryKey: ['platform', 'intelligence', 'forecasts'],
    fetcher: (params, signal) =>
      platformIntelligenceApi.page<ForecastRun>('forecasts', params, signal),
    extraParams: {
      companyId: filters.companyId,
      branchId: filters.branchId,
      status: filters.forecastStatus,
    },
  });

  const rebuildMutation = useMutation({
    mutationFn: platformIntelligenceApi.rebuildBenchmarks,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['platform', 'intelligence'],
      });
      toast.success('Benchmark rebuild started');
    },
    onError: () => toast.error('Benchmark rebuild failed'),
  });

  const healthRows = useMemo(() => healthQuery.data ?? [], [healthQuery.data]);
  const benchmarkRows = useMemo(
    () => benchmarksQuery.data ?? [],
    [benchmarksQuery.data],
  );

  const summary = useMemo(
    () => ({
      companies: Math.max(healthTable.total, healthRows.length),
      openAnomalies: healthRows.reduce(
        (sum, row) => sum + asNumber(row.openAnomalies),
        0,
      ),
      scorecards: healthRows.reduce(
        (sum, row) => sum + asNumber(row.publishedScorecards),
        0,
      ),
      forecastRuns: healthRows.reduce(
        (sum, row) => sum + asNumber(row.forecastRuns),
        0,
      ),
    }),
    [healthRows, healthTable.total],
  );

  const benchmarkChart = useMemo(
    () =>
      benchmarkRows.slice(0, 12).reverse().map((row) => ({
        label: `${formatDate(row.period_start)} ${row.metric_code}`,
        value: asNumber(row.average_value),
        secondary: asNumber(row.sample_size),
      })),
    [benchmarkRows],
  );

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function reload() {
    void queryClient.invalidateQueries({
      queryKey: ['platform', 'intelligence'],
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Platform Intelligence"
        description="Review company health, cross-tenant benchmarks, anomaly findings, and forecast execution from platform-governed analytics."
        action={
          <>
            <Button variant="outline" onClick={reload}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => rebuildMutation.mutate()}
              disabled={rebuildMutation.isPending}
            >
              <Activity className="h-4 w-4" />
              Rebuild Benchmarks
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Companies" value={summary.companies} />
        <MetricCard label="Open anomalies" value={summary.openAnomalies} />
        <MetricCard label="Published scorecards" value={summary.scorecards} />
        <MetricCard label="Forecast runs" value={summary.forecastRuns} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-blue-600" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Metric code"
              value={filters.metricCode}
              onChange={(value) => updateFilter('metricCode', value)}
            />
            <FilterInput
              label="Cohort key"
              value={filters.cohortKey}
              onChange={(value) => updateFilter('cohortKey', value)}
            />
            <FilterInput
              label="Company ID"
              value={filters.companyId}
              onChange={(value) => updateFilter('companyId', value)}
            />
            <FilterInput
              label="Branch ID"
              value={filters.branchId}
              onChange={(value) => updateFilter('branchId', value)}
            />
            <FilterInput
              label="From"
              type="date"
              value={filters.from}
              onChange={(value) => updateFilter('from', value)}
            />
            <FilterInput
              label="To"
              type="date"
              value={filters.to}
              onChange={(value) => updateFilter('to', value)}
            />
            <FilterInput
              label="Forecast status"
              value={filters.forecastStatus}
              onChange={(value) => updateFilter('forecastStatus', value)}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="health">Company Health</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <TableCard title="Company Health">
            <DataTable
              {...healthTable.tableProps}
              searchPlaceholder="Search company name or code"
              columns={HEALTH_COLUMNS}
              rowKey={(row) => row.id}
              showColumnVisibility={false}
            />
          </TableCard>
        </TabsContent>

        <TabsContent value="benchmarks">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Benchmark Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {benchmarkChart.length > 0 ? (
                  <TrendBarChart
                    data={benchmarkChart}
                    valueLabel="Average"
                    secondaryLabel="Sample"
                  />
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No benchmark snapshots found
                  </div>
                )}
              </CardContent>
            </Card>
            <TableCard title="Benchmarks">
              <DataTable
                {...benchmarksTable.tableProps}
                onSearchChange={undefined}
                columns={BENCHMARK_COLUMNS}
                rowKey={(row) => row.id}
                showColumnVisibility={false}
              />
            </TableCard>
          </div>
        </TabsContent>

        <TabsContent value="anomalies">
          <TableCard title="Anomalies">
            <DataTable
              {...anomaliesTable.tableProps}
              onSearchChange={undefined}
              columns={ANOMALY_COLUMNS}
              rowKey={(row) => row.id}
              showColumnVisibility={false}
            />
          </TableCard>
        </TabsContent>

        <TabsContent value="forecasts">
          <TableCard title="Forecast Runs">
            <DataTable
              {...forecastsTable.tableProps}
              onSearchChange={undefined}
              columns={FORECAST_COLUMNS}
              rowKey={(row) => row.id}
              showColumnVisibility={false}
            />
          </TableCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-800">{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TableCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const HEALTH_COLUMNS: Column<CompanyHealthRow>[] = [
  { key: 'name', header: 'Company', className: 'font-medium', cell: (row) => row.name },
  { key: 'code', header: 'Code', cell: (row) => row.companyCode ?? 'N/A' },
  { key: 'scorecards', header: 'Scorecards', cell: (row) => formatNumber(row.publishedScorecards, 0) },
  { key: 'anomalies', header: 'Open Anomalies', cell: (row) => formatNumber(row.openAnomalies, 0) },
  { key: 'forecasts', header: 'Forecasts', cell: (row) => formatNumber(row.forecastRuns, 0) },
];

const BENCHMARK_COLUMNS: Column<BenchmarkSnapshot>[] = [
  { key: 'metric', header: 'Metric', className: 'font-medium', cell: (row) => row.metric_code },
  { key: 'cohort', header: 'Cohort', cell: (row) => row.cohort_key },
  {
    key: 'period',
    header: 'Period',
    cell: (row) => `${formatDate(row.period_start)} - ${formatDate(row.period_end)}`,
  },
  { key: 'average', header: 'Average', cell: (row) => formatNumber(row.average_value, 2) },
  { key: 'median', header: 'Median', cell: (row) => formatNumber(row.median_value, 2) },
  { key: 'p90', header: 'P90', cell: (row) => formatNumber(row.percentile_90, 2) },
  { key: 'sample', header: 'Sample', cell: (row) => formatNumber(row.sample_size, 0) },
];

const ANOMALY_COLUMNS: Column<AnomalyFinding>[] = [
  { key: 'metric', header: 'Metric', className: 'font-medium', cell: (row) => row.metric_code },
  { key: 'company', header: 'Company', cell: (row) => row.companyName ?? row.company_id },
  { key: 'date', header: 'Date', cell: (row) => formatDate(row.metric_date) },
  {
    key: 'severity',
    header: 'Severity',
    cell: (row) => <Badge variant={severityVariant(row.severity)}>{row.severity}</Badge>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
  },
  { key: 'observed', header: 'Observed', cell: (row) => formatNumber(row.observed_value, 2) },
  { key: 'expected', header: 'Expected', cell: (row) => formatNumber(row.expected_value, 2) },
];

const FORECAST_COLUMNS: Column<ForecastRun>[] = [
  {
    key: 'definition',
    header: 'Definition',
    className: 'font-medium',
    cell: (row) => row.definitionName ?? row.id,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
  },
  {
    key: 'horizon',
    header: 'Horizon',
    cell: (row) => `${formatDate(row.horizon_start)} - ${formatDate(row.horizon_end)}`,
  },
  { key: 'company', header: 'Company', cell: (row) => row.company_id ?? 'N/A' },
  { key: 'branch', header: 'Branch', cell: (row) => row.branch_id ?? 'N/A' },
  { key: 'created', header: 'Created', cell: (row) => formatDate(row.created_at) },
];
