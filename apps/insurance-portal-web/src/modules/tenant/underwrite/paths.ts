import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { motorInsurancePaths } from '@/modules/tenant/motor-insurance/paths';

type LineSegment = UnderwriteLineSlug | ':line';
const isMotor = (line: LineSegment) => line === 'motor' || line === 'fleet';

/** Route paths for the Underwrite module. */
export const underwritePaths = {
  root: '/apps/underwrite',
  dashboard: '/apps/underwrite/dashboard',
  line: (line: LineSegment) => `/apps/underwrite/${line}`,
  lineDashboard: (line: LineSegment) => `/apps/underwrite/${line}/dashboard`,
  quotations: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.quotations
      : `/apps/underwrite/${line}/quotations`,
  quotationCreate: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.quotationCreate(
          line === 'fleet' ? 'fleet' : 'single',
        )
      : `/apps/underwrite/${line}/quotations/new`,
  quotationDetail: (line: LineSegment, id: string) =>
    isMotor(line)
      ? motorInsurancePaths.quotationDetail(id)
      : `/apps/underwrite/${line}/quotations/${id}`,
  quotationEdit: (line: LineSegment, id: string) =>
    isMotor(line)
      ? motorInsurancePaths.quotationEdit(id)
      : `/apps/underwrite/${line}/quotations/${id}/edit`,
  policies: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.policies
      : `/apps/underwrite/${line}/policies`,
  policyDetail: (line: LineSegment, id: string) =>
    isMotor(line)
      ? motorInsurancePaths.policyDetail(id)
      : `/apps/underwrite/${line}/policies/${id}`,
  policyEndorsementCreate: (line: LineSegment, policyId: string) =>
    isMotor(line)
      ? motorInsurancePaths.policyEndorsementCreate(policyId)
      : `/apps/underwrite/${line}/policies/${policyId}/endorsements/new`,
  policyEndorsementEdit: (
    line: LineSegment,
    policyId: string,
    endorsementId: string,
  ) =>
    isMotor(line)
      ? motorInsurancePaths.policyEndorsementEdit(policyId, endorsementId)
      : `/apps/underwrite/${line}/policies/${policyId}/endorsements/${endorsementId}`,
  policyCancellationCreate: (line: LineSegment, policyId: string) =>
    isMotor(line)
      ? motorInsurancePaths.policyCancellationCreate(policyId)
      : `/apps/underwrite/${line}/policies/${policyId}/cancellations/new`,
  policyCancellationDetail: (
    line: LineSegment,
    policyId: string,
    cancellationId: string,
  ) =>
    isMotor(line)
      ? motorInsurancePaths.policyCancellationDetail(policyId, cancellationId)
      : `/apps/underwrite/${line}/policies/${policyId}/cancellations/${cancellationId}`,
  policyRenewalDetail: (
    line: LineSegment,
    policyId: string,
    renewalId: string,
  ) =>
    isMotor(line)
      ? motorInsurancePaths.policyRenewalDetail(policyId, renewalId)
      : `/apps/underwrite/${line}/policies/${policyId}/renewals/${renewalId}`,
  customers: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.customers
      : `/apps/underwrite/${line}/customers`,
  customerCreate: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.customerCreate
      : `/apps/underwrite/${line}/customers/new`,
  customerDetail: (line: LineSegment, id: string) =>
    isMotor(line)
      ? motorInsurancePaths.customerDetail(id)
      : `/apps/underwrite/${line}/customers/${id}`,
  customerEdit: (line: LineSegment, id: string) =>
    isMotor(line)
      ? motorInsurancePaths.customerEdit(id)
      : `/apps/underwrite/${line}/customers/${id}/edit`,
  renewals: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.transactions('renewals')
      : `/apps/underwrite/${line}/renewals`,
  endorsements: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.transactions('endorsements')
      : `/apps/underwrite/${line}/endorsements`,
  cancellations: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.transactions('cancellations')
      : `/apps/underwrite/${line}/cancellations`,
  tiraFailed: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.failedSubmissions
      : `/apps/underwrite/${line}/tira-failed`,
  tiraPending: (line: LineSegment) =>
    isMotor(line)
      ? motorInsurancePaths.transactions('tira-pending')
      : `/apps/underwrite/${line}/tira-pending`,
  motorVehicles: '/apps/underwrite/motor/vehicles',
  motorVehicleCreate: '/apps/underwrite/motor/vehicles/new',
  motorVehicleDetail: (id: string) => `/apps/underwrite/motor/vehicles/${id}`,
  motorVehicleEdit: (id: string) =>
    `/apps/underwrite/motor/vehicles/${id}/edit`,
  nonMotorRisks: '/apps/underwrite/non-motor/risks',
  nonMotorRiskCreate: '/apps/underwrite/non-motor/risks/new',
  nonMotorRiskDetail: (id: string) => `/apps/underwrite/non-motor/risks/${id}`,
  nonMotorRiskEdit: (id: string) =>
    `/apps/underwrite/non-motor/risks/${id}/edit`,
  riskSchemas: '/apps/underwrite/non-motor/risk-schemas',
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
  nonMotorSubjectMatters: underwritePaths.nonMotorRisks,
  nonMotorSubjectMatterCreate: underwritePaths.nonMotorRiskCreate,
  nonMotorSubjectMatterDetail: underwritePaths.nonMotorRiskDetail,
  nonMotorSubjectMatterEdit: underwritePaths.nonMotorRiskEdit,
  submissions: '/apps/tiramis/submissions',
  submissionDetail: (id: string) => `/apps/tiramis/submissions/${id}`,
} as const;
