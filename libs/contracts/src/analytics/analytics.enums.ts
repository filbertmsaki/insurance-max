export const MetricValueType = {
  MONEY: 'MONEY',
  NUMBER: 'NUMBER',
  PERCENTAGE: 'PERCENTAGE',
  RATIO: 'RATIO',
  DURATION: 'DURATION',
} as const;

export type MetricValueType =
  (typeof MetricValueType)[keyof typeof MetricValueType];

export const MetricAggregationType = {
  SUM: 'SUM',
  COUNT: 'COUNT',
  DISTINCT_COUNT: 'DISTINCT_COUNT',
  AVERAGE: 'AVERAGE',
  WEIGHTED_AVERAGE: 'WEIGHTED_AVERAGE',
  MINIMUM: 'MINIMUM',
  MAXIMUM: 'MAXIMUM',
  RATIO: 'RATIO',
  FORMULA: 'FORMULA',
} as const;

export type MetricAggregationType =
  (typeof MetricAggregationType)[keyof typeof MetricAggregationType];

export const AnalyticsPeriodType = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  QUARTER: 'QUARTER',
  YEAR: 'YEAR',
  ROLLING_30_DAYS: 'ROLLING_30_DAYS',
  ROLLING_12_MONTHS: 'ROLLING_12_MONTHS',
} as const;

export type AnalyticsPeriodType =
  (typeof AnalyticsPeriodType)[keyof typeof AnalyticsPeriodType];

export const AnalyticsDataFreshness = {
  CURRENT: 'CURRENT',
  DELAYED: 'DELAYED',
  STALE: 'STALE',
  REBUILDING: 'REBUILDING',
  FAILED: 'FAILED',
} as const;

export type AnalyticsDataFreshness =
  (typeof AnalyticsDataFreshness)[keyof typeof AnalyticsDataFreshness];

export const AnalyticsValueKind = {
  ACTUAL: 'ACTUAL',
  TARGET: 'TARGET',
  FORECAST: 'FORECAST',
  BENCHMARK: 'BENCHMARK',
} as const;

export type AnalyticsValueKind =
  (typeof AnalyticsValueKind)[keyof typeof AnalyticsValueKind];

export const AnomalySeverity = {
  INFO: 'INFO',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type AnomalySeverity =
  (typeof AnomalySeverity)[keyof typeof AnomalySeverity];
