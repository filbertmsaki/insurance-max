import { apiClient } from '@/modules/shared/api/client';

export type ExecutiveWidgetStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'NO_DATA'
  | 'STALE'
  | 'ERROR';

export interface ExecutiveDashboardWidget {
  code: string;
  name?: string;
  status: ExecutiveWidgetStatus;
  data: {
    value: string | null;
    unit: string;
    periodStart?: string;
    periodEnd?: string;
    formulaVersion?: number;
  } | null;
  freshness: {
    status: string;
    lastProjectedAt?: string;
    reason?: string | null;
  } | null;
}

export interface ExecutiveDashboardResponse {
  period: {
    type: string;
    start: string;
    end: string;
  };
  widgets: ExecutiveDashboardWidget[];
  generatedAt: string;
}

export interface MetricDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
  valueType: string;
  aggregationType: string;
  formulaVersion: number;
  formulaDescription: string;
  numeratorMetricCode: string | null;
  denominatorMetricCode: string | null;
  supportedDimensions: string[];
  supportedPeriods: string[];
  permission: string;
  sensitive: boolean;
  targetSupported: boolean;
  forecastSupported: boolean;
  benchmarkSupported: boolean;
}

export interface MetricValue {
  metricCode: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  value: string | null;
  valueKind: string;
  currencyCode: string | null;
  dimensions: Record<string, string>;
  formulaVersion: number;
  sourceEventSequence: string;
  calculatedAt: string;
  freshness: string;
  freshnessReason: string | null;
}

export interface MetricQueryResponse {
  definition: MetricDefinition;
  values: MetricValue[];
}

export interface MetricCompareResponse {
  primary: MetricQueryResponse;
  comparison: MetricQueryResponse;
  delta: string | null;
}

export interface ReportParameterDefinition {
  key: string;
  label: string;
  dataType:
    | 'STRING'
    | 'NUMBER'
    | 'BOOLEAN'
    | 'DATE'
    | 'DATE_RANGE'
    | 'ENUM'
    | 'UUID'
    | 'UUID_ARRAY';
  required: boolean;
  defaultValue?: unknown;
  allowedValues?: Array<{ value: string; label: string }>;
  minimum?: number;
  maximum?: number;
  sensitive?: boolean;
}

export interface ReportDefinitionSummary {
  id?: string;
  code: string;
  name: string;
  description: string;
  category: string;
  version: number;
  supportedFormats: string[];
  sensitivity: string;
  permission: string;
  maximumRows: number;
  asynchronousOnly: boolean;
  parameters: ReportParameterDefinition[];
}

