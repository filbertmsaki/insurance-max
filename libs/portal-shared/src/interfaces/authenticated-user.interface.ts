import { CompanyType } from '../enums/company-type.enum';

export type AuthScope = 'platform' | 'company' | 'customer';
export type QuotationPolicyDataScope =
  | 'USER'
  | 'DEPARTMENT'
  | 'BRANCH'
  | 'COMPANY';

export interface PermissionDataScopeAssignment {
  permission: string;
  dataScope: QuotationPolicyDataScope;
  branchId?: string | null;
  departmentId?: string | null;
  source: 'ROLE' | 'DIRECT';
  explicit?: boolean;
}

export type UserType =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'STAFF'
  | 'AGENT'
  | 'BROKER'
  | 'CUSTOMER'
  | 'OWNER'
  | 'COMPANY_USER';

export const PLATFORM_USER_TYPES: UserType[] = ['SUPER_ADMIN', 'OWNER'];
export const COMPANY_USER_TYPES: UserType[] = [
  'COMPANY_ADMIN',
  'STAFF',
  'AGENT',
  'BROKER',
  'CUSTOMER',
  'COMPANY_USER',
];

export interface AuthenticatedUser {
  /**
   * System follow-ups (status sync, retry) pin the TIRAMIS environment a
   * submission was originally sent to; never set from a user request.
   */
  tiramisEnvironment?: 'test' | 'live';
  /**
   * A follow-up of an existing submission (status sync): company access and
   * environment validation don't apply. Never set from a user request.
   */
  tiramisFollowUp?: boolean;
  id: string;
  email: string;
  scope: AuthScope;
  userType: UserType;

  sessionId: string;
  accessTokenId: string;
  authorizationVersion: number;

  companyId?: string;
  companyName?: string;
  companySlug?: string;
  companyType?: CompanyType;
  companyMembershipId?: string;
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
  quotationPolicyDataScope?: QuotationPolicyDataScope;
  permissionDataScopes?: PermissionDataScopeAssignment[];
  roles: string[];
  permissions: string[];
}
