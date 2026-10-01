import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { policiesApi } from '@/modules/tenant/policies/api';
import type { PolicyTransactionScope } from '@/modules/tenant/policies/transaction-scope';
import { underwriteApi } from './api';
import { underwritePaths } from './paths';
import { FleetVehicleEndorsementPanel } from './fleet/FleetVehicleEndorsementPanel';

/**
 * Runs the shared policy detail / endorsement / cancellation / renewal screens
 * against the line-scoped endpoints, so every write also passes the
 * `underwrite.<line>.*` gate and the wrong-line 404. Calls without a line
 * endpoint (versions, reconciliation, claim review, endorsement types) fall
 * through to the legacy API.
 */
export function buildUnderwriteTransactionScope(
  line: UnderwriteLineSlug,
): PolicyTransactionScope {
  return {
    api: {
      ...policiesApi,
      getEndorsementEligibility: (policyId, effectiveDate) =>
        underwriteApi.getEndorsementEligibility(line, policyId, effectiveDate),
      createEndorsement: (policyId, payload) =>
        underwriteApi.createEndorsement(line, policyId, payload),
      getEndorsementContext: (id) =>
        underwriteApi.getEndorsementContext(line, id),
      recordEndorsementChange: (id, payload) =>
        underwriteApi.recordEndorsementChange(line, id, payload),
      recalculateEndorsement: (id) =>
        underwriteApi.recalculateEndorsement(line, id),
      completeEndorsement: (id) => underwriteApi.completeEndorsement(line, id),
      submitEndorsementApproval: (id) =>
        underwriteApi.submitEndorsementApproval(line, id),
      approveEndorsement: (id) => underwriteApi.approveEndorsement(line, id),
      rejectEndorsement: (id, reason) =>
        underwriteApi.rejectEndorsement(line, id, reason),
      requestEndorsementChanges: (id, reason) =>
        underwriteApi.requestEndorsementChanges(line, id, reason),
      cancelEndorsement: (id, reason) =>
        underwriteApi.cancelEndorsement(line, id, reason),
      requestEndorsementPayment: (id) =>
        underwriteApi.requestEndorsementPayment(line, id),
      submitEndorsementToTiramis: (id) =>
        underwriteApi.submitEndorsementToTiramis(line, id),
      retryEndorsementTiramis: (id) =>
        underwriteApi.retryEndorsementTiramis(line, id),

      getCancellationEligibility: (policyId, effectiveDate) =>
        underwriteApi.getCancellationEligibility(line, policyId, effectiveDate),
      createCancellation: (policyId, payload) =>
        underwriteApi.createCancellation(line, policyId, payload),
      getCancellationContext: (id) =>
        underwriteApi.getCancellationContext(line, id),
      completeCancellation: (id) =>
        underwriteApi.completeCancellation(line, id),
      submitCancellationApproval: (id) =>
        underwriteApi.submitCancellationApproval(line, id),
      approveCancellation: (id) => underwriteApi.approveCancellation(line, id),
      rejectCancellation: (id, reason) =>
        underwriteApi.rejectCancellation(line, id, reason),
      requestCancellationChanges: (id, reason) =>
        underwriteApi.requestCancellationChanges(line, id, reason),
      withdrawCancellation: (id, reason) =>
        underwriteApi.cancelCancellation(line, id, reason),
      requestCancellationPayment: (id) =>
        underwriteApi.requestCancellationPayment(line, id),
      submitCancellationToTiramis: (id) =>
        underwriteApi.submitCancellationToTiramis(line, id),

      getRenewalEligibility: (policyId) =>
        underwriteApi.getRenewalEligibility(line, policyId),
      createRenewal: (policyId) => underwriteApi.createRenewal(line, policyId),
      getRenewalContext: (id) => underwriteApi.getRenewalContext(line, id),
      createRenewalOffer: (id) => underwriteApi.createRenewalOffer(line, id),
      sendRenewalOffer: (id) => underwriteApi.sendRenewalOffer(line, id),
      acceptRenewal: (id) => underwriteApi.acceptRenewal(line, id),
      declineRenewal: (id, reason) =>
        underwriteApi.declineRenewal(line, id, reason),
    },
    ...(line === 'fleet'
      ? { FleetVehiclePanel: FleetVehicleEndorsementPanel }
      : {}),
    paths: {
      policies: underwritePaths.policies(line),
      policyDetail: (id) => underwritePaths.policyDetail(line, id),
      quotationDetail: (id) => underwritePaths.quotationDetail(line, id),
      quotationWizardEdit: (id) => underwritePaths.quotationEdit(line, id),
      policyEndorsementCreate: (policyId) =>
        underwritePaths.policyEndorsementCreate(line, policyId),
      policyEndorsementEdit: (policyId, id) =>
        underwritePaths.policyEndorsementEdit(line, policyId, id),
      policyCancellationCreate: (policyId) =>
        underwritePaths.policyCancellationCreate(line, policyId),
      policyCancellationDetail: (policyId, id) =>
        underwritePaths.policyCancellationDetail(line, policyId, id),
      policyRenewalDetail: (policyId, id) =>
        underwritePaths.policyRenewalDetail(line, policyId, id),
    },
  };
}
