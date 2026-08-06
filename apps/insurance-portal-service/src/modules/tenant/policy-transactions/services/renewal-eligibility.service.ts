import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { PolicyTransactionStage, PolicyTransactionType } from '@insurance-max/contracts';

import { InsuranceProductVersion } from '../../insurance-products/entities/insurance-product-version.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';

export interface RenewalEligibilityBlocker {
  code: string;
  message: string;
}

export interface RenewalEligibilityResult {
  eligible: boolean;
  blockers: RenewalEligibilityBlocker[];
  renewalStartDate: string | null;
  renewalEndDate: string | null;
}

const ACTIVE_TRANSACTION_STAGES = [
  PolicyTransactionStage.DRAFT,
  PolicyTransactionStage.COMPLETED,
  PolicyTransactionStage.SUBMISSION_PROCESSING,
];

/**
 * Renewal eligibility (§13.21). Renewal dates are always derived from the
 * product's configured cover term (`default_cover_duration_days`) — never
 * assumed to be annual.
 */
@Injectable()
export class RenewalEligibilityService {
  async validate(
    manager: EntityManager,
    policy: Policy,
  ): Promise<RenewalEligibilityResult> {
    const blockers: RenewalEligibilityBlocker[] = [];

    if (policy.policy_status !== 'ACTIVE') {
      blockers.push({
        code: 'POLICY_NOT_ACTIVE',
        message: 'Only an active policy can be renewed.',
      });
    }

    if (policy.renewed_to_policy_id) {
      blockers.push({
        code: 'POLICY_ALREADY_RENEWED',
        message: 'This policy has already been renewed.',
      });
    }

    const activeRenewal = await manager.getRepository(PolicyTransaction).findOne({
      where: {
        source_policy_id: policy.id,
        transaction_type: PolicyTransactionType.RENEWAL,
        stage: In(ACTIVE_TRANSACTION_STAGES),
      },
    });

    if (activeRenewal) {
      blockers.push({
        code: 'RENEWAL_ALREADY_IN_PROGRESS',
        message: 'An active renewal transaction already exists for this policy.',
      });
    }

    if (!policy.cover_note_no) {
      blockers.push({
        code: 'MISSING_COVER_NOTE_REFERENCE',
        message: 'The policy has no cover-note reference to renew from.',
      });
    }

    let renewalStartDate: string | null = null;
    let renewalEndDate: string | null = null;

    if (policy.product_version_id) {
      const productVersion = await manager
        .getRepository(InsuranceProductVersion)
        .findOne({ where: { id: policy.product_version_id } });

      if (!productVersion) {
        blockers.push({
          code: 'PRODUCT_VERSION_NOT_FOUND',
          message: 'The product version backing this policy could not be resolved.',
        });
      } else {
        renewalStartDate = this.addDays(policy.end_date, 1);
        renewalEndDate = this.addDays(
          renewalStartDate,
          productVersion.default_cover_duration_days - 1,
        );
      }
    } else {
      blockers.push({
        code: 'PRODUCT_VERSION_MISSING',
        message: 'The policy has no product version to derive the renewal term from.',
      });
    }

    return {
      eligible: blockers.length === 0,
      blockers,
      renewalStartDate,
      renewalEndDate,
    };
  }

  private addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}
