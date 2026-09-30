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

/** Executive dashboard and analytics metrics (`/tenant/dashboard`, `/tenant/analytics`). */
export const analyticsApi = {
  getExecutiveDashboard() {
    return apiClient
      .get<ExecutiveDashboardResponse>('/tenant/dashboard/executive')
      .then((response) => response.data);
  },

  getMetricDefinitions() {
    return apiClient
      .get<MetricDefinition[]>('/tenant/analytics/metrics')
      .then((response) => response.data);
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
};
