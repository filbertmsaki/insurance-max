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

  /**
   * Underwriting covers (UnderwriteCover values) whose quotations this scope
   * may reach; `null` means not cover-restricted. Applied together with the
   * branch/department/user scope above. See `resolveCoverScope`.
   */
  quotationCovers?: string[] | null;
  /** Same for policies (cover of the source quotation, else the line). */
  policyCovers?: string[] | null;

  permissions: string[];
}
