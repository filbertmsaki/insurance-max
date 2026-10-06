import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

export const ALLIANCE_TENANT = {
  companyCode: 'ICC739',
  companyName: 'ALLIANCE INSURANCE CORPORATION',
  identifierPrefix: 'AICL',
  insurerCompanyCode: 'ICC739',
  insurerCompanyName: 'ALLIANCE INSURANCE CORPORATION',
  clientCode: 'ICC739',
  systemCode: 'LSYS_DEMO_482',
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
    isHeadOffice: true,
  },
  {
    branchCode: 'BR208',
    branchName: 'ARUSHA',
    isHeadOffice: false,
  },
  {
    branchCode: 'BR209',
    branchName: 'MWANZA',
    isHeadOffice: false,
  },
  {
    branchCode: 'BR210',
    branchName: 'MOSHI',
    isHeadOffice: false,
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
