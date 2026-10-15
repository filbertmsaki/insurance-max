import { apiClient } from '@/modules/shared/api/client';
import type { BackendPaginatedResponse } from '@/modules/shared/api/pagination';

export type IntelligenceListKind =
  | 'company-health'
  | 'benchmarks'
  | 'anomalies'
  | 'forecasts';

interface PageParams {
  limit?: number;
  offset?: number;
}

export interface CompanyHealthRow {
  id: string;
  name: string;
  companyCode?: string | null;
  publishedScorecards: string | number;
  openAnomalies: string | number;
  forecastRuns: string | number;
}

export interface BenchmarkSnapshot {
  id: string;
  metric_code: string;
  cohort_key: string;
  period_start: string;
  period_end: string;
  sample_size: string | number;
  average_value?: string | null;
  median_value?: string | null;
  percentile_90?: string | null;
  created_at?: string;
}

export interface AnomalyFinding {
  id: string;
  company_id: string;
  companyName?: string | null;
  branch_id?: string | null;
  metric_code: string;
  metric_date: string;
  severity: string;
  status: string;
  observed_value?: string | null;
  expected_value?: string | null;
  z_score?: string | null;
  created_at?: string;
}

export interface ForecastRun {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  definitionName?: string | null;
  status: string;
  horizon_start?: string | null;
  horizon_end?: string | null;
  created_at: string;
}

export interface BenchmarkFilters extends PageParams {
  metricCode?: string;
  cohortKey?: string;
  from?: string;
  to?: string;
}

export interface AnomalyFilters extends PageParams {
  companyId?: string;
  branchId?: string;
  from?: string;
  to?: string;
}

export interface ForecastFilters extends PageParams {
  companyId?: string;
  branchId?: string;
  status?: string;
}

function params(input: object) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== '' && value != null),
  );
}

export const platformIntelligenceApi = {
  /** Server-side table page (`page` opts into the paged contract). */
  page: <T>(
    kind: IntelligenceListKind,
    query: Record<string, unknown>,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<BackendPaginatedResponse<T>>(`/platform/intelligence/${kind}`, {
        params: params(query),
        signal,
      })
      .then((r) => r.data),

  companyHealth: (query: PageParams = {}) =>
    apiClient
      .get<CompanyHealthRow[]>('/platform/intelligence/company-health', {
        params: params(query),
      })
      .then((r) => r.data),

  benchmarks: (query: BenchmarkFilters = {}) =>
    apiClient
      .get<BenchmarkSnapshot[]>('/platform/intelligence/benchmarks', {
        params: params(query),
      })
      .then((r) => r.data),

  anomalies: (query: AnomalyFilters = {}) =>
    apiClient
      .get<AnomalyFinding[]>('/platform/intelligence/anomalies', {
        params: params(query),
      })
      .then((r) => r.data),

  forecasts: (query: ForecastFilters = {}) =>
    apiClient
      .get<ForecastRun[]>('/platform/intelligence/forecasts', {
        params: params(query),
      })
      .then((r) => r.data),

  rebuildBenchmarks: () =>
    apiClient
      .post('/platform/intelligence/benchmarks/rebuild')
      .then((r) => r.data),
};
