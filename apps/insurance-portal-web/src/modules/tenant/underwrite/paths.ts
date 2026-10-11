import type { UnderwriteLineSlug } from '@insurance-max/contracts';

type LineSegment = UnderwriteLineSlug | ':line';

/**
 * Route paths for the Underwrite module. These live alongside the legacy
 * `/underwriting` routes (see `underwritingPaths`) and never redirect to them.
 */
export const underwritePaths = {
  root: '/underwrite',
  dashboard: '/underwrite/dashboard',
  line: (line: LineSegment) => `/underwrite/${line}`,
  lineDashboard: (line: LineSegment) => `/underwrite/${line}/dashboard`,
  quotations: (line: LineSegment) => `/underwrite/${line}/quotations`,
  quotationCreate: (line: LineSegment) => `/underwrite/${line}/quotations/new`,
  quotationDetail: (line: LineSegment, id: string) =>
    `/underwrite/${line}/quotations/${id}`,
  quotationEdit: (line: LineSegment, id: string) =>
    `/underwrite/${line}/quotations/${id}/edit`,
  shortTermMotorQuotationCreate:
    '/underwrite/motor/short-term-quotations/new',
  shortTermMotorQuotationEdit: (id: string) =>
    `/underwrite/motor/short-term-quotations/${id}/edit`,
  policies: (line: LineSegment) => `/underwrite/${line}/policies`,
  policyDetail: (line: LineSegment, id: string) =>
    `/underwrite/${line}/policies/${id}`,
  policyEndorsementCreate: (line: LineSegment, policyId: string) =>
    `/underwrite/${line}/policies/${policyId}/endorsements/new`,
  policyEndorsementEdit: (
    line: LineSegment,
    policyId: string,
    endorsementId: string,
  ) => `/underwrite/${line}/policies/${policyId}/endorsements/${endorsementId}`,
  policyCancellationCreate: (line: LineSegment, policyId: string) =>
    `/underwrite/${line}/policies/${policyId}/cancellations/new`,
  policyCancellationDetail: (
    line: LineSegment,
    policyId: string,
    cancellationId: string,
  ) =>
    `/underwrite/${line}/policies/${policyId}/cancellations/${cancellationId}`,
  policyRenewalDetail: (
    line: LineSegment,
    policyId: string,
    renewalId: string,
  ) => `/underwrite/${line}/policies/${policyId}/renewals/${renewalId}`,
  customers: (line: LineSegment) => `/underwrite/${line}/customers`,
  renewals: (line: LineSegment) => `/underwrite/${line}/renewals`,
  endorsements: (line: LineSegment) => `/underwrite/${line}/endorsements`,
  cancellations: (line: LineSegment) => `/underwrite/${line}/cancellations`,
  tiraFailed: (line: LineSegment) => `/underwrite/${line}/tira-failed`,
  tiraPending: (line: LineSegment) => `/underwrite/${line}/tira-pending`,
  motorVehicles: '/underwrite/motor/vehicles',
  fleetRegister: '/underwrite/fleet/fleets',
  nonMotorRisks: '/underwrite/non-motor/risks',
  riskSchemas: '/underwrite/non-motor/risk-schemas',
} as const;
