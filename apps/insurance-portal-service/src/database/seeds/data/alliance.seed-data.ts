import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

export const ALLIANCE_TENANT = {
  companyCode: 'ICC110',
  companyName: 'ALLIANCE INSURANCE CORPORATION',
  identifierPrefix: 'AICL',
  insurerCompanyCode: 'ICC110',
  insurerCompanyName: 'ALLIANCE INSURANCE CORPORATION',
  clientCode: 'ICC110',
  systemCode: 'LSYS_ALLIANCE_001',
  systemName: 'ALLIANCE INSURANCE SYSTEM',
  companyType: CompanyType.INSURANCE_COMPANY,
  slug: 'alliance-insurance-corporation',
  currency: 'TZS',
  timezone: 'Africa/Dar_es_Salaam',
} as const;

export const ALLIANCE_BRANCHES = [
  {
    branchCode: 'BR207',
    branchName: 'HQ',
  },
  {
    branchCode: 'BR208',
    branchName: 'ARUSHA',
  },
  {
    branchCode: 'BR209',
    branchName: 'MWANZA',
  },
  {
    branchCode: 'BR210',
    branchName: 'MOSHI',
  },
] as const;

export const ALLIANCE_SALE_POINTS = [
  {
    branchCode: 'BR207',
    salePointCode: 'SP500',
    salePointName: 'HQ',
    isDefault: true,
  },
  {
    branchCode: 'BR207',
    salePointCode: 'SP501',
    salePointName: 'DSM',
    isDefault: false,
  },
  {
    branchCode: 'BR208',
    salePointCode: 'SP502',
    salePointName: 'ARUSHA',
    isDefault: true,
  },
  {
    branchCode: 'BR209',
    salePointCode: 'SP503',
    salePointName: 'MWANZA',
    isDefault: true,
  },
  {
    branchCode: 'BR210',
    salePointCode: 'SP504',
    salePointName: 'MOSHI',
    isDefault: true,
  },
] as const;
