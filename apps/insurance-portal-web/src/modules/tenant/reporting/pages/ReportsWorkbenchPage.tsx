import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileSpreadsheet,
  MailCheck,
  Play,
  TimerReset,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  reportingApi,
  type ReportDefinitionSummary,
  type ReportParameterDefinition,
} from '../api';

type ParameterState = Record<string, unknown>;

const scheduleSteps = [
  '1. Select registered report',
  '2. Configure parameters',
  '3. Select output format',
  '4. Set schedule and timezone',
  '5. Select recipients',
  '6. Select retention',
  '7. Review and activate',
];

function defaultParameterValue(definition: ReportParameterDefinition): unknown {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }

  if (definition.dataType === 'BOOLEAN') {
    return false;
  }

  if (definition.dataType === 'UUID_ARRAY') {
    return '';
  }

  if (definition.dataType === 'DATE_RANGE') {
    return { from: '', to: '' };
  }

  return '';
}

function createParameterState(definition: ReportDefinitionSummary | null) {
  const nextState: ParameterState = {};

  for (const parameter of definition?.parameters ?? []) {
    nextState[parameter.key] = defaultParameterValue(parameter);
  }

  return nextState;
}

function normalizeParameters(
  definition: ReportDefinitionSummary | null,
  state: ParameterState,
) {
  const payload: Record<string, unknown> = {};

  for (const parameter of definition?.parameters ?? []) {
    const rawValue = state[parameter.key];

    if (
      rawValue === '' ||
      rawValue === null ||
      rawValue === undefined ||
      (typeof rawValue === 'object' &&
        rawValue !== null &&
        'from' in rawValue &&
        'to' in rawValue &&
        !rawValue.from &&
        !rawValue.to)
    ) {
      continue;
    }

    switch (parameter.dataType) {
      case 'NUMBER':
        payload[parameter.key] = Number(rawValue);
        break;
      case 'BOOLEAN':
        payload[parameter.key] = Boolean(rawValue);
        break;
      case 'UUID_ARRAY':
        payload[parameter.key] = String(rawValue)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        break;
      case 'DATE_RANGE':
        payload[parameter.key] = rawValue;
        break;
      default:
        payload[parameter.key] = rawValue;
        break;
    }
  }

  return payload;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

type ParameterEditorProps = {
  definition: ReportDefinitionSummary | null;
  state: ParameterState;
  onChange: (key: string, value: unknown) => void;
};

function ParameterEditor({
  definition,
  state,
  onChange,
}: ParameterEditorProps) {
  if (!definition || definition.parameters.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        This report does not require additional parameters.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {definition.parameters.map((parameter) => {
        const value = state[parameter.key];

        if (parameter.dataType === 'BOOLEAN') {
          return (
            <div
              key={parameter.key}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <div className="space-y-1">
                <Label htmlFor={parameter.key}>{parameter.label}</Label>
                <p className="text-xs text-slate-500">{parameter.key}</p>
              </div>
              <Checkbox
                id={parameter.key}
                checked={Boolean(value)}
                onCheckedChange={(checked) =>
                  onChange(parameter.key, Boolean(checked))
                }
              />
            </div>
          );
        }

        if (parameter.dataType === 'ENUM') {
          return (
            <div key={parameter.key} className="space-y-2">
              <Label htmlFor={parameter.key}>{parameter.label}</Label>
              <Select
                value={String(value ?? '')}
                onValueChange={(selected) => onChange(parameter.key, selected)}
              >
                <SelectTrigger id={parameter.key}>
                  <SelectValue placeholder={`Select ${parameter.label}`} />
                </SelectTrigger>
                <SelectContent>
                  {(parameter.allowedValues ?? []).map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (parameter.dataType === 'DATE_RANGE') {
          const rangeValue =
            typeof value === 'object' &&
            value !== null &&
            'from' in value &&
            'to' in value
              ? (value as { from: string; to: string })
              : { from: '', to: '' };

          return (
            <div key={parameter.key} className="space-y-2 sm:col-span-2">
              <Label>{parameter.label}</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="date"
                  value={rangeValue.from}
                  onChange={(event) =>
                    onChange(parameter.key, {
                      ...rangeValue,
                      from: event.target.value,
                    })
                  }
                />
                <Input
                  type="date"
                  value={rangeValue.to}
                  onChange={(event) =>
                    onChange(parameter.key, {
                      ...rangeValue,
                      to: event.target.value,
                    })
                  }
                />
              </div>
            </div>
          );
        }

        const inputType =
          parameter.dataType === 'NUMBER'
            ? 'number'
            : parameter.dataType === 'DATE'
              ? 'date'
              : 'text';

        return (
          <div key={parameter.key} className="space-y-2">
            <Label htmlFor={parameter.key}>{parameter.label}</Label>
            <Input
              id={parameter.key}
              type={inputType}
              value={String(value ?? '')}
              min={parameter.minimum}
              max={parameter.maximum}
              placeholder={parameter.key}
              onChange={(event) => onChange(parameter.key, event.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ReportsWorkbenchPage() {
  const queryClient = useQueryClient();
  const definitionsQuery = useQuery({
    queryKey: ['reporting', 'reports', 'definitions'],
    queryFn: reportingApi.getReportDefinitions,
  });
  const jobsQuery = useQuery({
    queryKey: ['reporting', 'reports', 'jobs'],
    queryFn: reportingApi.getReportJobs,
  });
  const schedulesQuery = useQuery({
    queryKey: ['reporting', 'reports', 'schedules'],
    queryFn: reportingApi.getSchedules,
  });

  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [runParameters, setRunParameters] = useState<ParameterState>({});
  const [selectedJobId, setSelectedJobId] = useState('');
  const [scheduleName, setScheduleName] = useState('Monthly management report');
  const [scheduleCron, setScheduleCron] = useState('0 6 1 * *');
  const [scheduleTimezone, setScheduleTimezone] = useState(
    'Africa/Dar_es_Salaam',
  );
  const [scheduleFormat, setScheduleFormat] = useState('');
  const [scheduleRecipients, setScheduleRecipients] = useState('');
  const [scheduleRetentionDays, setScheduleRetentionDays] = useState('90');
  const [scheduleParameters, setScheduleParameters] = useState<ParameterState>(
    {},
  );
  const [mailVerifiedFor, setMailVerifiedFor] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');

  const selectedDefinition = useMemo(() => {
    return (
      definitionsQuery.data?.find(
        (definition) => definition.id === selectedDefinitionId,
      ) ?? null
    );
  }, [definitionsQuery.data, selectedDefinitionId]);

  const jobDetailQuery = useQuery({
    queryKey: ['reporting', 'reports', 'jobs', selectedJobId],
    queryFn: () => reportingApi.getReportJob(selectedJobId),
    enabled: selectedJobId.length > 0,
  });

  useEffect(() => {
    if (!definitionsQuery.data?.length) {
      return;
    }

    if (!selectedDefinitionId) {
      const first = definitionsQuery.data[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDefinitionId(first.id ?? '');
      setScheduleFormat(first.supportedFormats[0] ?? '');
      setRunParameters(createParameterState(first));
      setScheduleParameters(createParameterState(first));
    }
  }, [definitionsQuery.data, selectedDefinitionId]);

  useEffect(() => {
    if (!selectedDefinition) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunParameters(createParameterState(selectedDefinition));
    setScheduleParameters(createParameterState(selectedDefinition));
    setScheduleFormat(
      (current) => current || selectedDefinition.supportedFormats[0] || '',
    );
  }, [selectedDefinition]);

  useEffect(() => {
    if (!selectedJobId && jobsQuery.data?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedJobId(jobsQuery.data[0].id);
    }
  }, [jobsQuery.data, selectedJobId]);

  const runReportMutation = useMutation({
    mutationFn: () => {
      if (!selectedDefinition?.id) {
        throw new Error('Select a report definition first');
      }

      return reportingApi.runReport({
        definition_id: selectedDefinition.id,
        format: scheduleFormat || selectedDefinition.supportedFormats[0],
        parameters: normalizeParameters(selectedDefinition, runParameters),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reporting', 'reports', 'jobs'],
      });
    },
  });

  const verifyMailMutation = useMutation({
    mutationFn: (recipient: string) => reportingApi.testReportMail(recipient),
    onSuccess: (_, recipient) => {
      setMailVerifiedFor(recipient);
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: () => {
      if (!selectedDefinition?.id) {
        throw new Error('Select a report definition first');
      }

      const recipients = scheduleRecipients
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (recipients.length > 0 && mailVerifiedFor !== recipients[0]) {
        throw new Error('Verify SMTP delivery before saving an email schedule');
      }

      return reportingApi.createSchedule({
        definition_id: selectedDefinition.id,
        name: scheduleName,
        cron_expression: scheduleCron,
        timezone: scheduleTimezone,
        format: scheduleFormat || selectedDefinition.supportedFormats[0],
        recipient_emails: recipients,
        parameters: normalizeParameters(selectedDefinition, scheduleParameters),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reporting', 'reports', 'schedules'],
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (artifactId: string) =>
      reportingApi.downloadArtifact(artifactId),
    onSuccess: (result) => {
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      setDownloadMessage(
        result.download_token
          ? `Download token issued: ${result.download_token}`
          : 'Artifact access approved, but no direct URL was returned.',
      );
    },
  });

  const selectedJob = jobDetailQuery.data ?? null;

  function selectDefinition(definitionId: string) {
    setSelectedDefinitionId(definitionId);
    const nextDefinition =
      definitionsQuery.data?.find((item) => item.id === definitionId) ?? null;
    if (nextDefinition) {
      setScheduleFormat(nextDefinition.supportedFormats[0] ?? '');
      setRunParameters(createParameterState(nextDefinition));
      setScheduleParameters(createParameterState(nextDefinition));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Reporting Workbench"
        description="Run registered reports, inspect background jobs, and configure governed schedules from the same catalogue."
      />

      <Tabs defaultValue="registry" className="space-y-4">
        <TabsList>
          <TabsTrigger value="registry">Registry</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  Registered Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Formats</TableHead>
                      <TableHead>Sensitivity</TableHead>
                      <TableHead>Maximum rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(definitionsQuery.data ?? []).map((definition) => (
                      <TableRow
                        key={definition.id ?? definition.code}
                        className={
                          definition.id === selectedDefinitionId
                            ? 'bg-slate-50'
                            : undefined
                        }
                        onClick={() => selectDefinition(definition.id ?? '')}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">
                              {definition.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {definition.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{definition.category}</TableCell>
                        <TableCell>
                          {definition.supportedFormats.join(', ')}
                        </TableCell>
                        <TableCell>{definition.sensitivity}</TableCell>
                        <TableCell>
                          {definition.maximumRows.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Run Selected Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDefinition ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {selectedDefinition.code}
                      </Badge>
                      <Badge variant="outline">
                        v{selectedDefinition.version}
                      </Badge>
                      <Badge variant="outline">
                        {selectedDefinition.permission}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="run-format">Output format</Label>
                      <Select
                        value={scheduleFormat}
                        onValueChange={setScheduleFormat}
                      >
                        <SelectTrigger id="run-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedDefinition.supportedFormats.map((format) => (
                            <SelectItem key={format} value={format}>
                              {format}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <ParameterEditor
                      definition={selectedDefinition}
                      state={runParameters}
                      onChange={(key, value) =>
                        setRunParameters((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                    />
                    <Button
                      className="w-full"
                      onClick={() => runReportMutation.mutate()}
                      disabled={runReportMutation.isPending}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {runReportMutation.isPending
                        ? 'Queueing report...'
                        : 'Run report'}
                    </Button>
                  </>
                ) : (
                  <Alert>
                    <AlertTitle>Select a registered report</AlertTitle>
                    <AlertDescription>
                      Parameter forms are generated from the registered schema,
                      so simple reports do not need handwritten UI.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Recent Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Artifact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(jobsQuery.data ?? []).map((job) => (
                      <TableRow
                        key={job.id}
                        className={
                          job.id === selectedJobId ? 'bg-slate-50' : undefined
                        }
                        onClick={() => setSelectedJobId(job.id)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">
                              {job.job_no ?? job.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {job.report_code ?? 'Registered report'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{job.status}</TableCell>
                        <TableCell>{job.progress_percent ?? 0}%</TableCell>
                        <TableCell>{job.row_count ?? '—'}</TableCell>
                        <TableCell>{job.format}</TableCell>
                        <TableCell>
                          {job.artifact_id ? 'Available' : 'Pending'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Job Detail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedJob ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Status</p>
                        <p className="font-medium text-slate-900">
                          {selectedJob.status}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Progress</p>
                        <p className="font-medium text-slate-900">
                          {selectedJob.progress_percent ?? 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Requested</p>
                        <p className="font-medium text-slate-900">
                          {selectedJob.created_at}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Source cutoff</p>
                        <p className="font-medium text-slate-900">
                          {selectedJob.source_cutoff_at ?? 'Pending'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Parameters
                      </p>
                      <pre className="mt-2 overflow-auto text-xs text-slate-600">
                        {formatJson(selectedJob.parameter_payload)}
                      </pre>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Execution context
                      </p>
                      <pre className="mt-2 overflow-auto text-xs text-slate-600">
                        {formatJson(selectedJob.execution_context)}
                      </pre>
                    </div>

                    {(selectedJob.safe_error_message ||
                      selectedJob.failure_code) && (
                      <Alert variant="warning">
                        <AlertTitle>Failure detail</AlertTitle>
                        <AlertDescription>
                          {selectedJob.failure_code ?? 'REPORT_ERROR'}:{' '}
                          {selectedJob.safe_error_message ??
                            'No safe error message saved.'}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={
                        !selectedJob.artifact_id || downloadMutation.isPending
                      }
                      onClick={() => {
                        if (selectedJob.artifact_id) {
                          downloadMutation.mutate(selectedJob.artifact_id);
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download artifact
                    </Button>
                    {downloadMessage && (
                      <p className="text-xs text-slate-500">
                        {downloadMessage}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a job to inspect progress, context, errors, and
                    artifact status.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-6">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TimerReset className="h-4 w-4 text-blue-600" />
                Schedule Wizard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
                {scheduleSteps.map((step) => (
                  <div
                    key={step}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
                  >
                    {step}
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-definition">
                      Registered report
                    </Label>
                    <Select
                      value={selectedDefinitionId}
                      onValueChange={selectDefinition}
                    >
                      <SelectTrigger id="schedule-definition">
                        <SelectValue placeholder="Select a report" />
                      </SelectTrigger>
                      <SelectContent>
                        {(definitionsQuery.data ?? []).map((definition) => (
                          <SelectItem
                            key={definition.id ?? definition.code}
                            value={definition.id ?? ''}
                          >
                            {definition.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule-name">Schedule name</Label>
                    <Input
                      id="schedule-name"
                      value={scheduleName}
                      onChange={(event) => setScheduleName(event.target.value)}
                    />
                  </div>

                  <ParameterEditor
                    definition={selectedDefinition}
                    state={scheduleParameters}
                    onChange={(key, value) =>
                      setScheduleParameters((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="schedule-format">Output format</Label>
                      <Select
                        value={scheduleFormat}
                        onValueChange={setScheduleFormat}
                      >
                        <SelectTrigger id="schedule-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedDefinition?.supportedFormats ?? []).map(
                            (format) => (
                              <SelectItem key={format} value={format}>
                                {format}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule-retention">Retention days</Label>
                      <Input
                        id="schedule-retention"
                        type="number"
                        value={scheduleRetentionDays}
                        onChange={(event) =>
                          setScheduleRetentionDays(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="schedule-cron">Cron expression</Label>
                      <Input
                        id="schedule-cron"
                        value={scheduleCron}
                        onChange={(event) =>
                          setScheduleCron(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule-timezone">Timezone</Label>
                      <Input
                        id="schedule-timezone"
                        value={scheduleTimezone}
                        onChange={(event) =>
                          setScheduleTimezone(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule-recipients">Recipients</Label>
                    <Input
                      id="schedule-recipients"
                      placeholder="finance@example.com, compliance@example.com"
                      value={scheduleRecipients}
                      onChange={(event) => {
                        setScheduleRecipients(event.target.value);
                        setMailVerifiedFor('');
                      }}
                    />
                    <p className="text-xs text-slate-500">
                      When email delivery is selected, SMTP verification must
                      succeed before the schedule is saved.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        verifyMailMutation.isPending ||
                        !scheduleRecipients.split(',')[0]?.trim()
                      }
                      onClick={() =>
                        verifyMailMutation.mutate(
                          scheduleRecipients.split(',')[0].trim(),
                        )
                      }
                    >
                      <MailCheck className="mr-2 h-4 w-4" />
                      {verifyMailMutation.isPending
                        ? 'Verifying SMTP...'
                        : 'Verify SMTP'}
                    </Button>
                    {mailVerifiedFor && (
                      <p className="text-xs text-emerald-600">
                        SMTP verified for {mailVerifiedFor}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <Card className="rounded-xl border-slate-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Review</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="text-slate-500">Report</p>
                        <p className="font-medium text-slate-900">
                          {selectedDefinition?.name ?? 'Not selected'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Format</p>
                        <p className="font-medium text-slate-900">
                          {scheduleFormat || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Schedule</p>
                        <p className="font-medium text-slate-900">
                          {scheduleCron} ({scheduleTimezone})
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Recipients</p>
                        <p className="font-medium text-slate-900">
                          {scheduleRecipients || 'Portal only'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Retention</p>
                        <p className="font-medium text-slate-900">
                          {scheduleRetentionDays} days
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    className="w-full"
                    disabled={
                      createScheduleMutation.isPending ||
                      !selectedDefinition?.id
                    }
                    onClick={() => createScheduleMutation.mutate()}
                  >
                    {createScheduleMutation.isPending
                      ? 'Saving schedule...'
                      : 'Create schedule'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Existing Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Report</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next run</TableHead>
                    <TableHead>Failures</TableHead>
                    <TableHead>SMTP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(schedulesQuery.data ?? []).map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>{schedule.name}</TableCell>
                      <TableCell>
                        {schedule.report_code ?? schedule.definition_id}
                      </TableCell>
                      <TableCell>{schedule.status}</TableCell>
                      <TableCell>{schedule.next_run_at ?? 'Pending'}</TableCell>
                      <TableCell>{schedule.failure_count ?? 0}</TableCell>
                      <TableCell>
                        {schedule.verified_smtp_at
                          ? 'Verified'
                          : 'Not recorded'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
