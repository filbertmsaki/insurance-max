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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
    queryFn: () => platformIntelligenceApi.companyHealth({ limit: 100 }),
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
        limit: 100,
        metricCode: filters.metricCode,
        cohortKey: filters.cohortKey,
        from: filters.from,
        to: filters.to,
      }),
  });
  const anomaliesQuery = useQuery({
    queryKey: [
      'platform',
      'intelligence',
      'anomalies',
      filters.companyId,
      filters.branchId,
      filters.from,
      filters.to,
    ],
    queryFn: () =>
      platformIntelligenceApi.anomalies({
        limit: 100,
        companyId: filters.companyId,
        branchId: filters.branchId,
        from: filters.from,
        to: filters.to,
      }),
  });
  const forecastsQuery = useQuery({
    queryKey: [
      'platform',
      'intelligence',
      'forecasts',
      filters.companyId,
      filters.branchId,
      filters.forecastStatus,
    ],
    queryFn: () =>
      platformIntelligenceApi.forecasts({
        limit: 100,
        companyId: filters.companyId,
        branchId: filters.branchId,
        status: filters.forecastStatus,
      }),
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

  const healthRows = healthQuery.data ?? [];
  const benchmarkRows = benchmarksQuery.data ?? [];
  const anomalyRows = anomaliesQuery.data ?? [];
  const forecastRows = forecastsQuery.data ?? [];

  const summary = useMemo(
    () => ({
      companies: healthRows.length,
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
    [healthRows],
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Scorecards</TableHead>
                  <TableHead>Open Anomalies</TableHead>
                  <TableHead>Forecasts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthRows.map((row) => (
                  <HealthRow key={row.id} row={row} />
                ))}
                {healthRows.length === 0 && <EmptyRow colSpan={5} />}
              </TableBody>
            </Table>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Median</TableHead>
                    <TableHead>P90</TableHead>
                    <TableHead>Sample</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {benchmarkRows.map((row) => (
                    <BenchmarkRow key={row.id} row={row} />
                  ))}
                  {benchmarkRows.length === 0 && <EmptyRow colSpan={7} />}
                </TableBody>
              </Table>
            </TableCard>
          </div>
        </TabsContent>

        <TabsContent value="anomalies">
          <TableCard title="Anomalies">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observed</TableHead>
                  <TableHead>Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalyRows.map((row) => (
                  <AnomalyRow key={row.id} row={row} />
                ))}
                {anomalyRows.length === 0 && <EmptyRow colSpan={7} />}
              </TableBody>
            </Table>
          </TableCard>
        </TabsContent>

        <TabsContent value="forecasts">
          <TableCard title="Forecast Runs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Definition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Horizon</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastRows.map((row) => (
                  <ForecastRow key={row.id} row={row} />
                ))}
                {forecastRows.length === 0 && <EmptyRow colSpan={6} />}
              </TableBody>
            </Table>
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

function HealthRow({ row }: { row: CompanyHealthRow }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell>{row.companyCode ?? 'N/A'}</TableCell>
      <TableCell>{formatNumber(row.publishedScorecards, 0)}</TableCell>
      <TableCell>{formatNumber(row.openAnomalies, 0)}</TableCell>
      <TableCell>{formatNumber(row.forecastRuns, 0)}</TableCell>
    </TableRow>
  );
}

function BenchmarkRow({ row }: { row: BenchmarkSnapshot }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{row.metric_code}</TableCell>
      <TableCell>{row.cohort_key}</TableCell>
      <TableCell>
        {formatDate(row.period_start)} - {formatDate(row.period_end)}
      </TableCell>
      <TableCell>{formatNumber(row.average_value, 2)}</TableCell>
      <TableCell>{formatNumber(row.median_value, 2)}</TableCell>
      <TableCell>{formatNumber(row.percentile_90, 2)}</TableCell>
      <TableCell>{formatNumber(row.sample_size, 0)}</TableCell>
    </TableRow>
  );
}

function AnomalyRow({ row }: { row: AnomalyFinding }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{row.metric_code}</TableCell>
      <TableCell>{row.companyName ?? row.company_id}</TableCell>
      <TableCell>{formatDate(row.metric_date)}</TableCell>
      <TableCell>
        <Badge variant={severityVariant(row.severity)}>{row.severity}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
      </TableCell>
      <TableCell>{formatNumber(row.observed_value, 2)}</TableCell>
      <TableCell>{formatNumber(row.expected_value, 2)}</TableCell>
    </TableRow>
  );
}

function ForecastRow({ row }: { row: ForecastRun }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {row.definitionName ?? row.id}
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
      </TableCell>
      <TableCell>
        {formatDate(row.horizon_start)} - {formatDate(row.horizon_end)}
      </TableCell>
      <TableCell>{row.company_id ?? 'N/A'}</TableCell>
      <TableCell>{row.branch_id ?? 'N/A'}</TableCell>
      <TableCell>{formatDate(row.created_at)}</TableCell>
    </TableRow>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-slate-500">
        No records found
      </TableCell>
    </TableRow>
  );
}
