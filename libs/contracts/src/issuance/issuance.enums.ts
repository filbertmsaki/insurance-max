export const CoverNoteLifecycleStatus = {
  PENDING_SUBMISSION: 'PENDING_SUBMISSION',
  SUBMISSION_PROCESSING: 'SUBMISSION_PROCESSING',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ISSUED: 'ISSUED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type CoverNoteLifecycleStatus =
  (typeof CoverNoteLifecycleStatus)[keyof typeof CoverNoteLifecycleStatus];

export const PolicyLifecycleStatus = {
  PENDING_COVER_NOTE: 'PENDING_COVER_NOTE',
  COVER_NOTE_ISSUED: 'COVER_NOTE_ISSUED',
  POLICY_SUBMISSION_PENDING: 'POLICY_SUBMISSION_PENDING',
  POLICY_SUBMISSION_PROCESSING: 'POLICY_SUBMISSION_PROCESSING',
  POLICY_ACKNOWLEDGED: 'POLICY_ACKNOWLEDGED',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type PolicyLifecycleStatus =
  (typeof PolicyLifecycleStatus)[keyof typeof PolicyLifecycleStatus];

export const RegulatorySyncStatus = {
  PENDING: 'PENDING',
  IN_SYNC: 'IN_SYNC',
  OUT_OF_SYNC: 'OUT_OF_SYNC',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  FAILED: 'FAILED',
} as const;

export type RegulatorySyncStatus =
  (typeof RegulatorySyncStatus)[keyof typeof RegulatorySyncStatus];

export const VerificationType = {
  MOTOR: 'MOTOR',
  COVER_NOTE: 'COVER_NOTE',
  NIN: 'NIN',
  COMPANY: 'COMPANY',
} as const;

export type VerificationType =
  (typeof VerificationType)[keyof typeof VerificationType];

export const VerificationStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const InsuranceDocumentType = {
  COVER_NOTE: 'COVER_NOTE',
  MOTOR_CERTIFICATE: 'MOTOR_CERTIFICATE',
  POLICY_SCHEDULE: 'POLICY_SCHEDULE',
  POLICY_CERTIFICATE: 'POLICY_CERTIFICATE',
} as const;

export type InsuranceDocumentType =
  (typeof InsuranceDocumentType)[keyof typeof InsuranceDocumentType];

export const InsuranceDocumentStatus = {
  PENDING: 'PENDING',
  GENERATING: 'GENERATING',
  AVAILABLE: 'AVAILABLE',
  FAILED: 'FAILED',
  SUPERSEDED: 'SUPERSEDED',
  REVOKED: 'REVOKED',
} as const;

export type InsuranceDocumentStatus =
  (typeof InsuranceDocumentStatus)[keyof typeof InsuranceDocumentStatus];

export const IssuanceEventType = {
  COVER_NOTE_SUBMISSION_STARTED: 'COVER_NOTE_SUBMISSION_STARTED',
  COVER_NOTE_ACKNOWLEDGED: 'COVER_NOTE_ACKNOWLEDGED',
  COVER_NOTE_ISSUED: 'COVER_NOTE_ISSUED',
  COVER_NOTE_REJECTED: 'COVER_NOTE_REJECTED',
  POLICY_CREATED: 'POLICY_CREATED',
  POLICY_SUBMISSION_STARTED: 'POLICY_SUBMISSION_STARTED',
  POLICY_ACKNOWLEDGED: 'POLICY_ACKNOWLEDGED',
  POLICY_ACTIVATED: 'POLICY_ACTIVATED',
  POLICY_REJECTED: 'POLICY_REJECTED',
  DOCUMENT_GENERATION_REQUESTED: 'DOCUMENT_GENERATION_REQUESTED',
  DOCUMENT_AVAILABLE: 'DOCUMENT_AVAILABLE',
  DOCUMENT_GENERATION_FAILED: 'DOCUMENT_GENERATION_FAILED',
  REGULATORY_SYNC_CONFIRMED: 'REGULATORY_SYNC_CONFIRMED',
  REGULATORY_SYNC_MISMATCH: 'REGULATORY_SYNC_MISMATCH',
} as const;

export type IssuanceEventType =
  (typeof IssuanceEventType)[keyof typeof IssuanceEventType];
