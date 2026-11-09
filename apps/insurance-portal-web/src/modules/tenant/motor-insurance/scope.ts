import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import type { PolicyTransactionScope } from '@/modules/tenant/policies/transaction-scope';
import { buildUnderwriteTransactionScope } from '@/modules/tenant/underwrite/transaction-scope';
import { motorInsurancePaths } from './paths';

/**
 * The line's policy-transaction scope (line-scoped endpoints, Fleet vehicle
 * endorsement panel for fleets) with every link kept inside the Motor
 * Insurance module: policies, quotations, endorsements, cancellations and
 * renewals.
 */
export function buildMotorInsuranceScope(
  slug: UnderwriteLineSlug,
): PolicyTransactionScope {
  const base = buildUnderwriteTransactionScope(slug);
  return {
    ...base,
    paths: {
      ...base.paths,
      policies: motorInsurancePaths.policies,
      policyDetail: (id) => motorInsurancePaths.policyDetail(id),
      quotationDetail: (id) => motorInsurancePaths.quotationDetail(id),
      quotationWizardEdit: (id) => motorInsurancePaths.quotationEdit(id),
      policyEndorsementCreate: (policyId) =>
        motorInsurancePaths.policyEndorsementCreate(policyId),
      policyEndorsementEdit: (policyId, endorsementId) =>
        motorInsurancePaths.policyEndorsementEdit(policyId, endorsementId),
      policyCancellationCreate: (policyId) =>
        motorInsurancePaths.policyCancellationCreate(policyId),
      policyCancellationDetail: (policyId, cancellationId) =>
        motorInsurancePaths.policyCancellationDetail(policyId, cancellationId),
      policyRenewalDetail: (policyId, renewalId) =>
        motorInsurancePaths.policyRenewalDetail(policyId, renewalId),
    },
  };
}
