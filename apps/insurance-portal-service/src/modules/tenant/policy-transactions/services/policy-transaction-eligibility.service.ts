import { Injectable } from '@nestjs/common';
import { EntityManager, In, Not } from 'typeorm';
import { PolicyTransactionType } from '@insurance-max/contracts';

import { InsuranceClaim } from '../../claims/entities/claim.entity';
import { ClaimStatus } from '../../claims/enums/claim.enums';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';

export interface PolicyTransactionEligibilityBlocker {
  code: string;
  message: string;
}

export interface PolicyTransactionEligibilityResult {
  eligible: boolean;
  blockers: PolicyTransactionEligibilityBlocker[];
  currentVersion: PolicyVersion | null;
  /**
   * An open claim never blocks cancellation *creation* — it forces a
   * mandatory claims-review step before the cancellation can be completed
   * (see PolicyCancellation.claims_review_required), so it is surfaced here
   * rather than folded into `blockers`/`eligible`.
   */
  claimsReviewRequired: boolean;
}

const CLOSED_CLAIM_STATUSES = [
  ClaimStatus.CLOSED,
  ClaimStatus.REJECTED,
  ClaimStatus.CANCELLED,
];

/**
 * Reuses the Phase 9 quotation-workflow *pattern* (server-side eligibility
 * gating before a workflow object can be created/advanced) — there is no
 * shared maker-checker service in this codebase to plug into, so this is a
 * standalone equivalent scoped to policy transactions.
 */
@Injectable()
export class PolicyTransactionEligibilityService {
  async validate(
    manager: EntityManager,
    policy: Policy,
    type: PolicyTransactionType,
    effectiveDate: string,
  ): Promise<PolicyTransactionEligibilityResult> {
    const blockers: PolicyTransactionEligibilityBlocker[] = [];

    if (policy.policy_status !== 'ACTIVE') {
      blockers.push({
        code: 'POLICY_NOT_ACTIVE',
        message: 'Only an active policy can be changed.',
      });
    }

    if (policy.pending_transaction_id) {
      blockers.push({
        code: 'POLICY_TRANSACTION_ALREADY_ACTIVE',
        message: 'The policy already has an active transaction.',
      });
    }

    if (effectiveDate < policy.start_date || effectiveDate > policy.end_date) {
      blockers.push({
        code: 'EFFECTIVE_DATE_OUTSIDE_POLICY_PERIOD',
        message: 'The transaction effective date is outside the policy period.',
      });
    }

    const currentVersion = await manager.getRepository(PolicyVersion).findOne({
      where: {
        policy_id: policy.id,
        is_current: true,
      },
    });

    if (!currentVersion) {
      blockers.push({
        code: 'CURRENT_POLICY_VERSION_MISSING',
        message: 'The current policy version could not be resolved.',
      });
    }

    if (currentVersion && effectiveDate < currentVersion.effective_from) {
      blockers.push({
        code: 'TRANSACTION_PRECEDES_CURRENT_VERSION',
        message:
          'The effective date cannot precede the current policy version.',
      });
    }

    let claimsReviewRequired = false;

    if (type === PolicyTransactionType.CANCELLATION) {
      const openClaims = await manager.getRepository(InsuranceClaim).count({
        where: {
          company_id: policy.company_id,
          policy_id: policy.id,
          status: Not(In(CLOSED_CLAIM_STATUSES)),
        },
      });

      claimsReviewRequired = openClaims > 0;
    }

    return {
      eligible: blockers.length === 0,
      blockers,
      currentVersion: currentVersion ?? null,
      claimsReviewRequired,
    };
  }
}
