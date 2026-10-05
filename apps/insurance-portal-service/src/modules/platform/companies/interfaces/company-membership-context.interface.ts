import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';
import type { PermissionDataScopeAssignment } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

export interface CompanySummary {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyType: CompanyType;
  membershipId: string;
  isDefault: boolean;
  roles: string[];
  permissions: string[];
  activeBranchId?: string | null;
  activeBranchCode?: string | null;
  activeBranchName?: string | null;
  defaultSalePointId?: string | null;
  defaultSalePointCode?: string | null;
  defaultSalePointName?: string | null;
  assignedBranchIds?: string[];
  activeDepartmentId?: string | null;
  activeDepartmentCode?: string | null;
  activeDepartmentName?: string | null;
  assignedDepartmentIds?: string[];
  quotationPolicyDataScope: QuotationPolicyDataScope;
  permissionDataScopes?: PermissionDataScopeAssignment[];
  authorizationVersion: number;
}

export interface CompanyMembershipContext extends CompanySummary {
  status: string;
}
