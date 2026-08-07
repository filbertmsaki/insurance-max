import {
  AnalyticsDataFreshness,
  AnalyticsPeriodType,
  AnalyticsValueKind,
  MetricAggregationType,
  MetricValueType,
} from './analytics.enums';

export interface AnalyticsMetricDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
  valueType: MetricValueType;
  aggregationType: MetricAggregationType;
  formulaVersion: number;
  formulaDescription: string;
  numeratorMetricCode: string | null;
  denominatorMetricCode: string | null;
  supportedDimensions: string[];
  supportedPeriods: AnalyticsPeriodType[];
  permission: string;
  sensitive: boolean;
  targetSupported: boolean;
  forecastSupported: boolean;
  benchmarkSupported: boolean;
}

export interface AnalyticsMetricValue {
  metricCode: string;
  periodType: AnalyticsPeriodType;
  periodStart: string;
  periodEnd: string;
  value: string | null;
  valueKind: AnalyticsValueKind;
  currencyCode: string | null;
  dimensions: Record<string, string>;
  formulaVersion: number;
  sourceEventSequence: number;
  calculatedAt: string;
  freshness: AnalyticsDataFreshness;
  freshnessReason: string | null;
}
