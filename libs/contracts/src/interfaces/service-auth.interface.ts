import type { ServiceProductContext } from '../product-catalogue/product-context.interface';
import type { ServicePricingContext } from '../pricing/service-pricing-context.interface';
import type { ServiceInsuredDataContext } from '../insured-data/service-insured-data-context.interface';
import type { ServiceQuotationGateContext } from '../quotations/service-quotation-gate-context.interface';
import type { ServiceFinanceContext } from '../finance/finance.interface';

export interface ServiceTenantContext {
  companyId: string;
  companyCode?: string | null;
  insurerCompanyCode?: string | null;
  systemCode?: string | null;
  clientCode?: string | null;
  clientConfigurationId?: string | null;

  branchId?: string | null;
  branchCode?: string | null;

  departmentId?: string | null;
  departmentCode?: string | null;

  salePointId?: string | null;
  salePointCode?: string | null;

  environment?: 'uat' | 'production' | null;
}

export interface ServiceActorContext {
  userId: string;
  companyMembershipId?: string | null;
  sessionId?: string | null;
  roles: string[];
  permissions: string[];
}

export interface ServicePrincipal {
  serviceId: string;
  scopes: string[];

  tenant?: ServiceTenantContext;
  actor?: ServiceActorContext;
  product?: ServiceProductContext;
  pricing?: ServicePricingContext;
  insuredData?: ServiceInsuredDataContext;
  quotationGate?: ServiceQuotationGateContext;
  finance?: ServiceFinanceContext;
}
