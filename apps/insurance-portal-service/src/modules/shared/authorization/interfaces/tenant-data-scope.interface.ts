import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

export interface TenantDataScope {
  userId: string;
  companyId: string;
  companyType: CompanyType;
  companyMembershipId: string;

  activeBranchId: string | null;
  assignedBranchIds: string[];
  allowedBranchIds: string[];

  canViewAllBranches: boolean;
  canViewAssignedBranches: boolean;
  ownRecordsOnly: boolean;

  canViewCarrierPortfolio: boolean;
  canViewIntermediaryPortfolio: boolean;

  permissions: string[];
}
