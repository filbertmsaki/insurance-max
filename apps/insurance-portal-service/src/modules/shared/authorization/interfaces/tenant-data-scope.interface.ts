import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { QuotationPolicyDataScope } from '../quotation-policy-data-scope.enum';

export interface TenantDataScope {
  userId: string;
  companyId: string;
  companyType: CompanyType;
  companyMembershipId: string;

  activeBranchId: string | null;
  assignedBranchIds: string[];
  allowedBranchIds: string[];
  activeDepartmentId?: string | null;
  assignedDepartmentIds?: string[];
  allowedDepartmentIds?: string[];
  quotationPolicyDataScope?: QuotationPolicyDataScope;

  canViewAllBranches: boolean;
  canViewAssignedBranches: boolean;
  ownRecordsOnly: boolean;

  canViewCarrierPortfolio: boolean;
  canViewIntermediaryPortfolio: boolean;

  permissions: string[];
}
