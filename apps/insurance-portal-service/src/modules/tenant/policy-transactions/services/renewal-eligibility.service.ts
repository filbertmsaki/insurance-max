import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, In } from 'typeorm';
import {
  PolicyTransactionStage,
  PolicyTransactionType,
  RenewalLifecycleStatus,
} from '@insurance-max/contracts';

import { CompanyConfigsService } from '../../../platform/company-configs/company-configs.service';
import { ProductDefinitionService } from '../../insurance-products/product-definition.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyCoverNote } from '../../policies/entities/policy-cover-note.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyRenewal } from '../entities/policy-renewal.entity';

export interface RenewalEligibilityBlocker {
  code: string;
  message: string;
}

export interface RenewalEligibilityResult {
  eligible: boolean;
  blockers: RenewalEligibilityBlocker[];
  renewalStartDate: string | null;
  renewalEndDate: string | null;
  coverNoteEndDate: string | null;
  prevCoverNoteReferenceNumber: string | null;
  renewalOfPolicyId: string | null;
  renewalSequence: number | null;
  renewalWindowBeforeDays: number;
  renewalWindowAfterDays: number;
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
    private readonly companyConfigsService: CompanyConfigsService,
    private readonly configService: ConfigService,
  ) {}

  async validate(
    manager: EntityManager,
    policy: Policy,
  ): Promise<RenewalEligibilityResult> {
    const blockers: RenewalEligibilityBlocker[] = [];

    const window = await this.resolveRenewalWindow(policy.company_id);
    const normalizedPolicyStatus = String(policy.policy_status || '')
      .trim()
      .toUpperCase();

    if (normalizedPolicyStatus === 'CANCELLED') {
      blockers.push({
        code: 'POLICY_CANCELLED',
        message: 'This policy has been cancelled.',
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
          'This policy cannot be renewed because it was not issued through this system.',
      });
    }

    if (
      policy.tira_status !== 'SUCCESS' ||
      policy.regulatory_sync_status !== 'IN_SYNC'
    ) {
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

    const issuedCoverNote = await this.resolveIssuedCoverNote(manager, policy);
    const coverNoteEndDate = issuedCoverNote?.end_date ?? null;
    const prevCoverNoteReferenceNumber =
      issuedCoverNote?.cover_note_reference_number ??
      policy.cover_note_no ??
      null;

    if (!issuedCoverNote) {
      blockers.push({
        code: 'ISSUED_COVER_NOTE_MISSING',
        message:
          'The original issued cover note could not be found in this system.',
      });
    } else if (String(issuedCoverNote.status).toUpperCase() !== 'ISSUED') {
      blockers.push({
        code: 'COVER_NOTE_NOT_ISSUED',
        message: 'The original cover note has not been successfully issued.',
      });
    }

    if (!prevCoverNoteReferenceNumber) {
      blockers.push({
        code: 'COVER_NOTE_REFERENCE_MISSING',
        message:
          'A valid Cover Note Reference Number is required before renewal.',
      });
    }

    if (!coverNoteEndDate) {
      blockers.push({
        code: 'COVER_NOTE_END_DATE_MISSING',
        message: 'The Cover Note End Date is required before renewal.',
      });
    } else {
      const windowCheck = this.checkCoverNoteEndDateWindow(
        coverNoteEndDate,
        window.beforeDays,
        window.afterDays,
      );

      if (!windowCheck.allowed) {
        blockers.push({
          code:
            windowCheck.position === 'FUTURE'
              ? 'RENEWAL_NOT_YET_AVAILABLE'
              : 'RENEWAL_WINDOW_EXPIRED',
          message:
            windowCheck.position === 'FUTURE'
              ? 'Renewal is not yet available.'
              : 'The renewal window has expired.',
        });
      }
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

    let renewalStartDate: string | null = null;
    let renewalEndDate: string | null = null;
    let renewalProductVersionId: string | null = null;
    let renewalProductDefinitionHash: string | null = null;
    const renewalOfPolicyId =
      policy.renewal_of_policy_id ?? policy.renewed_from_policy_id ?? policy.id;
    const renewalSequence = Number(policy.renewal_sequence ?? 0) + 1;

    try {
      renewalStartDate = this.addDays(coverNoteEndDate ?? policy.end_date, 1);
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

      const duplicateForPeriod = await this.findExistingRenewalForPeriod(
        manager,
        policy,
        renewalStartDate,
        renewalEndDate,
      );

      if (duplicateForPeriod) {
        blockers.push({
          code: 'POLICY_ALREADY_RENEWED_FOR_PERIOD',
          message: 'This policy has already been renewed.',
        });
      }
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
      coverNoteEndDate,
      prevCoverNoteReferenceNumber,
      renewalOfPolicyId,
      renewalSequence,
      renewalWindowBeforeDays: window.beforeDays,
      renewalWindowAfterDays: window.afterDays,
      currentVersion,
      renewalProductVersionId,
      renewalProductDefinitionHash,
    };
  }

  private async resolveRenewalWindow(companyId: string) {
    const beforeFallback = this.normalizeWindowDays(
      this.configService.get('RENEWAL_WINDOW_BEFORE_DAYS') ?? 7,
      7,
    );
    const afterFallback = this.normalizeWindowDays(
      this.configService.get('RENEWAL_WINDOW_AFTER_DAYS') ?? 7,
      7,
    );
    const beforeDays = this.normalizeWindowDays(
      await this.companyConfigsService.getValue(
        companyId,
        'RENEWAL_WINDOW_BEFORE_DAYS',
        beforeFallback,
      ),
      beforeFallback,
    );
    const afterDays = this.normalizeWindowDays(
      await this.companyConfigsService.getValue(
        companyId,
        'RENEWAL_WINDOW_AFTER_DAYS',
        afterFallback,
      ),
      afterFallback,
    );

    return {
      beforeDays,
      afterDays,
    };
  }

  private normalizeWindowDays(value: unknown, fallback: number): number {
    const days = Number(value);

    return Number.isInteger(days) && days >= 0 ? days : fallback;
  }

  private async resolveIssuedCoverNote(manager: EntityManager, policy: Policy) {
    const link = await manager
      .getRepository(PolicyCoverNote)
      .createQueryBuilder('link')
      .innerJoinAndSelect('link.cover_note', 'coverNote')
      .where('link.company_id = :companyId', { companyId: policy.company_id })
      .andWhere('link.policy_id = :policyId', { policyId: policy.id })
      .andWhere('coverNote.deleted_at IS NULL')
      .orderBy('link.sequence_number', 'ASC')
      .getOne();

    return link?.cover_note ?? null;
  }

  private checkCoverNoteEndDateWindow(
    coverNoteEndDate: string,
    beforeDays: number,
    afterDays: number,
  ): { allowed: boolean; position: 'PAST' | 'IN_WINDOW' | 'FUTURE' } {
    const today = this.utcDateOnly(new Date());
    const endDate = this.utcDateOnly(new Date(`${coverNoteEndDate}T00:00:00Z`));
    const earliest = new Date(today);
    earliest.setUTCDate(earliest.getUTCDate() - afterDays);
    const latest = new Date(today);
    latest.setUTCDate(latest.getUTCDate() + beforeDays);

    if (endDate < earliest) {
      return { allowed: false, position: 'PAST' };
    }

    if (endDate > latest) {
      return { allowed: false, position: 'FUTURE' };
    }

    return { allowed: true, position: 'IN_WINDOW' };
  }

  private utcDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private async findExistingRenewalForPeriod(
    manager: EntityManager,
    policy: Policy,
    renewalStartDate: string,
    renewalEndDate: string,
  ) {
    return manager
      .getRepository(PolicyRenewal)
      .createQueryBuilder('renewal')
      .innerJoin(
        PolicyTransaction,
        'transaction',
        'transaction.id = renewal.policy_transaction_id',
      )
      .where('renewal.company_id = :companyId', {
        companyId: policy.company_id,
      })
      .andWhere('transaction.source_policy_id = :policyId', {
        policyId: policy.id,
      })
      .andWhere('renewal.renewal_start_date = :renewalStartDate', {
        renewalStartDate,
      })
      .andWhere('renewal.renewal_end_date = :renewalEndDate', {
        renewalEndDate,
      })
      .andWhere('renewal.renewal_status != :declined', {
        declined: RenewalLifecycleStatus.CUSTOMER_DECLINED,
      })
      .getOne();
  }

  private addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}
