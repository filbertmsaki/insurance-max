import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

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
}

export interface CompanyMembershipContext extends CompanySummary {
  status: string;
}
