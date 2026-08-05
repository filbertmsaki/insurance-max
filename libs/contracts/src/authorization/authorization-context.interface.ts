import type { ApplicationAccessScope } from './authorization.enums';

export interface AuthorizationDataScope {
  companyAll: boolean;
  assignedBranches: boolean;
  ownRecordsOnly: boolean;
  partnerPortfolio: boolean;

  activeBranchId: string | null;
  assignedBranchIds: string[];
  allowedBranchIds: string[];
}

export interface AuthorizationContext {
  userId: string;
  sessionId: string;

  scope: ApplicationAccessScope;
  authorizationVersion: number;

  companyId: string | null;
  companyMembershipId: string | null;

  activeBranchId: string | null;
  assignedBranchIds: string[];

  roles: string[];
  permissions: string[];

  dataScope: AuthorizationDataScope | null;
}
