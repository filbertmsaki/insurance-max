import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';

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
  definition_id?: string | null;
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

export interface ReportListParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: string;
  definition_id?: string;
  /** Report category, e.g. CLAIMS (matches category or CLAIMS_ code prefix). */
  category?: string;
}

/** Report definitions, runs, jobs, schedules and artifacts (`/tenant/reports`). */
export const reportingApi = {
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
    return apiClient
      .post('/tenant/reports/run', payload)
      .then((response) => response.data);
  },

  listJobsPage(params: ReportListParams, signal?: AbortSignal) {
    return apiClient
      .get<PaginatedResponse<ReportJobRecord>>('/tenant/reports/jobs', {
        params,
        signal,
      })
      .then((response) => response.data);
  },

  getReportJob(id: string) {
    return apiClient
      .get<ReportJobRecord>(`/tenant/reports/jobs/${id}`)
      .then((response) => response.data);
  },

  listSchedulesPage(params: ReportListParams, signal?: AbortSignal) {
    return apiClient
      .get<
        PaginatedResponse<ReportScheduleRecord>
      >('/tenant/reports/schedules', { params, signal })
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
    return apiClient
      .post('/tenant/reports/mail/test', { recipient })
      .then((response) => response.data);
  },

  downloadArtifact(id: string) {
    return apiClient
      .get<{
        download_token?: string;
        downloadUrl?: string;
      }>(`/tenant/reports/artifacts/${id}/download`)
      .then((response) => response.data);
  },
};
