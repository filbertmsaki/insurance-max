import type { ServiceProductContext } from '../product-catalogue/product-context.interface';

export interface ServiceTenantContext {
  companyId: string;
  companyCode?: string | null;
  insurerCompanyCode?: string | null;
  systemCode?: string | null;
  clientCode?: string | null;

  branchId?: string | null;
  branchCode?: string | null;

  departmentId?: string | null;
  departmentCode?: string | null;

  salePointId?: string | null;
  salePointCode?: string | null;

  environment?: 'test' | 'live' | null;
}

export interface ServiceActorContext {
  userId: string;
  companyMembershipId?: string | null;
  sessionId?: string | null;
  roles: string[];
  permissions: string[];
}

export interface ServiceTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  scopes: string[];
  jti: string;
  iat: number;
  exp: number;

  tenant?: ServiceTenantContext;
  actor?: ServiceActorContext;
  product?: ServiceProductContext;
}

export interface ServicePrincipal {
  serviceId: string;
  scopes: string[];

  tenant?: ServiceTenantContext;
  actor?: ServiceActorContext;
  product?: ServiceProductContext;
}
