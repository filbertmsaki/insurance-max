import type {
  QuotationApprovalStatus,
  QuotationCommand,
  QuotationPaymentMode,
  QuotationPaymentStatus,
  QuotationStage,
  QuotationSubmissionStatus,
} from './quotation-workflow.enums';

export interface QuotationBlockingReason {
  code: string;
  message: string;
  field?: string | null;
}

export interface QuotationApprovalSummary {
  required: boolean;
  status: QuotationApprovalStatus;
  assignedToUserId?: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  comments?: string | null;
  reason?: string | null;
}

export interface QuotationPaymentSummary {
  required: boolean;
  status: QuotationPaymentStatus;
  mode?: QuotationPaymentMode | null;
  reference?: string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
  failureReason?: string | null;
}

export interface QuotationSubmissionSummary {
  status: QuotationSubmissionStatus;
  requestId?: string | null;
  responseId?: string | null;
  submittedAt?: string | null;
  acknowledgedAt?: string | null;
  acceptedAt?: string | null;
  failureReason?: string | null;
}

export interface QuotationWorkflowView {
  quotationId: string;
  quotationNumber: string;
  workflowRevision: number;
  quotationStage: QuotationStage;
  approval: QuotationApprovalSummary;
  payment: QuotationPaymentSummary;
  submission: QuotationSubmissionSummary;
  finalizationHash?: string | null;
  workflowGateHash?: string | null;
  completedAt?: string | null;
  blockingReasons: QuotationBlockingReason[];
  availableCommands: Partial<Record<QuotationCommand, boolean>>;
}
