import type {
  QuotationApprovalStatus,
  QuotationPaymentStatus,
  QuotationStage,
  QuotationSubmissionStatus,
} from './quotation-workflow.enums';

export interface ServiceQuotationGateContext {
  quotationId: string;
  quotationNumber: string;
  workflowRevision: number;
  quotationStage: QuotationStage;
  approvalStatus: QuotationApprovalStatus;
  paymentStatus: QuotationPaymentStatus;
  submissionStatus: QuotationSubmissionStatus;
  paymentRequired: boolean;
  approvalRequired: boolean;
  finalizationHash: string;
  workflowGateHash: string;
  completedAt?: string | null;
}
