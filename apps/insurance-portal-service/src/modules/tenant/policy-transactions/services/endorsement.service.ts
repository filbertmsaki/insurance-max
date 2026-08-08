import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  InvoiceSourceType,
  PolicyChangeCategory,
  PolicyTransactionChangeType,
  PolicyTransactionEventType,
  PolicyTransactionPremiumEffect,
  PolicyTransactionType,
  WorkflowApprovalStatus,
} from '@insurance-max/contracts';

import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionChange } from '../entities/policy-transaction-change.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransactionEligibilityService } from './policy-transaction-eligibility.service';
import { ProposedPolicySnapshotService } from './proposed-policy-snapshot.service';
import {
  EndorsementPricingService,
  type RemainingPeriodPricingResult,
} from './endorsement-pricing.service';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';
import { EndorsementTypesService } from './endorsement-types.service';
import { PolicyTransactionInvoiceService } from './policy-transaction-invoice.service';

export interface CreateEndorsementInput {
  effective_date: string;
  endorsement_type_code: string;
  reason: string;
  idempotency_key: string;
}

export interface RecordEndorsementChangeInput {
  category: PolicyChangeCategory;
  operation: PolicyTransactionChangeType;
  field_path: string;
  resource_id?: string | null;
  old_value: unknown;
  new_value: unknown;
  is_material?: boolean;
  requires_repricing?: boolean;
  requires_regulatory_submission?: boolean;
}

/** Categories that always force underwriter/senior-approver review (§13.14). */
const APPROVAL_TRIGGER_CATEGORIES: PolicyChangeCategory[] = [
  PolicyChangeCategory.CUSTOMER,
  PolicyChangeCategory.POLICYHOLDER,
  PolicyChangeCategory.ASSET,
  PolicyChangeCategory.COVER_PERIOD,
  PolicyChangeCategory.RISK,
];

