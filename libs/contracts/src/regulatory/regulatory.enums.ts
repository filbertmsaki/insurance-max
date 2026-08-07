export const RegulatoryAuthorityType = {
  INSURANCE_REGULATOR: 'INSURANCE_REGULATOR',
  TAX_AUTHORITY: 'TAX_AUTHORITY',
  FINANCIAL_INTELLIGENCE: 'FINANCIAL_INTELLIGENCE',
  DATA_PROTECTION: 'DATA_PROTECTION',
  OTHER: 'OTHER',
} as const;

export type RegulatoryAuthorityType =
  (typeof RegulatoryAuthorityType)[keyof typeof RegulatoryAuthorityType];

export const RegulatoryObligationType = {
  RETURN: 'RETURN',
  LEVY: 'LEVY',
  DECLARATION: 'DECLARATION',
  CERTIFICATION: 'CERTIFICATION',
  NOTIFICATION: 'NOTIFICATION',
  AUDIT_SUBMISSION: 'AUDIT_SUBMISSION',
  OTHER: 'OTHER',
} as const;

export type RegulatoryObligationType =
  (typeof RegulatoryObligationType)[keyof typeof RegulatoryObligationType];

export const RegulatoryFrequency = {
  EVENT_DRIVEN: 'EVENT_DRIVEN',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMI_ANNUAL: 'SEMI_ANNUAL',
  ANNUAL: 'ANNUAL',
  AD_HOC: 'AD_HOC',
} as const;

export type RegulatoryFrequency =
  (typeof RegulatoryFrequency)[keyof typeof RegulatoryFrequency];

export const RegulatoryObligationStatus = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  PREPARATION_IN_PROGRESS: 'PREPARATION_IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  SUBMITTED: 'SUBMITTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  REJECTED: 'REJECTED',
  OVERDUE: 'OVERDUE',
  WAIVED: 'WAIVED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  COMPLETED: 'COMPLETED',
} as const;

export type RegulatoryObligationStatus =
  (typeof RegulatoryObligationStatus)[keyof typeof RegulatoryObligationStatus];

export const RegulatoryReturnStatus = {
  DRAFT: 'DRAFT',
  GENERATED: 'GENERATED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  SUBMISSION_PROCESSING: 'SUBMISSION_PROCESSING',
  SUBMITTED: 'SUBMITTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
} as const;

export type RegulatoryReturnStatus =
  (typeof RegulatoryReturnStatus)[keyof typeof RegulatoryReturnStatus];

export const LevyAssessmentStatus = {
  DRAFT: 'DRAFT',
  CALCULATED: 'CALCULATED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  REVERSED: 'REVERSED',
} as const;

export type LevyAssessmentStatus =
  (typeof LevyAssessmentStatus)[keyof typeof LevyAssessmentStatus];

export const RegulatoryReconciliationStatus = {
  NOT_CHECKED: 'NOT_CHECKED',
  IN_BALANCE: 'IN_BALANCE',
  OUT_OF_BALANCE: 'OUT_OF_BALANCE',
  INVESTIGATION_REQUIRED: 'INVESTIGATION_REQUIRED',
  RESOLVED: 'RESOLVED',
} as const;

export type RegulatoryReconciliationStatus =
  (typeof RegulatoryReconciliationStatus)[keyof typeof RegulatoryReconciliationStatus];
