export const PolicyTransactionType = {
  ENDORSEMENT: 'ENDORSEMENT',
  CANCELLATION: 'CANCELLATION',
  RENEWAL: 'RENEWAL',
} as const;

export type PolicyTransactionType =
  (typeof PolicyTransactionType)[keyof typeof PolicyTransactionType];

export const PolicyTransactionStage = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  SUBMISSION_PROCESSING: 'SUBMISSION_PROCESSING',
  APPLIED: 'APPLIED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
} as const;

export type PolicyTransactionStage =
  (typeof PolicyTransactionStage)[keyof typeof PolicyTransactionStage];

export const PolicyTransactionChangeType = {
  ADD: 'ADD',
  MODIFY: 'MODIFY',
  REMOVE: 'REMOVE',
} as const;

export type PolicyTransactionChangeType =
  (typeof PolicyTransactionChangeType)[keyof typeof PolicyTransactionChangeType];

export const PolicyChangeCategory = {
  CUSTOMER: 'CUSTOMER',
  POLICYHOLDER: 'POLICYHOLDER',
  COVER_PERIOD: 'COVER_PERIOD',
  PRODUCT: 'PRODUCT',
  COVER: 'COVER',
  RISK: 'RISK',
  ASSET: 'ASSET',
  SUM_INSURED: 'SUM_INSURED',
  ADDON: 'ADDON',
  EXCLUSION: 'EXCLUSION',
  SPECIAL_CONDITION: 'SPECIAL_CONDITION',
  DISTRIBUTION: 'DISTRIBUTION',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
} as const;

export type PolicyChangeCategory =
  (typeof PolicyChangeCategory)[keyof typeof PolicyChangeCategory];

export const PolicyTransactionPremiumEffect = {
  NONE: 'NONE',
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

export type PolicyTransactionPremiumEffect =
  (typeof PolicyTransactionPremiumEffect)[keyof typeof PolicyTransactionPremiumEffect];

export const EndorsementLifecycleStatus = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  READY_FOR_SUBMISSION: 'READY_FOR_SUBMISSION',
  SUBMISSION_PROCESSING: 'SUBMISSION_PROCESSING',
  APPLIED: 'APPLIED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type EndorsementLifecycleStatus =
  (typeof EndorsementLifecycleStatus)[keyof typeof EndorsementLifecycleStatus];

export const CancellationMethod = {
  PRO_RATA: 'PRO_RATA',
  SHORT_PERIOD: 'SHORT_PERIOD',
  MINIMUM_RETAINED: 'MINIMUM_RETAINED',
  FULL_REFUND: 'FULL_REFUND',
  NO_REFUND: 'NO_REFUND',
} as const;

export type CancellationMethod =
  (typeof CancellationMethod)[keyof typeof CancellationMethod];

export const CancellationReasonType = {
  CUSTOMER_REQUEST: 'CUSTOMER_REQUEST',
  NON_PAYMENT: 'NON_PAYMENT',
  DUPLICATE_POLICY: 'DUPLICATE_POLICY',
  RISK_NO_LONGER_EXISTS: 'RISK_NO_LONGER_EXISTS',
  MATERIAL_MISREPRESENTATION: 'MATERIAL_MISREPRESENTATION',
  FRAUD: 'FRAUD',
  POLICY_REPLACEMENT: 'POLICY_REPLACEMENT',
  OTHER: 'OTHER',
} as const;

export type CancellationReasonType =
  (typeof CancellationReasonType)[keyof typeof CancellationReasonType];

export const RenewalLifecycleStatus = {
  ELIGIBLE: 'ELIGIBLE',
  OFFER_DRAFT: 'OFFER_DRAFT',
  OFFER_READY: 'OFFER_READY',
  OFFER_SENT: 'OFFER_SENT',
  CUSTOMER_ACCEPTED: 'CUSTOMER_ACCEPTED',
  CUSTOMER_DECLINED: 'CUSTOMER_DECLINED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  SUBMISSION_PROCESSING: 'SUBMISSION_PROCESSING',
  RENEWED: 'RENEWED',
  LAPSED: 'LAPSED',
  CANCELLED: 'CANCELLED',
} as const;

export type RenewalLifecycleStatus =
  (typeof RenewalLifecycleStatus)[keyof typeof RenewalLifecycleStatus];

export const PolicyVersionType = {
  NEW_BUSINESS: 'NEW_BUSINESS',
  ENDORSEMENT: 'ENDORSEMENT',
  CANCELLATION: 'CANCELLATION',
  CORRECTION: 'CORRECTION',
} as const;

export type PolicyVersionType =
  (typeof PolicyVersionType)[keyof typeof PolicyVersionType];

export const PolicyTransactionEventType = {
  CREATED: 'CREATED',
  CHANGE_ADDED: 'CHANGE_ADDED',
  PRICED: 'PRICED',
  COMPLETED: 'COMPLETED',
  APPROVAL_SUBMITTED: 'APPROVAL_SUBMITTED',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REJECTED: 'REJECTED',
  PAYMENT_REQUESTED: 'PAYMENT_REQUESTED',
  PAYMENT_SATISFIED: 'PAYMENT_SATISFIED',
  SUBMISSION_QUEUED: 'SUBMISSION_QUEUED',
  SUBMISSION_ACCEPTED: 'SUBMISSION_ACCEPTED',
  SUBMISSION_REJECTED: 'SUBMISSION_REJECTED',
  POLICY_VERSION_APPLIED: 'POLICY_VERSION_APPLIED',
  CANCELLATION_APPLIED: 'CANCELLATION_APPLIED',
  RENEWAL_OFFER_CREATED: 'RENEWAL_OFFER_CREATED',
  RENEWAL_POLICY_ISSUED: 'RENEWAL_POLICY_ISSUED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type PolicyTransactionEventType =
  (typeof PolicyTransactionEventType)[keyof typeof PolicyTransactionEventType];
