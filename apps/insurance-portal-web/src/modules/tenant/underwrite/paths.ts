import type { UnderwriteLineSlug } from '@insurance-max/contracts';

type LineSegment = UnderwriteLineSlug | ':line';

/** Route paths for the Underwrite module. */
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
  customerCreate: (line: LineSegment) => `/underwrite/${line}/customers/new`,
  customerDetail: (line: LineSegment, id: string) =>
    `/underwrite/${line}/customers/${id}`,
  customerEdit: (line: LineSegment, id: string) =>
    `/underwrite/${line}/customers/${id}/edit`,
  renewals: (line: LineSegment) => `/underwrite/${line}/renewals`,
  endorsements: (line: LineSegment) => `/underwrite/${line}/endorsements`,
  cancellations: (line: LineSegment) => `/underwrite/${line}/cancellations`,
  tiraFailed: (line: LineSegment) => `/underwrite/${line}/tira-failed`,
  tiraPending: (line: LineSegment) => `/underwrite/${line}/tira-pending`,
  motorVehicles: '/underwrite/motor/vehicles',
  motorVehicleCreate: '/underwrite/motor/vehicles/new',
  motorVehicleDetail: (id: string) => `/underwrite/motor/vehicles/${id}`,
  motorVehicleEdit: (id: string) => `/underwrite/motor/vehicles/${id}/edit`,
  fleetRegister: '/underwrite/fleet/fleets',
  fleetCreate: '/underwrite/fleet/fleets/new',
  fleetDetail: (id: string) => `/underwrite/fleet/fleets/${id}`,
  fleetEdit: (id: string) => `/underwrite/fleet/fleets/${id}/edit`,
  nonMotorRisks: '/underwrite/non-motor/risks',
  nonMotorRiskCreate: '/underwrite/non-motor/risks/new',
  nonMotorRiskDetail: (id: string) => `/underwrite/non-motor/risks/${id}`,
  nonMotorRiskEdit: (id: string) => `/underwrite/non-motor/risks/${id}/edit`,
  riskSchemas: '/underwrite/non-motor/risk-schemas',
} as const;

export const defaultUnderwriteLine = 'motor';

/**
 * Temporary bridge for shared screens that are not yet line-aware. It keeps
 * their navigation on the active Underwrite module and off the removed legacy
 * route namespace.
 */
export const sharedUnderwritePaths = {
  quotations: underwritePaths.quotations(defaultUnderwriteLine),
  quotationCreate: underwritePaths.quotationCreate(defaultUnderwriteLine),
  quotationWizard: underwritePaths.quotationCreate(defaultUnderwriteLine),
  quotationWizardEdit: (id: string) =>
    underwritePaths.quotationEdit(defaultUnderwriteLine, id),
  quotationDetail: (id: string) =>
    underwritePaths.quotationDetail(defaultUnderwriteLine, id),
  quotationEdit: (id: string) =>
    underwritePaths.quotationEdit(defaultUnderwriteLine, id),
  quotationPayment: (id: string) =>
    underwritePaths.quotationDetail(defaultUnderwriteLine, id),
  policies: underwritePaths.policies(defaultUnderwriteLine),
  policyDetail: (id: string) =>
    underwritePaths.policyDetail(defaultUnderwriteLine, id),
  policyEdit: (id: string) =>
    underwritePaths.policyDetail(defaultUnderwriteLine, id),
  endorsements: underwritePaths.endorsements(defaultUnderwriteLine),
  renewals: underwritePaths.renewals(defaultUnderwriteLine),
  policyEndorsementCreate: (policyId: string) =>
    underwritePaths.policyEndorsementCreate(defaultUnderwriteLine, policyId),
  policyEndorsementEdit: (policyId: string, endorsementId: string) =>
    underwritePaths.policyEndorsementEdit(
      defaultUnderwriteLine,
      policyId,
      endorsementId,
    ),
  policyCancellationCreate: (policyId: string) =>
    underwritePaths.policyCancellationCreate(defaultUnderwriteLine, policyId),
  policyCancellationDetail: (policyId: string, cancellationId: string) =>
    underwritePaths.policyCancellationDetail(
      defaultUnderwriteLine,
      policyId,
      cancellationId,
    ),
  policyRenewalDetail: (policyId: string, renewalId: string) =>
    underwritePaths.policyRenewalDetail(
      defaultUnderwriteLine,
      policyId,
      renewalId,
    ),
  customers: underwritePaths.customers(defaultUnderwriteLine),
  customerCreate: underwritePaths.customerCreate(defaultUnderwriteLine),
  customerDetail: (id: string) =>
    underwritePaths.customerDetail(defaultUnderwriteLine, id),
  customerEdit: (id: string) =>
    underwritePaths.customerEdit(defaultUnderwriteLine, id),
  motorVehicles: underwritePaths.motorVehicles,
  motorVehicleCreate: underwritePaths.motorVehicleCreate,
  motorVehicleDetail: underwritePaths.motorVehicleDetail,
  motorVehicleEdit: underwritePaths.motorVehicleEdit,
  motorFleets: underwritePaths.fleetRegister,
  motorFleetCreate: underwritePaths.fleetCreate,
  motorFleetDetail: underwritePaths.fleetDetail,
  motorFleetEdit: underwritePaths.fleetEdit,
  nonMotorSubjectMatters: underwritePaths.nonMotorRisks,
  nonMotorSubjectMatterCreate: underwritePaths.nonMotorRiskCreate,
  nonMotorSubjectMatterDetail: underwritePaths.nonMotorRiskDetail,
  nonMotorSubjectMatterEdit: underwritePaths.nonMotorRiskEdit,
  submissions: '/tiramis/submissions',
  submissionDetail: (id: string) => `/tiramis/submissions/${id}`,
} as const;
