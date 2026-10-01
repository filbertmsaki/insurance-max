import { createContext, useContext, type ComponentType } from 'react';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { policiesApi } from './api';

export type PolicyTransactionApi = typeof policiesApi;

/** Navigation targets used by the policy detail and transaction screens. */
export interface PolicyTransactionPaths {
  policies: string;
  policyDetail: (id: string) => string;
  quotationDetail: (id: string) => string;
  quotationWizardEdit: (id: string) => string;
  policyEndorsementCreate: (policyId: string) => string;
  policyEndorsementEdit: (policyId: string, endorsementId: string) => string;
  policyCancellationCreate: (policyId: string) => string;
  policyCancellationDetail: (
    policyId: string,
    cancellationId: string,
  ) => string;
  policyRenewalDetail: (policyId: string, renewalId: string) => string;
}

/** Props of the fleet add/remove-vehicle editor on the endorsement screen. */
export interface FleetVehiclePanelProps {
  endorsementId: string;
  endorsementTypeCode: string;
  /** Proposed snapshot (with pending changes) of the endorsement. */
  snapshot: Record<string, unknown> | null;
  pricing: Record<string, unknown> | null;
  currencyCode: string;
  /** False once the endorsement has left DRAFT. */
  editable: boolean;
  /** TIRA status code of the last submission, if it failed. */
  tiraStatusCode?: string | null;
}

export interface PolicyTransactionScope {
  api: PolicyTransactionApi;
  paths: PolicyTransactionPaths;
  /**
   * Editor for 'Fleet - Add/Remove Vehicle' endorsements. Only the Underwrite
   * Fleet scope provides it; elsewhere those types are not offered.
   */
  FleetVehiclePanel?: ComponentType<FleetVehiclePanelProps>;
}

/**
 * Where the policy detail, endorsement, cancellation and renewal screens send
 * their API calls and navigation. Defaults to the legacy `/underwriting`
 * endpoints and routes; the Underwrite module provides a line-scoped scope so
 * the same screens run against `tenant/underwrite/:line/...`.
 */
export const legacyPolicyTransactionScope: PolicyTransactionScope = {
  api: policiesApi,
  paths: underwritingPaths,
};

export const PolicyTransactionScopeContext =
  createContext<PolicyTransactionScope>(legacyPolicyTransactionScope);

export function usePolicyTransactionScope() {
  return useContext(PolicyTransactionScopeContext);
}