@Injectable()
export class EndorsementService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyTransactionChange)
    private readonly changeRepository: Repository<PolicyTransactionChange>,
    @InjectRepository(PolicyEndorsement)
    private readonly endorsementRepository: Repository<PolicyEndorsement>,
    private readonly eligibilityService: PolicyTransactionEligibilityService,
    private readonly snapshotService: ProposedPolicySnapshotService,
    private readonly pricingService: EndorsementPricingService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly endorsementTypesService: EndorsementTypesService,
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly invoiceService: PolicyTransactionInvoiceService,
  ) {}

  async create(
    user: AuthenticatedUser,
    policyId: string,
    dto: CreateEndorsementInput,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const policy = await manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', { policyId })
        .andWhere('policy.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!policy) {
        throw new BadRequestException('Policy not found');
      }

      const existing = await manager.getRepository(PolicyTransaction).findOne({
        where: {
          company_id: user.companyId!,
          idempotency_key: dto.idempotency_key,
        },
      });

      if (existing) {
        return existing;
      }

      const eligibility = await this.eligibilityService.validate(
        manager,
        policy,
        PolicyTransactionType.ENDORSEMENT,
        dto.effective_date,
      );

      if (!eligibility.eligible) {
        throw new UnprocessableEntityException({
          code: 'ENDORSEMENT_NOT_ELIGIBLE',
          details: eligibility.blockers,
        });
      }

      const typeConfig = await this.endorsementTypesService.requireActive(
        user.companyId!,
        dto.endorsement_type_code,
      );

      const transactionNo =
        await this.identifierService.generatePolicyTransactionNumber(
          PolicyTransactionType.ENDORSEMENT,
          user.companyId!,
          manager,
        );

      const transaction = await manager.getRepository(PolicyTransaction).save({
        company_id: user.companyId!,
        transaction_no: transactionNo,
        transaction_type: PolicyTransactionType.ENDORSEMENT,
        source_policy_id: policy.id,
        source_policy_version_id: eligibility.currentVersion!.id,
        source_policy_version_no: eligibility.currentVersion!.version_number,
        source_policy_snapshot: eligibility.currentVersion!.policy_snapshot,
        source_policy_snapshot_hash:
          eligibility.currentVersion!.policy_snapshot_hash,
        effective_date: dto.effective_date,
        reason: dto.reason.trim(),
        requested_by: user.id,
        currency_code: policy.currency,
        idempotency_key: dto.idempotency_key,
      });

      await manager.getRepository(PolicyEndorsement).save({
        company_id: user.companyId!,
        policy_transaction_id: transaction.id,
        endorsement_type_id: typeConfig.id,
        endorsement_type_code: typeConfig.code,
        endorsement_type_name: typeConfig.name,
        tira_endorsement_type: typeConfig.tira_endorsement_type,
        previous_cover_note_reference: policy.cover_note_no ?? '',
        requires_new_cover_note: typeConfig.requires_new_cover_note,
      });

      policy.pending_transaction_id = transaction.id;
      await manager.getRepository(Policy).save(policy);

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.CREATED,
        actor_type: 'USER',
        actor_id: user.id,
        from_stage: null,
        to_stage: transaction.stage,
      });

      return transaction;
    });
  }

  async recordChange(
    user: AuthenticatedUser,
    transactionId: string,
    dto: RecordEndorsementChangeInput,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.requireDraftTransaction(
        manager,
        user.companyId!,
        transactionId,
      );

      const changeSnapshot = {
        category: dto.category,
        operation: dto.operation,
        fieldPath: dto.field_path,
        oldValue: dto.old_value,
        newValue: dto.new_value,
      };

      await manager.getRepository(PolicyTransactionChange).save({
        company_id: user.companyId!,
        policy_transaction_id: transaction.id,
        category: dto.category,
        operation: dto.operation,
        field_path: dto.field_path,
        resource_id: dto.resource_id ?? null,
        old_value: dto.old_value,
        new_value: dto.new_value,
        is_material: dto.is_material ?? true,
        requires_repricing: dto.requires_repricing ?? true,
        requires_regulatory_submission:
          dto.requires_regulatory_submission ?? true,
        change_hash: this.hashService.hashDefinition(changeSnapshot),
        created_by: user.id,
      });

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.CHANGE_ADDED,
        actor_type: 'USER',
        actor_id: user.id,
        from_stage: transaction.stage,
        to_stage: transaction.stage,
        metadata: { fieldPath: dto.field_path, category: dto.category },
      });

      return this.rebuildProposedSnapshot(manager, transaction);
    });
  }

  async recalculate(user: AuthenticatedUser, transactionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.requireDraftTransaction(
        manager,
        user.companyId!,
        transactionId,
      );
      return this.rebuildProposedSnapshot(manager, transaction);
    });
  }

  async complete(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.dataSource.transaction(async (manager) => {
      const current = await this.requireDraftTransaction(
        manager,
        user.companyId!,
        transactionId,
      );
      const updated = await this.rebuildProposedSnapshot(manager, current);

      const changes = await manager
        .getRepository(PolicyTransactionChange)
        .find({
          where: { policy_transaction_id: updated.id },
        });

      if (!changes.length) {
        throw new UnprocessableEntityException(
          'At least one material change is required to complete an endorsement.',
        );
      }

      const requiresApproval = changes.some(
        (change) =>
          change.is_material &&
          APPROVAL_TRIGGER_CATEGORIES.includes(change.category),
      );

      updated.approval_required = requiresApproval;
      updated.payment_required =
        updated.premium_effect === PolicyTransactionPremiumEffect.DEBIT;
      updated.completed_by = user.id;
      updated.completed_at = new Date();

      return manager.getRepository(PolicyTransaction).save(updated);
    });

    return this.lifecycleService.evaluateRequirements(
      user.companyId!,
      transaction.id,
      { changedBy: user.id },
    );
  }

  async requestPayment(user: AuthenticatedUser, transactionId: string) {
    return this.dataSource
      .transaction(async (manager) => {
        const transaction = await manager
          .getRepository(PolicyTransaction)
          .findOne({
            where: {
              id: transactionId,
              company_id: user.companyId!,
              transaction_type: PolicyTransactionType.ENDORSEMENT,
            },
          });

        if (!transaction) {
          throw new BadRequestException('Endorsement not found');
        }

        if (
          transaction.premium_effect !== PolicyTransactionPremiumEffect.DEBIT
        ) {
          throw new UnprocessableEntityException(
            'Only a debit endorsement requires payment.',
          );
        }

        if (
          transaction.approval_required &&
          transaction.approval_status !== WorkflowApprovalStatus.APPROVED
        ) {
          throw new UnprocessableEntityException(
            'The endorsement must be approved before payment is requested.',
          );
        }

        const endorsement = await manager
          .getRepository(PolicyEndorsement)
          .findOne({
            where: { policy_transaction_id: transaction.id },
          });
        const policy = await manager.getRepository(Policy).findOne({
          where: { id: transaction.source_policy_id },
        });

        if (!endorsement || !policy) {
          throw new BadRequestException(
            'Endorsement or source policy could not be resolved.',
          );
        }

        const invoice = await this.invoiceService.createOrReuseInvoice(
          manager,
          {
            companyId: user.companyId!,
            insurerCompanyId: policy.insurer_company_id,
            intermediaryCompanyId: policy.intermediary_company_id,
            customerId: policy.customer_id,
            branchId: policy.branch_id,
            transaction,
            childResourceId: endorsement.id,
            sourceType: InvoiceSourceType.ENDORSEMENT,
            amount: transaction.additional_premium,
            description: `Additional premium for endorsement ${transaction.transaction_no}`,
            createdBy: user.id,
          },
        );

        transaction.active_invoice_id = invoice.id;
        await manager.getRepository(PolicyTransaction).save(transaction);

        return invoice;
      })
      .then((invoice) =>
        this.lifecycleService
          .markPaymentRequested(user.companyId!, transactionId, {
            changedBy: user.id,
          })
          .then(() => invoice),
      );
  }

  async cancel(user: AuthenticatedUser, transactionId: string, reason: string) {
    const transaction = await this.lifecycleService.cancelTransaction(
      user.companyId!,
      transactionId,
      { changedBy: user.id, reason },
    );

    await this.policyRepository.update(
      {
        id: transaction.source_policy_id,
        pending_transaction_id: transaction.id,
      },
      { pending_transaction_id: null },
    );

    return transaction;
  }

  findAll(companyId: string, policyId?: string) {
    return this.transactionRepository.find({
      where: policyId
        ? {
            company_id: companyId,
            transaction_type: PolicyTransactionType.ENDORSEMENT,
            source_policy_id: policyId,
          }
        : {
            company_id: companyId,
            transaction_type: PolicyTransactionType.ENDORSEMENT,
          },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(companyId: string, id: string) {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id,
        company_id: companyId,
        transaction_type: PolicyTransactionType.ENDORSEMENT,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    return transaction;
  }

  private async requireDraftTransaction(
    manager: EntityManager,
    companyId: string,
    transactionId: string,
  ) {
    const transaction = await manager.getRepository(PolicyTransaction).findOne({
      where: {
        id: transactionId,
        company_id: companyId,
        transaction_type: PolicyTransactionType.ENDORSEMENT,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    if (transaction.stage !== 'DRAFT') {
      throw new UnprocessableEntityException(
        `Endorsement cannot be modified while in stage ${transaction.stage}.`,
      );
    }

    return transaction;
  }

  private async rebuildProposedSnapshot(
    manager: EntityManager,
    transaction: PolicyTransaction,
  ) {
    const changes = await manager.getRepository(PolicyTransactionChange).find({
      where: { policy_transaction_id: transaction.id },
    });

    const { snapshot, snapshotHash } = this.snapshotService.build(
      transaction.source_policy_snapshot,
      changes.map((change) => ({
        fieldPath: change.field_path,
        operation: change.operation,
        newValue: change.new_value,
      })),
    );

    transaction.proposed_policy_snapshot = snapshot;
    transaction.proposed_policy_snapshot_hash = snapshotHash;

    const pricing = this.computeRemainingPeriodPricing(transaction, snapshot);
    const pricingSnapshot = this.pricingService.compare(pricing);

    transaction.pricing_snapshot = pricingSnapshot as unknown as Record<
      string,
      unknown
    >;
    transaction.pricing_snapshot_hash = pricingSnapshot.snapshotHash;
    transaction.premium_effect = pricingSnapshot.premiumEffect;
    transaction.additional_premium =
      pricingSnapshot.premiumEffect === PolicyTransactionPremiumEffect.DEBIT
        ? DecimalUtil.value(pricingSnapshot.premiumDifference).toFixed(4)
        : '0.0000';
    transaction.return_premium =
      pricingSnapshot.premiumEffect === PolicyTransactionPremiumEffect.CREDIT
        ? DecimalUtil.value(pricingSnapshot.premiumDifference).abs().toFixed(4)
        : '0.0000';
    transaction.tax_difference = pricingSnapshot.taxDifference;
    transaction.commission_difference = pricingSnapshot.commissionDifference;
    transaction.net_premium_difference = pricingSnapshot.premiumDifference;

    return manager.getRepository(PolicyTransaction).save(transaction);
  }

  /**
   * Remaining-period old-vs-new pricing (§13.12). A full re-run through the
   * per-risk rating engine (`pricing/application/pricing-engine.service.ts`)
   * requires reconstructing each risk's original rating-factor input from
   * the frozen snapshot, which is a larger integration left for a follow-up
   * pass. In the meantime this derives both figures from the snapshot's own
   * already-computed totals, pro-rated over the remaining period, so the
   * DEBIT/CREDIT/NONE mechanics and gating behave correctly end-to-end.
   */
  private computeRemainingPeriodPricing(
    transaction: PolicyTransaction,
    proposedSnapshot: Record<string, unknown>,
  ): {
    sourcePolicyPremium: string;
    oldPricing: RemainingPeriodPricingResult;
    newPricing: RemainingPeriodPricingResult;
    currencyCode: string;
    effectiveDate: string;
  } {
    const source = transaction.source_policy_snapshot;
    const startDate = String(source['startDate'] ?? transaction.effective_date);
    const endDate = String(source['endDate'] ?? transaction.effective_date);
    const remainingFraction = this.remainingPeriodFraction(
      startDate,
      endDate,
      transaction.effective_date,
    );

    const sourceTotals = (source['totals'] as Record<string, unknown>) ?? {};
    const proposedTotals =
      (proposedSnapshot['totals'] as Record<string, unknown>) ?? sourceTotals;

    const oldTotal = DecimalUtil.value(
      (sourceTotals['totalPremium'] as string) ?? '0',
    );
    const newTotal = DecimalUtil.value(
      (proposedTotals['totalPremium'] as string) ?? oldTotal.toString(),
    );

    const oldRemaining = oldTotal.mul(remainingFraction);
    const newRemaining = newTotal.mul(remainingFraction);

    const build = (
      fullTerm: string,
      remaining: string,
    ): RemainingPeriodPricingResult => ({
      finalPayablePremium: remaining,
      fullTermPremium: fullTerm,
      earnedBeforeEffectiveDate: DecimalUtil.value(fullTerm)
        .minus(remaining)
        .toFixed(4),
      taxAmount: '0.0000',
      commissionAmount: '0.0000',
      resultHash: this.hashService.hashDefinition({ fullTerm, remaining }),
    });

    return {
      sourcePolicyPremium: oldTotal.toFixed(4),
      oldPricing: build(oldTotal.toFixed(4), oldRemaining.toFixed(4)),
      newPricing: build(newTotal.toFixed(4), newRemaining.toFixed(4)),
      currencyCode: transaction.currency_code,
      effectiveDate: transaction.effective_date,
    };
  }

  private remainingPeriodFraction(
    startDate: string,
    endDate: string,
    effectiveDate: string,
  ): number {
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
    const effective = new Date(`${effectiveDate}T00:00:00.000Z`).getTime();

    const policyDays = Math.max(Math.floor((end - start) / 86_400_000) + 1, 1);
    const remainingDays = Math.max(
      Math.floor((end - effective) / 86_400_000) + 1,
      0,
    );

    return remainingDays / policyDays;
  }
}
