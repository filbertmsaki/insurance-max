import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  PolicyTransactionEventType,
  PolicyTransactionStage,
  PolicyTransactionType,
  PolicyVersionType,
} from '@insurance-max/contracts';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyStatusHistory } from '../../policies/entities/policy-status-history.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';

export interface ApplyPolicyTransactionContext {
  changedBy?: string | null;
}

/**
 * Applies an ENDORSEMENT or CANCELLATION transaction to its source policy
 * once TIRAMIS has accepted the resubmission (§13's "apply to policy" step,
 * previously missing — `PolicyTransactionLifecycleService.markApplied` only
 * flipped the transaction's own stage and never touched the policy). Mirrors
 * the versioning pattern already used for new-business issuance
 * (`IssuanceService.createPolicyVersion`) and renewal
 * (`RenewalService.applyIssuedPolicyIfRenewal`).
 */
@Injectable()
export class PolicyTransactionApplyService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    private readonly hashService: ProductDefinitionHashService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
  ) {}

  async applyEndorsement(
    companyId: string,
    transactionId: string,
    context: ApplyPolicyTransactionContext = {},
  ) {
    const transaction = await this.requireApplicableTransaction(
      companyId,
      transactionId,
      PolicyTransactionType.ENDORSEMENT,
    );

    const proposedSnapshot = transaction.proposed_policy_snapshot;

    if (!proposedSnapshot) {
      throw new ConflictException(
        'Endorsement has no proposed policy snapshot to apply.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const policy = await manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', { policyId: transaction.source_policy_id })
        .getOne();

      if (!policy) {
        throw new ConflictException('Source policy could not be resolved.');
      }

      const previousVersion = await manager
        .getRepository(PolicyVersion)
        .findOne({
          where: { policy_id: policy.id, is_current: true },
        });

      const newVersion = await this.createNextVersion(manager, {
        policy,
        previousVersion,
        transaction,
        versionType: PolicyVersionType.ENDORSEMENT,
        policySnapshot: proposedSnapshot,
        policySnapshotHash:
          transaction.proposed_policy_snapshot_hash ??
          this.hashService.hashDefinition(proposedSnapshot),
        effectiveFrom: transaction.effective_date,
        effectiveTo: policy.end_date,
        createdBy: context.changedBy ?? null,
      });

      policy.total_premium = DecimalUtil.add(
        policy.total_premium,
        transaction.additional_premium,
      );
      policy.total_premium = DecimalUtil.subtract(
        policy.total_premium,
        transaction.return_premium,
      );
      policy.net_premium = policy.total_premium;
      policy.total_tax = DecimalUtil.add(policy.total_tax, transaction.tax_difference);
      policy.total_commission = DecimalUtil.add(
        policy.total_commission,
        transaction.commission_difference,
      );
      policy.last_endorsement_date = transaction.effective_date;
      policy.current_version_no = newVersion.version_number;
      policy.active_version_id = newVersion.id;
      policy.pending_transaction_id = null;
      policy.state_version = Number(policy.state_version || 1) + 1;

      await manager.getRepository(Policy).save(policy);

      transaction.target_policy_id = policy.id;
      transaction.target_policy_version_id = newVersion.id;
      await manager.getRepository(PolicyTransaction).save(transaction);
    });

    return this.lifecycleService.markApplied(
      companyId,
      transactionId,
      { changedBy: context.changedBy },
      PolicyTransactionEventType.POLICY_VERSION_APPLIED,
    );
  }

  async applyCancellation(
    companyId: string,
    transactionId: string,
    context: ApplyPolicyTransactionContext = {},
  ) {
    const transaction = await this.requireApplicableTransaction(
      companyId,
      transactionId,
      PolicyTransactionType.CANCELLATION,
    );

    await this.dataSource.transaction(async (manager) => {
      const policy = await manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', { policyId: transaction.source_policy_id })
        .getOne();

      if (!policy) {
        throw new ConflictException('Source policy could not be resolved.');
      }

      const previousVersion = await manager
        .getRepository(PolicyVersion)
        .findOne({
          where: { policy_id: policy.id, is_current: true },
        });

      const cancelledSnapshot = {
        ...((previousVersion?.policy_snapshot as Record<string, unknown>) ??
          transaction.source_policy_snapshot),
        policyStatus: 'CANCELLED',
        cancellationEffectiveDate: transaction.effective_date,
      };
      const cancelledSnapshotHash = this.hashService.hashDefinition(
        cancelledSnapshot,
      );

      const newVersion = await this.createNextVersion(manager, {
        policy,
        previousVersion,
        transaction,
        versionType: PolicyVersionType.CANCELLATION,
        policySnapshot: cancelledSnapshot,
        policySnapshotHash: cancelledSnapshotHash,
        effectiveFrom: transaction.effective_date,
        effectiveTo: transaction.effective_date,
        createdBy: context.changedBy ?? null,
      });

      const originalStatus = policy.policy_status;
      policy.policy_status = 'CANCELLED';
      policy.cancellation_effective_date = transaction.effective_date;
      policy.current_version_no = newVersion.version_number;
      policy.active_version_id = newVersion.id;
      policy.pending_transaction_id = null;
      policy.state_version = Number(policy.state_version || 1) + 1;

      await manager.getRepository(Policy).save(policy);

      if (originalStatus !== 'CANCELLED') {
        await manager.getRepository(PolicyStatusHistory).save({
          policy_id: policy.id,
          old_status: originalStatus,
          new_status: 'CANCELLED',
          reason: transaction.reason,
          changed_by: context.changedBy ?? null,
        });
      }

      transaction.target_policy_id = policy.id;
      transaction.target_policy_version_id = newVersion.id;
      await manager.getRepository(PolicyTransaction).save(transaction);
    });

    return this.lifecycleService.markApplied(
      companyId,
      transactionId,
      { changedBy: context.changedBy },
      PolicyTransactionEventType.CANCELLATION_APPLIED,
    );
  }

  private async requireApplicableTransaction(
    companyId: string,
    transactionId: string,
    type: PolicyTransactionType,
  ): Promise<PolicyTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id: transactionId,
        company_id: companyId,
        transaction_type: type,
      },
    });

    if (!transaction) {
      throw new ConflictException('Policy transaction not found.');
    }

    if (transaction.stage === PolicyTransactionStage.APPLIED) {
      return transaction;
    }

    if (transaction.stage !== PolicyTransactionStage.COMPLETED) {
      throw new ConflictException(
        `Transaction cannot be applied to the policy from stage ${transaction.stage}.`,
      );
    }

    return transaction;
  }

  private async createNextVersion(
    manager: import('typeorm').EntityManager,
    params: {
      policy: Policy;
      previousVersion: PolicyVersion | null;
      transaction: PolicyTransaction;
      versionType: PolicyVersionType;
      policySnapshot: Record<string, unknown>;
      policySnapshotHash: string;
      effectiveFrom: string;
      effectiveTo: string;
      createdBy: string | null;
    },
  ): Promise<PolicyVersion> {
    const repository = manager.getRepository(PolicyVersion);

    if (params.previousVersion) {
      params.previousVersion.is_current = false;
      params.previousVersion.superseded_at = new Date();
      await repository.save(params.previousVersion);
    }

    const versionNumber =
      (params.previousVersion?.version_number ??
        params.transaction.source_policy_version_no) + 1;

    return repository.save({
      company_id: params.policy.company_id,
      policy_id: params.policy.id,
      version_number: versionNumber,
      version_type: params.versionType,
      status: params.policy.policy_status,
      effective_from: params.effectiveFrom,
      effective_to: params.effectiveTo,
      policy_snapshot: params.policySnapshot,
      policy_snapshot_hash: params.policySnapshotHash,
      pricing_snapshot:
        params.transaction.pricing_snapshot ??
        params.previousVersion?.pricing_snapshot ??
        {},
      pricing_result_hash:
        params.transaction.pricing_snapshot_hash ??
        params.previousVersion?.pricing_result_hash ??
        this.hashService.hashDefinition({}),
      customer_snapshot: params.previousVersion?.customer_snapshot ?? {},
      customer_snapshot_hash:
        params.previousVersion?.customer_snapshot_hash ??
        this.hashService.hashDefinition({}),
      asset_manifest: params.previousVersion?.asset_manifest ?? {},
      asset_manifest_hash:
        params.previousVersion?.asset_manifest_hash ??
        this.hashService.hashDefinition({}),
      policy_transaction_id: params.transaction.id,
      supersedes_version_id: params.previousVersion?.id ?? null,
      is_current: true,
      effective_transaction_date: params.transaction.effective_date,
      created_by: params.createdBy,
    });
  }
}
