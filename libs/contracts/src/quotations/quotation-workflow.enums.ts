export const QuotationStage = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  SUBMISSION_PROCESSING: 'SUBMISSION_PROCESSING',
  SUBMITTED: 'SUBMITTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type QuotationStage =
  (typeof QuotationStage)[keyof typeof QuotationStage];

export const QuotationApprovalStatus = {
  NOT_EVALUATED: 'NOT_EVALUATED',
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type QuotationApprovalStatus =
  (typeof QuotationApprovalStatus)[keyof typeof QuotationApprovalStatus];

export const QuotationPaymentStatus = {
  NOT_EVALUATED: 'NOT_EVALUATED',
  NOT_REQUIRED: 'NOT_REQUIRED',
  NOT_REQUESTED: 'NOT_REQUESTED',
  REQUESTED: 'REQUESTED',
  PROCESSING: 'PROCESSING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
} as const;

export type QuotationPaymentStatus =
  (typeof QuotationPaymentStatus)[keyof typeof QuotationPaymentStatus];

export const QuotationSubmissionStatus = {
  NOT_READY: 'NOT_READY',
  READY: 'READY',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  RETRYABLE: 'RETRYABLE',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  CANCELLED: 'CANCELLED',
} as const;

export type QuotationSubmissionStatus =
  (typeof QuotationSubmissionStatus)[keyof typeof QuotationSubmissionStatus];

export const QuotationPaymentMode = {
  INVOICE: 'INVOICE',
  DIRECT: 'DIRECT',
  CREDIT: 'CREDIT',
} as const;

export type QuotationPaymentMode =
  (typeof QuotationPaymentMode)[keyof typeof QuotationPaymentMode];

export const QuotationCommand = {
  SAVE_DRAFT: 'SAVE_DRAFT',
  SAVE_AND_CONTINUE: 'SAVE_AND_CONTINUE',
  COMPLETE: 'COMPLETE',
  SUBMIT_APPROVAL: 'SUBMIT_APPROVAL',
  APPROVE: 'APPROVE',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  REJECT: 'REJECT',
  REQUEST_PAYMENT: 'REQUEST_PAYMENT',
  SUBMIT_TIRAMIS: 'SUBMIT_TIRAMIS',
  RETRY_TIRAMIS: 'RETRY_TIRAMIS',
  CANCEL: 'CANCEL',
  DELETE: 'DELETE',
  REFRESH_CUSTOMER: 'REFRESH_CUSTOMER',
  REFRESH_ASSET: 'REFRESH_ASSET',
  RECALCULATE: 'RECALCULATE',
} as const;

export type QuotationCommand =
  (typeof QuotationCommand)[keyof typeof QuotationCommand];

export const QuotationApprovalDecision = {
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REJECTED: 'REJECTED',
} as const;

export type QuotationApprovalDecision =
  (typeof QuotationApprovalDecision)[keyof typeof QuotationApprovalDecision];

export const QuotationWorkflowEventType = {
  CREATED: 'CREATED',
  DRAFT_SAVED: 'DRAFT_SAVED',
  SECTION_COMPLETED: 'SECTION_COMPLETED',
  VALIDATION_PASSED: 'VALIDATION_PASSED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  COMPLETED: 'COMPLETED',
  APPROVAL_SUBMITTED: 'APPROVAL_SUBMITTED',
  APPROVAL_ASSIGNED: 'APPROVAL_ASSIGNED',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REJECTED: 'REJECTED',
  PAYMENT_REQUESTED: 'PAYMENT_REQUESTED',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  PAYMENT_PARTIAL: 'PAYMENT_PARTIAL',
  PAYMENT_PAID: 'PAYMENT_PAID',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  READY_FOR_SUBMISSION: 'READY_FOR_SUBMISSION',
  SUBMISSION_QUEUED: 'SUBMISSION_QUEUED',
  SUBMISSION_STARTED: 'SUBMISSION_STARTED',
  SUBMISSION_ACKNOWLEDGED: 'SUBMISSION_ACKNOWLEDGED',
  SUBMISSION_ACCEPTED: 'SUBMISSION_ACCEPTED',
  SUBMISSION_REJECTED: 'SUBMISSION_REJECTED',
  SUBMISSION_FAILED: 'SUBMISSION_FAILED',
  SUBMISSION_RETRYABLE: 'SUBMISSION_RETRYABLE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  DELETED: 'DELETED',
} as const;

export type QuotationWorkflowEventType =
  (typeof QuotationWorkflowEventType)[keyof typeof QuotationWorkflowEventType];
