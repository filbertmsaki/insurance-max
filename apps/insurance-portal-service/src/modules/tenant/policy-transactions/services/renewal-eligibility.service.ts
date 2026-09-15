import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  PolicyTransactionStage,
  PolicyTransactionType,
} from '@insurance-max/contracts';

import { ProductDefinitionService } from '../../insurance-products/product-definition.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
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
  currentVersion: PolicyVersion | null;
  renewalProductVersionId: string | null;
  renewalProductDefinitionHash: string | null;
}

const ACTIVE_TRANSACTION_STAGES = [
  PolicyTransactionStage.DRAFT,
  PolicyTransactionStage.COMPLETED,
  PolicyTransactionStage.SUBMISSION_PROCESSING,
];

@Injectable()
export class RenewalEligibilityService {
  constructor(
    private readonly productDefinitionService: ProductDefinitionService,
  ) {}

  async validate(
    manager: EntityManager,
    policy: Policy,
  ): Promise<RenewalEligibilityResult> {
    const blockers: RenewalEligibilityBlocker[] = [];

    const normalizedPolicyStatus = String(policy.policy_status || '')
      .trim()
      .toUpperCase();

    if (normalizedPolicyStatus === 'CANCELLED') {
      blockers.push({
        code: 'POLICY_CANCELLED',
        message: 'A cancelled policy cannot be renewed.',
      });
    } else if (
      !['COVER_NOTE_ISSUED', 'ACTIVE', 'ENDORSED'].includes(
        normalizedPolicyStatus,
      )
    ) {
      blockers.push({
        code: 'POLICY_NOT_RENEWABLE',
        message: 'Only an issued, active, or endorsed policy can be renewed.',
      });
    }

    if (!policy.issued_by_system || !policy.quotation_id) {
      blockers.push({
        code: 'POLICY_NOT_SYSTEM_ISSUED',
        message:
          'Only policies issued through the quotation and TIRAMIS workflow can be renewed.',
      });
    }

    if (policy.tira_status !== 'SUCCESS') {
      blockers.push({
        code: 'ORIGINAL_TIRAMIS_ISSUANCE_NOT_SUCCESSFUL',
        message:
          'The current policy must have a successful regulatory issuance before renewal.',
      });
    }

    if (policy.renewed_to_policy_id) {
      blockers.push({
        code: 'POLICY_ALREADY_RENEWED',
        message: 'This policy has already been renewed.',
      });
    }

    if (policy.pending_transaction_id) {
      blockers.push({
        code: 'POLICY_TRANSACTION_ACTIVE',
        message: 'The policy currently has another active policy transaction.',
      });
    }

    const existingRenewal = await manager
      .getRepository(PolicyTransaction)
      .findOne({
        where: {
          company_id: policy.company_id,
          source_policy_id: policy.id,
          transaction_type: PolicyTransactionType.RENEWAL,
          stage: In(ACTIVE_TRANSACTION_STAGES),
        },
      });

    if (existingRenewal) {
      blockers.push({
        code: 'RENEWAL_ALREADY_IN_PROGRESS',
        message: 'A renewal transaction already exists for this policy.',
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
        message: 'The current Policy Version could not be resolved.',
      });
    }

    if (currentVersion) {
      const schemaVersion = Number(
        currentVersion.policy_snapshot?.['schemaVersion'] ?? 1,
      );

      if (schemaVersion < 2) {
        blockers.push({
          code: 'POLICY_SNAPSHOT_REQUIRES_UPGRADE',
          message:
            'The policy requires a complete immutable Policy Version before renewal.',
        });
      }
    }

    const coverNoteReference =
      currentVersion?.regulatory_reference ?? policy.cover_note_no;

    if (!coverNoteReference) {
      blockers.push({
        code: 'COVER_NOTE_REFERENCE_MISSING',
        message:
          'The current TIRAMIS Cover Note reference is required for renewal.',
      });
    }

    let renewalStartDate: string | null = null;
    let renewalEndDate: string | null = null;
    let renewalProductVersionId: string | null = null;
    let renewalProductDefinitionHash: string | null = null;

    try {
      renewalStartDate = this.addDays(policy.end_date, 1);
      const definition =
        await this.productDefinitionService.resolvePublishedDefinition(
          policy.insurer_company_id,
          policy.product_id,
          policy.sub_class_id,
          new Date(`${renewalStartDate}T00:00:00.000Z`),
        );

      renewalProductVersionId = definition.productVersionId;
      renewalProductDefinitionHash = definition.definitionHash;
      renewalEndDate = this.addDays(
        renewalStartDate,
        definition.defaultCoverDurationDays - 1,
      );
    } catch (error) {
      blockers.push({
        code: 'RENEWAL_PRODUCT_NOT_AVAILABLE',
        message:
          error instanceof Error
            ? error.message
            : 'No approved product version is available for the renewal period.',
      });
    }

    return {
      eligible: blockers.length === 0,
      blockers,
      renewalStartDate,
      renewalEndDate,
      currentVersion,
      renewalProductVersionId,
      renewalProductDefinitionHash,
    };
  }

  private addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}
