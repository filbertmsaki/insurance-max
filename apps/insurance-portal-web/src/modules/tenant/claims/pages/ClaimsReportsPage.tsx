import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileBarChart, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { EmptyState, SectionCard } from '@/components/shared/DetailSections';
import { PageHeader } from '@/components/shared/PageHeader';
import { humanizeCode } from '@/components/shared/detailFormat';
import {
  reportingApi,
  type ReportDefinitionSummary,
  type ReportJobRecord,
} from '@/modules/tenant/reporting/api';
import { ClaimErrorAlert } from '../components/ClaimErrorAlert';
import { CLAIM_STATUSES, CLAIM_STATUS_META } from '../constants';
import { formatClaimDateTime } from '../utils';

const ANY = '__any__';
const reportKeys = {
  definitions: ['reporting', 'reports', 'definitions'] as const,
  jobs: ['reporting', 'reports', 'jobs'] as const,
};

const JOB_TONE: Record<string, 'muted' | 'info' | 'success' | 'danger'> = {
  PENDING: 'muted',
  QUEUED: 'muted',
  RUNNING: 'info',
  PROCESSING: 'info',
  COMPLETED: 'success',
  SUCCEEDED: 'success',
  FAILED: 'danger',
};

const ACTIVE_JOB_STATUSES = ['PENDING', 'QUEUED', 'RUNNING', 'PROCESSING'];

const isClaimsReport = (definition: ReportDefinitionSummary) =>
  definition.category === 'CLAIMS' || definition.code.startsWith('CLAIMS_');

/**
 * The claims reports registered with the reporting engine (generator
 * "claims"). Runs are queued; finished runs are downloaded from the list.
 */
export function ClaimsReportsPage() {
  const queryClient = useQueryClient();
  const definitions = useQuery({
    queryKey: reportKeys.definitions,
    queryFn: reportingApi.getReportDefinitions,
  });
  // Claims runs only: the server filters by report category (CLAIMS or a
  // CLAIMS_ code prefix), so paging and totals cover claim jobs alone.
  const jobs = useServerTable<ReportJobRecord>({
    queryKey: reportKeys.jobs,
    fetcher: (params, signal) => reportingApi.listJobsPage(params, signal),
    defaultSortBy: 'created_at',
    extraParams: { category: 'CLAIMS' },
  });
  const hasActiveJobs = jobs.rows.some((job) =>
    ACTIVE_JOB_STATUSES.includes(job.status),
  );
  const refetchJobs = jobs.query.refetch;
  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => void refetchJobs(), 5_000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, refetchJobs]);

  const reports = (definitions.data ?? []).filter(isClaimsReport);
  const [selectedId, setSelectedId] = useState('');
  const selected =
    reports.find((report) => report.id === selectedId) ?? reports[0] ?? null;
  const [format, setFormat] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [status, setStatus] = useState(ANY);

  const run = useMutation({
    mutationFn: () => {
      if (!selected?.id) throw new Error('Choose a report');
      return reportingApi.runReport({
        definition_id: selected.id,
        format: format || selected.supportedFormats[0],
        parameters: {
          ...(periodStart ? { period_start: periodStart } : {}),
          ...(periodEnd ? { period_end: periodEnd } : {}),
          ...(status !== ANY ? { status } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success(`${selected?.name ?? 'Report'} queued`);
      void queryClient.invalidateQueries({ queryKey: reportKeys.jobs });
    },
  });
  const download = useMutation({
    mutationFn: (artifactId: string) =>
      reportingApi.downloadArtifact(artifactId),
    onSuccess: (result) => {
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.info('The download was approved but no link was returned.');
      }
    },
    onError: () => toast.error('The report could not be downloaded'),
  });

  const nameOf = new Map(reports.map((report) => [report.id, report.name]));

  const jobColumns: Column<ReportJobRecord>[] = [
    {
      key: 'report',
      header: 'Report',
      cell: (job) => (
        <>
          {(job.definition_id && nameOf.get(job.definition_id)) ??
            humanizeCode(job.report_code ?? 'Report')}
          <div className="text-xs text-slate-500">{job.format}</div>
        </>
      ),
    },
    {
      key: 'created_at',
      header: 'Requested',
      sortable: true,
      cell: (job) => formatClaimDateTime(job.created_at),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (job) => (
        <>
          <Badge variant={JOB_TONE[job.status] ?? 'muted'}>
            {humanizeCode(job.status)}
          </Badge>
          {job.safe_error_message ? (
            <div className="mt-1 text-xs text-red-600">
              {job.safe_error_message}
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: 'rows',
      header: 'Rows',
      className: 'text-right tabular-nums',
      cell: (job) => job.row_count ?? '-',
    },
    {
      key: 'download',
      header: '',
      className: 'text-right',
      cell: (job) =>
        job.artifact_id ? (
          <Button
            size="sm"
            variant="outline"
            disabled={download.isPending}
            onClick={() => download.mutate(job.artifact_id!)}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims"
        title="Claims reports"
        description="Registers, outstanding and paid claims, reserves, payments, assessments and TIRA submissions."
      />

      {definitions.isError ? (
        <ClaimErrorAlert
          error={definitions.error}
          title="The reports could not be loaded"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Reports">
          {reports.length === 0 ? (
            <EmptyState
              text={
                definitions.isLoading
                  ? 'Loading reports...'
                  : 'No claims reports are registered.'
              }
            />
          ) : (
            <ul className="space-y-1">
              {reports.map((report) => (
                <li key={report.id ?? report.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(report.id ?? '');
                      setFormat('');
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      selected?.id === report.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <FileBarChart className="h-4 w-4" />
                      {report.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {report.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="xl:col-span-2">
          <SectionCard
            title={selected?.name ?? 'Run a report'}
            description={selected?.description}
          >
            {selected ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="claims-report-from">Reported from</Label>
                    <Input
                      id="claims-report-from"
                      type="date"
                      value={periodStart}
                      onChange={(event) => setPeriodStart(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claims-report-to">Reported to</Label>
                    <Input
                      id="claims-report-to"
                      type="date"
                      value={periodEnd}
                      onChange={(event) => setPeriodEnd(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claims-report-status">Claim status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="claims-report-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>Any status</SelectItem>
                        {CLAIM_STATUSES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {CLAIM_STATUS_META[value].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claims-report-format">Format</Label>
                    <Select
                      value={format || selected.supportedFormats[0]}
                      onValueChange={setFormat}
                    >
                      <SelectTrigger id="claims-report-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selected.supportedFormats.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <ClaimErrorAlert
                  error={run.error}
                  title="The report was not queued"
                />
                <Button onClick={() => run.mutate()} disabled={run.isPending}>
                  <Play className="mr-1.5 h-4 w-4" />
                  {run.isPending ? 'Queuing...' : 'Run report'}
                </Button>
              </div>
            ) : (
              <EmptyState text="Choose a report." />
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Recent runs">
        <DataTable
          {...jobs.tableProps}
          columns={jobColumns}
          searchPlaceholder="Search status or format"
          emptyMessage="No claims reports have been run yet."
          showColumnVisibility={false}
        />
      </SectionCard>
    </div>
  );
}
