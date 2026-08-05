export interface OrganizationCompanyContext {
  id: string;
  name: string;
  slug: string;
  companyType: string;
  timezone: string;
  currency: string;
}

export interface OrganizationBranchContext {
  id: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
}

export interface OrganizationDepartmentContext {
  id: string;
  code: string;
  name: string;
  branchId: string | null;
}

export interface OrganizationSalePointContext {
  id: string;
  code: string;
  name: string | null;
  branchId: string;
}

export interface OrganizationTiramisContext {
  enabled: boolean;
  environment: 'test' | 'live';
  configured: boolean;
  validated: boolean;
  ready: boolean;

  companyCode: string | null;
  insurerCompanyCode: string | null;
  clientCode: string | null;
  systemCode: string | null;
  systemName: string | null;

  missingRequirements: string[];
}

export interface OrganizationContext {
  companyMembershipId: string;

  company: OrganizationCompanyContext;

  activeBranch: OrganizationBranchContext | null;

  assignedBranches: OrganizationBranchContext[];

  activeDepartment: OrganizationDepartmentContext | null;

  assignedDepartments: OrganizationDepartmentContext[];

  defaultSalePoint: OrganizationSalePointContext | null;

  tiramis: OrganizationTiramisContext;
}
