export enum PortalActorType {
  CUSTOMER = 'CUSTOMER',
  INTERMEDIARY = 'INTERMEDIARY',
}

export enum PortalAccountStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
}

export enum PortalInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

/** Email delivery of an invitation, tracked separately from its lifecycle. */
export enum PortalInvitationDeliveryStatus {
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
  /** No longer sendable: revoked, expired or accepted before delivery. */
  CANCELLED = 'CANCELLED',
}

export enum PortalRequestType {
  QUOTATION_ASSISTANCE = 'QUOTATION_ASSISTANCE',
  ENDORSEMENT = 'ENDORSEMENT',
  CANCELLATION = 'CANCELLATION',
  RENEWAL = 'RENEWAL',
  CLAIM_NOTIFICATION = 'CLAIM_NOTIFICATION',
  PAYMENT_PROOF = 'PAYMENT_PROOF',
}

export enum PortalRequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  ADDITIONAL_INFO_REQUIRED = 'ADDITIONAL_INFO_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PortalPaymentProofStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum PortalAttachmentStatus {
  ACTIVE = 'ACTIVE',
  QUARANTINED = 'QUARANTINED',
  REJECTED = 'REJECTED',
  DELETED = 'DELETED',
}

export enum PortalNotificationSeverity {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}
