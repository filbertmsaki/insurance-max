import type { ClaimRegulatoryOperationType } from './claim.enums';

export interface ServiceClaimContext {
  claimId: string;
  claimNumber: string;

  policyId: string;
  policyNumber: string;

  policyVersionId: string;
  policyVersionNumber: number;

  lossDate: string;

  coverageSnapshotHash: string;
  incidentSnapshotHash: string;
  claimantManifestHash: string;

  reserveSnapshotHash: string | null;
  assessmentSnapshotHash: string | null;
  dischargeSnapshotHash: string | null;
  paymentSnapshotHash: string | null;

  operationType: ClaimRegulatoryOperationType;
  operationRecordId: string;
  operationNumber: string;
}

export interface ClaimDisbursementEvent {
  eventId: string;
  companyId: string;

  claimId: string;
  claimPaymentId: string;

  disbursementId: string;

  eventType:
    | 'DISBURSEMENT_PROCESSING'
    | 'DISBURSEMENT_PAID'
    | 'DISBURSEMENT_FAILED'
    | 'DISBURSEMENT_REVERSED';

  amount: string;
  currencyCode: string;

  paymentReference: string | null;
  paidAt: string | null;

  occurredAt: string;
}
