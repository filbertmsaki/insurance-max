import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';

import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { ClaimCoverageStatus } from '../enums/claim.enums';

export interface ClaimCoverageBlocker {
  code: string;
  message: string;
}

export interface ClaimCoverageResult {
  covered: boolean;
  status: ClaimCoverageStatus;
  blockers: ClaimCoverageBlocker[];
  version: PolicyVersion | null;
  coverageSnapshot: Record<string, unknown> | null;
  coverageSnapshotHash: string | null;
}

/**
 * Replaces the blanket "reject any cancelled policy" check (§14.2/14.12):
 * coverage is decided by whether a policy version was effective on the
 * reported loss date, not by the policy's *current* status. A cancelled
 * policy still covers a loss that occurred before the cancellation
 * effective date.
 */
@Injectable()
export class ClaimCoverageService {
  constructor(private readonly hashService: ProductDefinitionHashService) {}

  async evaluate(
    manager: EntityManager,
    policy: Policy,
    lossDate: string,
  ): Promise<ClaimCoverageResult> {
    const blockers: ClaimCoverageBlocker[] = [];

    const version = await manager
      .getRepository(PolicyVersion)
      .createQueryBuilder('version')
      .where('version.policy_id = :policyId', { policyId: policy.id })
      .andWhere('version.effective_from <= :lossDate', { lossDate })
      .andWhere('version.effective_to >= :lossDate', { lossDate })
      .orderBy('version.version_number', 'DESC')
      .getOne();

    if (!version) {
      return {
        covered: false,
        status: ClaimCoverageStatus.DECLINED,
        blockers: [
          {
            code: 'NO_EFFECTIVE_POLICY_VERSION',
            message:
              'No policy version was effective on the reported loss date.',
          },
        ],
        version: null,
        coverageSnapshot: null,
        coverageSnapshotHash: null,
      };
    }

    if (
      policy.cancellation_effective_date &&
      lossDate >= policy.cancellation_effective_date
    ) {
      return {
        covered: false,
        status: ClaimCoverageStatus.DECLINED,
        blockers: [
          {
            code: 'LOSS_AFTER_CANCELLATION',
            message:
              'The loss occurred on or after the policy cancellation effective date.',
          },
        ],
        version,
        coverageSnapshot: null,
        coverageSnapshotHash: null,
      };
    }

    const coverageSnapshot = {
      policyId: policy.id,
      policyNumber: policy.policy_no,
      policyReferenceNumber: policy.policy_reference_number,
      policyVersionId: version.id,
      policyVersionNumber: version.version_number,
      effectiveFrom: version.effective_from,
      effectiveTo: version.effective_to,
      lossDate,
    };

    return {
      covered: true,
      status: ClaimCoverageStatus.CONFIRMED,
      blockers,
      version,
      coverageSnapshot,
      coverageSnapshotHash: this.hashService.hashDefinition(coverageSnapshot),
    };
  }
}
