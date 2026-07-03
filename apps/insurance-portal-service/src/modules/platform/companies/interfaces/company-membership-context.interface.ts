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
}

export interface CompanyMembershipContext extends CompanySummary {
  status: string;
}
