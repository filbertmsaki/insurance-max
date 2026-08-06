import type { WorkflowApprovalStatus, WorkflowPaymentStatus, WorkflowSubmissionStatus } from '../quotations/quotation-workflow.enums';
import type {
  PolicyTransactionPremiumEffect,
  PolicyTransactionStage,
  PolicyTransactionType,
} from './policy-transaction.enums';

export interface ServicePolicyTransactionContext {
  transactionId: string;
  transactionNumber: string;
  transactionType: PolicyTransactionType;
  stage: PolicyTransactionStage;
  sourcePolicyId: string;
  sourcePolicyNumber: string;
  sourcePolicyVersion: number;
  effectiveDate: string;
  sourceSnapshotHash: string;
  proposedSnapshotHash: string | null;
  pricingSnapshotHash: string | null;
  premiumEffect: PolicyTransactionPremiumEffect;
  additionalPremium: string;
  returnPremium: string;
  approvalStatus: WorkflowApprovalStatus;
  paymentStatus: WorkflowPaymentStatus;
  submissionStatus: WorkflowSubmissionStatus;
}
