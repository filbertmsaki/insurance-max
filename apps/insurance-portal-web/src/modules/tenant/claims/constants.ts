import type {
  ClaimantType,
  ClaimPriority,
  ClaimQueue,
  ClaimStatus,
  NotificationSource,
} from './types';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'primary';

/** Labels and badge tones for the claim lifecycle (claim-lifecycle.ts). */
export const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; tone: Tone }
> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  NOTIFICATION_SUBMITTED: { label: 'Notification submitted', tone: 'info' },
  NOTIFICATION_FAILED: { label: 'Notification failed', tone: 'danger' },
  NOTIFICATION_ACCEPTED: { label: 'Notified', tone: 'primary' },
  INTIMATION_PENDING: { label: 'Intimation pending', tone: 'warning' },
  INTIMATION_SUBMITTED: { label: 'Intimation submitted', tone: 'info' },
  INTIMATION_FAILED: { label: 'Intimation failed', tone: 'danger' },
  INTIMATED: { label: 'Intimated', tone: 'primary' },
  ASSESSMENT_PENDING: { label: 'Assessment pending', tone: 'warning' },
  UNDER_ASSESSMENT: { label: 'Under assessment', tone: 'info' },
  ASSESSED: { label: 'Assessed', tone: 'info' },
  REASSESSMENT_REQUIRED: { label: 'Reassessment required', tone: 'warning' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  DISCHARGE_PENDING: { label: 'Discharge pending', tone: 'warning' },
  DISCHARGE_ISSUED: { label: 'Discharge issued', tone: 'info' },
  DISCHARGE_ACCEPTED: { label: 'Discharge accepted', tone: 'success' },
  DISCHARGE_REJECTED: { label: 'Discharge rejected', tone: 'danger' },
  PAYMENT_PENDING: { label: 'Payment pending', tone: 'warning' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  SETTLED: { label: 'Settled', tone: 'success' },
  REJECTION_PENDING: { label: 'Rejection pending', tone: 'warning' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  REOPENED: { label: 'Reopened', tone: 'warning' },
  CLOSED: { label: 'Closed', tone: 'muted' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export const CLAIM_STATUSES = Object.keys(CLAIM_STATUS_META) as ClaimStatus[];

/** TIRAMIS regulatory-operation statuses (claim_regulatory_operations). */
export const REGULATORY_STATUS_META: Record<
  string,
  { label: string; tone: Tone }
> = {
  NOT_REQUIRED: { label: 'Not required', tone: 'muted' },
  NOT_SUBMITTED: { label: 'Not submitted', tone: 'muted' },
  QUEUED: { label: 'Queued', tone: 'info' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  ACKNOWLEDGED: { label: 'Awaiting TIRA', tone: 'info' },
  ACCEPTED: { label: 'Accepted by TIRA', tone: 'success' },
  REJECTED: { label: 'Rejected by TIRA', tone: 'danger' },
  RETRYABLE: { label: 'Retry needed', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
  RECONCILIATION_REQUIRED: { label: 'Needs reconciliation', tone: 'warning' },
};

export const TIRA_OPERATION_LABELS: Record<string, string> = {
  NOTIFICATION: 'Claim notification',
  INTIMATION: 'Claim intimation',
  ASSESSMENT: 'Claim assessment',
  DISCHARGE_VOUCHER: 'Discharge voucher',
  PAYMENT: 'Claim payment',
  REJECTION: 'Claim rejection',
};

export interface ClaimQueueMeta {
  queue: ClaimQueue;
  label: string;
  title: string;
  /** Statuses listed under this menu (CLAIM_QUEUE_STATUSES in the backend). */
  statuses: ClaimStatus[];
}

export const CLAIM_QUEUES: ClaimQueueMeta[] = [
  {
    queue: 'notification',
    label: 'Claim Notification',
    title: 'Claim notification',
    statuses: ['DRAFT', 'NOTIFICATION_SUBMITTED', 'NOTIFICATION_FAILED'],
  },
  {
    queue: 'intimation',
    label: 'Claim Intimation',
    title: 'Claim intimation',
    statuses: [
      'NOTIFICATION_ACCEPTED',
      'INTIMATION_PENDING',
      'INTIMATION_SUBMITTED',
      'INTIMATION_FAILED',
    ],
  },
  {
    queue: 'assessment',
    label: 'Claim Assessment',
    title: 'Claim assessment',
    statuses: [
      'INTIMATED',
      'ASSESSMENT_PENDING',
      'UNDER_ASSESSMENT',
      'ASSESSED',
      'REASSESSMENT_REQUIRED',
      'PENDING_APPROVAL',
      'REOPENED',
    ],
  },
  {
    queue: 'discharge',
    label: 'Discharge Voucher',
    title: 'Discharge vouchers',
    statuses: [
      'APPROVED',
      'DISCHARGE_PENDING',
      'DISCHARGE_ISSUED',
      'DISCHARGE_REJECTED',
    ],
  },
  {
    queue: 'payment',
    label: 'Claim Payment',
    title: 'Claim payments',
    statuses: [
      'DISCHARGE_ACCEPTED',
      'PAYMENT_PENDING',
      'PARTIALLY_PAID',
      'PAID',
    ],
  },
  {
    queue: 'rejection',
    label: 'Claim Rejection',
    title: 'Claim rejections',
    statuses: ['REJECTION_PENDING', 'REJECTED'],
  },
];

export function getClaimQueueMeta(queue: string | undefined) {
  return CLAIM_QUEUES.find((meta) => meta.queue === queue) ?? null;
}

export const CLAIMANT_TYPE_OPTIONS: Array<{
  value: ClaimantType;
  label: string;
}> = [
  { value: 'POLICYHOLDER', label: 'Policyholder' },
  { value: 'INSURED', label: 'Insured' },
  { value: 'THIRD_PARTY', label: 'Third party' },
  { value: 'BENEFICIARY', label: 'Beneficiary' },
  { value: 'SERVICE_PROVIDER', label: 'Service provider' },
  { value: 'OTHER', label: 'Other' },
];

/** TIRAMIS v1.3 identification types (§10.1). */
export const ID_TYPE_OPTIONS = [
  { value: '1', label: 'National ID (NIN)' },
  { value: '2', label: 'Voter registration number' },
  { value: '3', label: 'Passport' },
  { value: '4', label: 'Driving licence' },
  { value: '5', label: 'Zanzibar resident ID (ZANID)' },
  { value: '6', label: 'Tax identification number (TIN)' },
  { value: '7', label: 'Company incorporation certificate' },
] as const;

export const PARTY_TYPE_OPTIONS = [
  { value: '1', label: 'Individual' },
  { value: '2', label: 'Corporate' },
] as const;

export const CLAIMANT_CATEGORY_OPTIONS = [
  { value: '1', label: 'Policyholder' },
  { value: '2', label: 'Third party' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
] as const;

export const NOTIFICATION_SOURCE_OPTIONS: Array<{
  value: NotificationSource;
  label: string;
}> = [
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PORTAL', label: 'Portal' },
  { value: 'INTERMEDIARY', label: 'Intermediary' },
  { value: 'OTHER', label: 'Other' },
];

export const PRIORITY_OPTIONS: Array<{ value: ClaimPriority; label: string }> =
  [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
  ];

/** TIRAMIS payment modes (§13.1). */
export const PAYMENT_MODE_OPTIONS = [
  { value: '1', label: 'Cash' },
  { value: '2', label: 'Cheque' },
  { value: '3', label: 'EFT / bank transfer' },
];

/** Claim stages a document requirement can apply to (CLAIM_DOCUMENT_STAGES). */
export const CLAIM_DOCUMENT_STAGES = [
  'NOTIFICATION',
  'INTIMATION',
  'ASSESSMENT',
  'DISCHARGE',
  'PAYMENT',
  'REJECTION',
] as const;

export const DOCUMENT_STATUS_META: Record<
  string,
  { label: string; tone: Tone }
> = {
  UPLOADED: { label: 'Awaiting verification', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};
