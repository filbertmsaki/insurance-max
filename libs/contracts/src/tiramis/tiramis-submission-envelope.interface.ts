import type { ServiceClaimContext } from '../claims/claim.interface';
import type { ServiceReinsuranceContext } from '../reinsurance/reinsurance.interface';
import type { ServiceFinanceContext } from '../finance/finance.interface';
import type { ServiceInsuredDataContext } from '../insured-data/service-insured-data-context.interface';
import type { ServicePricingContext } from '../pricing/service-pricing-context.interface';
import type { ServicePolicyTransactionContext } from '../policy-transactions/service-policy-transaction-gate-context.interface';
import type { ServiceQuotationGateContext } from '../quotations/service-quotation-gate-context.interface';
import type {
  TiramisIntegrationCommand,
  TiramisIntegrationRequestType,
  TiramisIntegrationSchemaVersion,
  TiramisIntegrationStatus,
} from './tiramis-integration.enums';

export interface TiramisOrganizationContext {
  insurerCompanyId: string;
  operatingCompanyId: string;
  branchId: string;
  branchCode: string;
  departmentId: string | null;
  salePointId: string;
  salePointCode: string;
  companyMembershipId: string;
}

export interface TiramisDistributionContext {
  relationshipId: string | null;
  distributionChannelId: string;
  channelType: string;
  intermediaryCompanyId: string | null;
  intermediaryAgentId: string | null;
  transactionCompanyCode: string;
  commissionRate: string | null;
  commissionAmount: string | null;
}

export interface TiramisProductContext {
  productId: string;
  productVersionId: string;
  productCode: string;
  productDefinitionHash: string;
  insuranceCategoryCode: string;
  insuranceSubClassCode: string | null;
  riskCodes: string[];
}

export interface TiramisSubmissionContext {
  organization: TiramisOrganizationContext;
  distribution: TiramisDistributionContext;
  product: TiramisProductContext;
  pricing: ServicePricingContext | null;
  insuredData: ServiceInsuredDataContext | null;
  quotationGate: ServiceQuotationGateContext | null;
  finance: ServiceFinanceContext | null;
  policyTransaction: ServicePolicyTransactionContext | null;
  claim: ServiceClaimContext | null;
  reinsurance: ServiceReinsuranceContext | null;
}

export interface TiramisSubmissionSource {
  service: 'insurance-portal-service';
  companyId: string;
  userId: string | null;
  module: string;
  recordId: string;
  workflowRevision: number | null;
  quotationId: string | null;
  policyId: string | null;
  businessReference: string;
}

export interface TiramisSubmissionHashes {
  payloadHash: string;
  contextHash: string;
  envelopeHash: string;
}

export interface TiramisSubmissionEnvelope<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  schemaVersion: typeof TiramisIntegrationSchemaVersion.V1;
  contractVersion: '1.0';
  command: TiramisIntegrationCommand;
  requestType: TiramisIntegrationRequestType;
  environment: 'test' | 'live';
  idempotencyKey: string;
  correlationId: string;
  causationId: string | null;
  source: TiramisSubmissionSource;
  context: TiramisSubmissionContext;
  payload: TPayload;
  hashes: TiramisSubmissionHashes;
  createdAt: string;
}

export interface TiramisSubmissionAcceptance {
  schemaVersion: typeof TiramisIntegrationSchemaVersion.V1;
  transactionId: string;
  requestId: string;
  status: TiramisIntegrationStatus;
  serviceType: string;
  rootElement: string;
  idempotencyKey: string;
  correlationId: string;
  duplicate: boolean;
  acceptedAt: string;
  resourceVersion: number;
}
