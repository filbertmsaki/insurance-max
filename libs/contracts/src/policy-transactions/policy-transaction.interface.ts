import type {
  WorkflowApprovalStatus,
  WorkflowPaymentStatus,
  WorkflowSubmissionStatus,
} from '../quotations/quotation-workflow.enums';
import type {
  PolicyChangeCategory,
  PolicyTransactionChangeType,
  PolicyTransactionPremiumEffect,
  PolicyTransactionStage,
  PolicyTransactionType,
} from './policy-transaction.enums';

export interface PolicyTransactionChange {
  id: string;
  category: PolicyChangeCategory;
  operation: PolicyTransactionChangeType;
  fieldPath: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  isMaterial: boolean;
  requiresRepricing: boolean;
  requiresRegulatorySubmission: boolean;
}

export interface PolicyTransactionPricingSnapshot {
  sourcePolicyPremium: string;
  revisedFullTermPremium: string;
  earnedPremiumBeforeChange: string;
  remainingOldPremium: string;
  remainingNewPremium: string;
  premiumDifference: string;
  taxDifference: string;
  chargeDifference: string;
  commissionDifference: string;
  customerPayableDifference: string;
  premiumEffect: PolicyTransactionPremiumEffect;
  currencyCode: string;
  effectiveDate: string;
  calculationMethod: string;
  pricingResultHashes: string[];
  snapshotHash: string;
}

export interface PolicyTransactionBlockingReason {
  code: string;
  message: string;
  section: string;
  action: string | null;
}

export interface PolicyTransactionWorkflowView {
  id: string;
  transactionNumber: string;
  type: PolicyTransactionType;
  stage: PolicyTransactionStage;
  sourcePolicyId: string;
  sourcePolicyNumber: string;
  sourcePolicyVersion: number;
  effectiveDate: string;
  approvalStatus: WorkflowApprovalStatus;
  paymentStatus: WorkflowPaymentStatus;
  submissionStatus: WorkflowSubmissionStatus;
  pricing: PolicyTransactionPricingSnapshot | null;
  availableActions: string[];
  blockingReasons: PolicyTransactionBlockingReason[];
  stateVersion: number;
}