export interface ReportScheduleRecord {
  id: string;
  definition_id: string;
  name: string;
  status: string;
  cron_expression: string;
  timezone: string;
  format: string;
  recipient_emails: string[];
  report_code?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  failure_count?: number;
  last_failure_reason?: string | null;
  verified_smtp_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportJobRecord {
  id: string;
  job_no?: string | null;
  report_code?: string | null;
  status: string;
  format: string;
  progress_percent?: number;
  row_count?: string | null;
  source_cutoff_at?: string | null;
  completed_at?: string | null;
  safe_error_message?: string | null;
  failure_code?: string | null;
  artifact_id?: string | null;
  requested_by?: string | null;
  created_at: string;
  parameter_payload?: Record<string, unknown> | null;
  execution_context?: Record<string, unknown> | null;
  delivery_status?: string | null;
}

export interface RegulatoryAuthorityRecord {
  id: string;
  authority_code: string;
  authority_name: string;
  authority_type: string;
  jurisdiction_code: string;
  registration_reference?: string | null;
  submission_channel?: string | null;
  contact_email?: string | null;
  active: boolean;
}

export interface RegulatoryObligationRecord {
  id: string;
  obligation_reference: string;
  period_start: string;
  period_end: string;
  due_at: string;
  status: string;
  assigned_user_id?: string | null;
  assigned_role_id?: string | null;
  days_remaining?: number;
  warning_sent_days?: number[];
  definition?: {
    obligation_code: string;
    obligation_name: string;
    obligation_type: string;
    frequency: string;
    report_code?: string | null;
    requires_approval?: boolean;
    requires_submission_evidence?: boolean;
  } | null;
  authority?: RegulatoryAuthorityRecord | null;
  active_return?: {
    id: string;
    return_no: string;
    status: string;
    version_number?: number;
  } | null;
  active_levy_assessment?: {
    id: string;
    assessment_no: string;
    status: string;
  } | null;
  allowed_actions?: string[];
}

export interface RegulatoryReturnRecord {
  id: string;
  return_no: string;
  return_code?: string | null;
  version_number: number;
  status: string;
  period_start: string;
  period_end: string;
  due_at?: string | null;
  report_definition_code?: string | null;
  report_definition_version?: number | null;
  source_cutoff_at?: string | null;
  source_projection_sequence?: string | null;
  reconciliation_status: string;
  reconciliation_summary?: Record<string, unknown> | null;
  validation_results?: Record<string, unknown> | null;
  submissions: RegulatorySubmissionRecord[];
  versions: Array<{
    id: string;
    return_no: string;
    version_number: number;
    status: string;
    created_at: string;
  }>;
  read_only: boolean;
  active_levy_assessment?: RegulatoryLevyAssessmentRecord | null;
  obligation_instance?: {
    id: string;
    obligation_reference: string;
    due_at?: string | null;
    status: string;
  } | null;
  parameters?: Record<string, unknown>;
  return_snapshot?: Record<string, unknown> | null;
}

export interface RegulatorySubmissionRecord {
  id: string;
  submission_no: string;
  submission_channel: string;
  submission_reference?: string | null;
  status: string;
  acknowledgement_reference?: string | null;
  acknowledgement_code?: string | null;
  acknowledgement_message?: string | null;
  evidence_document_id?: string | null;
  submitted_at: string;
  acknowledged_at?: string | null;
}

export interface RegulatoryLevyAssessmentRecord {
  id: string;
  assessment_no: string;
  period_start: string;
  period_end: string;
  status: string;
  basis_amount: string;
  rate_value: string;
  assessed_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  currency_code: string;
  reconciliation_status: string;
  finance_payment_reference?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export const phase16Api = {
  getExecutiveDashboard() {
    return apiClient.get<ExecutiveDashboardResponse>('/tenant/dashboard/executive').then(
      (response) => response.data,
    );
  },

  getMetricDefinitions() {
    return apiClient.get<MetricDefinition[]>('/tenant/analytics/metrics').then(
      (response) => response.data,
    );
  },

  getMetricDefinition(code: string) {
    return apiClient
      .get<MetricDefinition>(`/tenant/analytics/metrics/${code}`)
      .then((response) => response.data);
  },

  queryMetric(payload: {
    metricCode: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    branchId?: string;
    dimensions?: Record<string, string>;
    valueKind?: string;
    currencyCode?: string;
  }) {
    return apiClient
      .post<MetricQueryResponse>('/tenant/analytics/query', payload)
      .then((response) => response.data);
  },

  compareMetric(payload: {
    metricCode: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    branchId?: string;
    dimensions?: Record<string, string>;
    valueKind?: string;
    currencyCode?: string;
    comparePeriodStart?: string;
    comparePeriodEnd?: string;
  }) {
    return apiClient
      .post<MetricCompareResponse>('/tenant/analytics/compare', payload)
      .then((response) => response.data);
  },

  getReportDefinitions() {
    return apiClient
      .get<ReportDefinitionSummary[]>('/tenant/reports/definitions')
      .then((response) => response.data);
  },

  runReport(payload: {
    definition_id: string;
    format?: string;
    parameters?: Record<string, unknown>;
    branch_id?: string | null;
  }) {
    return apiClient.post('/tenant/reports/run', payload).then((response) => response.data);
  },

  getReportJobs() {
    return apiClient.get<ReportJobRecord[]>('/tenant/reports/jobs').then(
      (response) => response.data,
    );
  },

  getReportJob(id: string) {
    return apiClient.get<ReportJobRecord>(`/tenant/reports/jobs/${id}`).then(
      (response) => response.data,
    );
  },

  getSchedules() {
    return apiClient
      .get<ReportScheduleRecord[]>('/tenant/reports/schedules')
      .then((response) => response.data);
  },

  createSchedule(payload: {
    definition_id: string;
    name: string;
    cron_expression: string;
    timezone?: string;
    format: string;
    recipient_emails?: string[];
    parameters?: Record<string, unknown>;
  }) {
    return apiClient
      .post('/tenant/reports/schedules', payload)
      .then((response) => response.data);
  },

  testReportMail(recipient: string) {
    return apiClient.post('/tenant/reports/mail/test', { recipient }).then(
      (response) => response.data,
    );
  },

  downloadArtifact(id: string) {
    return apiClient
      .get<{ download_token?: string; downloadUrl?: string }>(
        `/tenant/reports/artifacts/${id}/download`,
      )
      .then((response) => response.data);
  },

  getAuthorities() {
    return apiClient
      .get<RegulatoryAuthorityRecord[]>('/tenant/regulatory/authorities')
      .then((response) => response.data);
  },

  getRegulatoryCalendar() {
    return apiClient
      .get<RegulatoryObligationRecord[]>('/tenant/regulatory/calendar')
      .then((response) => response.data);
  },

  generateRegulatoryCalendar(year: number) {
    return apiClient
      .post(`/tenant/regulatory/calendar/generate/${year}`)
      .then((response) => response.data);
  },

  getRegulatoryReturns() {
    return apiClient
      .get<RegulatoryReturnRecord[]>('/tenant/regulatory/returns')
      .then((response) => response.data);
  },

  getRegulatoryReturn(id: string) {
    return apiClient
      .get<RegulatoryReturnRecord>(`/tenant/regulatory/returns/${id}`)
      .then((response) => response.data);
  },

  validateReturn(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/validate`)
      .then((response) => response.data);
  },

  reconcileReturn(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/reconcile`)
      .then((response) => response.data);
  },

  submitReturnForReview(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/submit-review`)
      .then((response) => response.data);
  },

  approveReturn(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/approve`)
      .then((response) => response.data);
  },

  createReturnCorrection(id: string) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/create-correction`)
      .then((response) => response.data);
  },

  recordSubmission(
    id: string,
    payload: {
      submission_channel: string;
      submission_reference?: string;
      evidence_document_id?: string;
      acknowledgement_reference?: string;
      acknowledgement_code?: string;
      acknowledgement_message?: string;
      acknowledged_at?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return apiClient
      .post(`/tenant/regulatory/returns/${id}/record-submission`, payload)
      .then((response) => response.data);
  },

  getLevyAssessments() {
    return apiClient
      .get<RegulatoryLevyAssessmentRecord[]>(
        '/tenant/regulatory/levy-assessments',
      )
      .then((response) => response.data);
  },
};
