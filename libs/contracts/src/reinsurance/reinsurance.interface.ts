import type { ReinsuranceDirection, ReinsuranceTerritory } from './reinsurance.enums';

export interface ReinsuranceExposureSnapshot {
  treatyId: string | null;
  treatySectionId: string | null;
  treatyForm: string;

  grossExposureAmount: string;
  cededAmountToDate: string;
  availableCapacity: string;
  utilizationPercentage: string;

  classOfBusiness: string | null;
  territory: ReinsuranceTerritory | null;

  breachedRuleIds: string[];
  evaluatedAt: string;
}

export interface ReinsuranceAllocationSnapshot {
  cessionId: string;
  treatyId: string | null;
  facultativePlacementId: string | null;

  grossSumInsured: string;
  retentionAmount: string;
  cededSumInsured: string;
  cededPremium: string;

  participantAllocations: Array<{
    participantCompanyId: string;
    sharePercentage: string;
    cededSumInsured: string;
    cededPremium: string;
  }>;
}

export interface ServiceReinsuranceContext {
  cessionId: string;
  treatyId: string | null;
  facultativePlacementId: string | null;

  direction: ReinsuranceDirection;

  policyId: string | null;
  policyVersionId: string | null;
  policyRiskId: string | null;

  cededSumInsured: string;
  cededPremium: string;
  retentionAmount: string;

  allocationSnapshotHash: string;

  operationType: string;
  operationRecordId: string;
  operationNumber: string;
}
