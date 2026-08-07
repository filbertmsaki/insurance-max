export const ReportCategory = {
  UNDERWRITING: 'UNDERWRITING',
  POLICIES: 'POLICIES',
  FINANCE: 'FINANCE',
  CLAIMS: 'CLAIMS',
  REINSURANCE: 'REINSURANCE',
  REGULATORY: 'REGULATORY',
  TIRAMIS: 'TIRAMIS',
  COMPLIANCE: 'COMPLIANCE',
  AUDIT: 'AUDIT',
  MANAGEMENT: 'MANAGEMENT',
  PLATFORM: 'PLATFORM',
} as const;

export type ReportCategory =
  (typeof ReportCategory)[keyof typeof ReportCategory];

export const ReportOutputFormat = {
  XLSX: 'XLSX',
  CSV: 'CSV',
  PDF: 'PDF',
  JSON: 'JSON',
} as const;

export type ReportOutputFormat =
  (typeof ReportOutputFormat)[keyof typeof ReportOutputFormat];

export const ReportJobStatus = {
  QUEUED: 'QUEUED',
  VALIDATING: 'VALIDATING',
  RUNNING: 'RUNNING',
  GENERATING_ARTIFACT: 'GENERATING_ARTIFACT',
  COMPLETED: 'COMPLETED',
  PARTIALLY_DELIVERED: 'PARTIALLY_DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type ReportJobStatus =
  (typeof ReportJobStatus)[keyof typeof ReportJobStatus];

export const ReportScheduleFrequency = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  ANNUAL: 'ANNUAL',
  CUSTOM_CRON: 'CUSTOM_CRON',
} as const;

export type ReportScheduleFrequency =
  (typeof ReportScheduleFrequency)[keyof typeof ReportScheduleFrequency];

export const ReportDeliveryChannel = {
  DOWNLOAD: 'DOWNLOAD',
  EMAIL: 'EMAIL',
  SECURE_PORTAL: 'SECURE_PORTAL',
} as const;

export type ReportDeliveryChannel =
  (typeof ReportDeliveryChannel)[keyof typeof ReportDeliveryChannel];

export const ReportSensitivity = {
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED: 'RESTRICTED',
} as const;

export type ReportSensitivity =
  (typeof ReportSensitivity)[keyof typeof ReportSensitivity];
