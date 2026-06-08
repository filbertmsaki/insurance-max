export interface CompanySummary {
  companyId: string;
  companyName: string;
  companySlug: string;
  membershipId: string;
  isDefault: boolean;
  roles: string[];
  permissions: string[];
}

export interface CompanyMembershipContext extends CompanySummary {
  status: string;
}
