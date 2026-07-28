import { CompanyType } from '../enums/company-type.enum';

export type AuthScope = 'platform' | 'company';

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
  id: string;
  email: string;
  scope: AuthScope;
  userType: UserType;
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
  roles: string[];
  permissions: string[];
}
