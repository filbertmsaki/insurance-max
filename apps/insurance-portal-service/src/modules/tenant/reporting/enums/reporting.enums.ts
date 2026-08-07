export enum ReportFormat {
  CSV = 'CSV',
  XLSX = 'XLSX',
  PDF = 'PDF',
  JSON = 'JSON',
}

export enum ReportScheduleStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
}

export enum ReportJobStatus {
  QUEUED = 'QUEUED',
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  RUNNING = 'RUNNING',
  GENERATING_ARTIFACT = 'GENERATING_ARTIFACT',
  COMPLETED = 'COMPLETED',
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ReportDeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum ReportDeliveryChannel {
  DOWNLOAD = 'DOWNLOAD',
  EMAIL = 'EMAIL',
  SECURE_PORTAL = 'SECURE_PORTAL',
}
