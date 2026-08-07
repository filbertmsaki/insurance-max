export const DocumentStatus = {
  UPLOAD_PENDING: 'UPLOAD_PENDING',
  UPLOADED: 'UPLOADED',
  SCAN_PENDING: 'SCAN_PENDING',
  SCANNING: 'SCANNING',
  AVAILABLE: 'AVAILABLE',
  QUARANTINED: 'QUARANTINED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
  REVOKED: 'REVOKED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const;

export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DocumentSourceType = {
  UPLOAD: 'UPLOAD',
  GENERATED: 'GENERATED',
  MIGRATED: 'MIGRATED',
  PROVIDER_RECEIVED: 'PROVIDER_RECEIVED',
} as const;

export type DocumentSourceType =
  (typeof DocumentSourceType)[keyof typeof DocumentSourceType];

export const DocumentClassification = {
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED: 'RESTRICTED',
} as const;

export type DocumentClassification =
  (typeof DocumentClassification)[keyof typeof DocumentClassification];

export const DocumentAccessAudience = {
  INTERNAL: 'INTERNAL',
  CUSTOMER: 'CUSTOMER',
  INTERMEDIARY: 'INTERMEDIARY',
  PUBLIC_VERIFICATION: 'PUBLIC_VERIFICATION',
} as const;

export type DocumentAccessAudience =
  (typeof DocumentAccessAudience)[keyof typeof DocumentAccessAudience];

export const DocumentLinkType = {
  CUSTOMER: 'CUSTOMER',
  QUOTATION: 'QUOTATION',
  COVER_NOTE: 'COVER_NOTE',
  POLICY: 'POLICY',
  POLICY_TRANSACTION: 'POLICY_TRANSACTION',
  INVOICE: 'INVOICE',
  RECEIPT: 'RECEIPT',
  CLAIM: 'CLAIM',
  CLAIM_ASSESSMENT: 'CLAIM_ASSESSMENT',
  CLAIM_DISCHARGE: 'CLAIM_DISCHARGE',
  COMPLAINT: 'COMPLAINT',
  REINSURANCE: 'REINSURANCE',
  REGULATORY_RETURN: 'REGULATORY_RETURN',
  REPORT_ARTIFACT: 'REPORT_ARTIFACT',
  PORTAL_REQUEST: 'PORTAL_REQUEST',
  COMMUNICATION: 'COMMUNICATION',
} as const;

export type DocumentLinkType =
  (typeof DocumentLinkType)[keyof typeof DocumentLinkType];

export const DocumentSignatureStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PARTIALLY_SIGNED: 'PARTIALLY_SIGNED',
  SIGNED: 'SIGNED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type DocumentSignatureStatus =
  (typeof DocumentSignatureStatus)[keyof typeof DocumentSignatureStatus];
