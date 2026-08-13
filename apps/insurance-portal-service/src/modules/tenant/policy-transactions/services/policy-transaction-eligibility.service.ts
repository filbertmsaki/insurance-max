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
    effectiveDate?: string,
  ): Promise<PolicyTransactionEligibilityResult> {
    const blockers: PolicyTransactionEligibilityBlocker[] = [];

    const allowedStatuses = ['COVER_NOTE_ISSUED', 'ACTIVE'];

    if (!allowedStatuses.includes(policy.policy_status)) {
      blockers.push({
        code: 'POLICY_STATUS_NOT_ELIGIBLE',
        message:
          type === PolicyTransactionType.ENDORSEMENT
            ? 'Only an issued or active policy can be endorsed.'
            : 'Only an active policy can be changed.',
      });
    }

    if (!policy.issued_by_system || !policy.quotation_id) {
      blockers.push({
        code: 'POLICY_NOT_SYSTEM_ISSUED',
        message:
          'The policy was not created from a successful TIRAMIS issuance.',
      });
    }

    if (policy.tira_status !== 'SUCCESS') {
      blockers.push({
        code: 'ORIGINAL_TIRAMIS_ISSUANCE_NOT_SUCCESSFUL',
        message: 'The original TIRAMIS issuance is not successful.',
      });
    }

    if (policy.pending_transaction_id) {
      blockers.push({
        code: 'POLICY_TRANSACTION_ALREADY_ACTIVE',
        message: 'The policy already has an active policy transaction.',
      });
    }

    let currentVersion: PolicyVersion | null = null;

    if (policy.active_version_id) {
      currentVersion = await manager.getRepository(PolicyVersion).findOne({
        where: {
          id: policy.active_version_id,
          company_id: policy.company_id,
          policy_id: policy.id,
        },
      });
    }

    if (!currentVersion) {
      currentVersion = await manager.getRepository(PolicyVersion).findOne({
        where: {
          company_id: policy.company_id,
          policy_id: policy.id,
          is_current: true,
        },
        order: {
          version_number: 'DESC',
        },
      });
    }

    if (!currentVersion) {
      blockers.push({
        code: 'CURRENT_POLICY_VERSION_MISSING',
        message: 'The current policy version could not be resolved.',
      });
    }

    if (currentVersion) {
      const snapshotVersion = Number(
        currentVersion.policy_snapshot?.['schemaVersion'] ?? 1,
      );

      if (snapshotVersion < 2) {
        blockers.push({
          code: 'POLICY_SNAPSHOT_REQUIRES_UPGRADE',
          message:
            type === PolicyTransactionType.CANCELLATION
              ? 'The policy does not contain the complete immutable contract snapshot required for cancellation.'
              : 'The policy must have a complete Policy V1 snapshot before it can be endorsed.',
        });
      }

      const regulatoryReference =
        currentVersion.regulatory_reference ?? policy.cover_note_no;

      if (!regulatoryReference) {
        blockers.push({
          code: 'ORIGINAL_COVER_NOTE_REFERENCE_MISSING',
          message:
            type === PolicyTransactionType.CANCELLATION
              ? 'The current TIRAMIS cover-note reference could not be resolved.'
              : 'The original TIRAMIS cover-note reference is required before endorsement.',
        });
      }
    }

    if (effectiveDate) {
      if (
        effectiveDate < policy.start_date ||
        effectiveDate > policy.end_date
      ) {
        blockers.push({
          code: 'EFFECTIVE_DATE_OUTSIDE_POLICY_PERIOD',
          message:
            'The endorsement effective date must be inside the policy period.',
        });
      }

      if (currentVersion && effectiveDate < currentVersion.effective_from) {
        blockers.push({
          code: 'TRANSACTION_PRECEDES_CURRENT_VERSION',
          message:
            'The endorsement effective date cannot precede the current policy version.',
        });
      }
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
