import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  CancellationReasonType,
  InvoiceSourceType,
  PolicyTransactionEventType,
  PolicyTransactionPremiumEffect,
  PolicyTransactionType,
} from '@insurance-max/contracts';

import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyTransactionEligibilityService } from './policy-transaction-eligibility.service';
import { CancellationPricingService } from './cancellation-pricing.service';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';
import { PolicyTransactionInvoiceService } from './policy-transaction-invoice.service';
import { PolicyCancellationConfigService } from './policy-cancellation-config.service';

export interface CreateCancellationInput {
  effective_date: string;
  reason_type: CancellationReasonType;
  reason: string;
  idempotency_key: string;
}

@Injectable()
export class CancellationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyCancellation)
    private readonly cancellationRepository: Repository<PolicyCancellation>,
    private readonly eligibilityService: PolicyTransactionEligibilityService,
    private readonly pricingService: CancellationPricingService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly identifierService: IdentifierGeneratorService,
    private readonly invoiceService: PolicyTransactionInvoiceService,
    private readonly cancellationConfigService: PolicyCancellationConfigService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async getEligibility(
    user: AuthenticatedUser,
    policyId: string,
    effectiveDate?: string,
  ) {
    const policy = await this.policyRepository.findOne({
      where: {
        id: policyId,
        company_id: user.companyId!,
      },
    });

    if (!policy) {
      throw new BadRequestException('Policy not found');
    }

    const result = await this.dataSource.transaction((manager) =>
      this.eligibilityService.validate(
        manager,
        policy,
        PolicyTransactionType.CANCELLATION,
        effectiveDate,
      ),
    );
    const currentVersion = result.currentVersion;

    return {
      eligible: result.eligible,
      blockers: result.blockers,
      claimsReviewRequired: result.claimsReviewRequired,
      policy: {
        id: policy.id,
        policy_no: policy.policy_no,
        policy_status: policy.policy_status,
        quotation_id: policy.quotation_id,
        start_date: policy.start_date,
        end_date: policy.end_date,
        currency: policy.currency,
        pending_transaction_id: policy.pending_transaction_id,
        cover_note_no: policy.cover_note_no,
        tira_status: policy.tira_status,
      },
      current_version: currentVersion
        ? {
            id: currentVersion.id,
            version_number: currentVersion.version_number,
            version_type: currentVersion.version_type,
            effective_from: currentVersion.effective_from,
            effective_to: currentVersion.effective_to,
            regulatory_reference: currentVersion.regulatory_reference,
            snapshot_schema_version: Number(
              currentVersion.policy_snapshot?.['schemaVersion'] ?? 1,
            ),
          }
        : null,
    };
  }

  async create(
    user: AuthenticatedUser,
    policyId: string,
    dto: CreateCancellationInput,
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
        PolicyTransactionType.CANCELLATION,
        dto.effective_date,
      );

      if (!eligibility.eligible) {
        throw new UnprocessableEntityException({
          code: 'CANCELLATION_NOT_ELIGIBLE',
          details: eligibility.blockers,
        });
      }

      // Cancellation method is always resolved from configuration — never
      // taken verbatim from the requesting client (§13.17).
      const rule = await this.cancellationConfigService.resolve(
        user.companyId!,
        dto.reason_type,
      );
      const currentVersion = eligibility.currentVersion!;
      const previousCoverNoteReference =
        currentVersion.regulatory_reference ?? policy.cover_note_no;

      if (!previousCoverNoteReference) {
        throw new UnprocessableEntityException(
          'The current TIRAMIS cover-note reference is missing.',
        );
      }

      const pricing = this.pricingService.calculate({
        policyStartDate: policy.start_date,
        policyEndDate: policy.end_date,
        cancellationEffectiveDate: dto.effective_date,
        grossWrittenPremium: policy.total_premium,
        cancellationMethod: rule.cancellationMethod,
        cancellationCharge: rule.cancellationCharge,
        minimumRetainedPremium: rule.minimumRetainedPremium,
      });
      const premiumEffect =
        Number(pricing.refundAmount) > 0
          ? PolicyTransactionPremiumEffect.CREDIT
          : Number(pricing.amountDue) > 0
            ? PolicyTransactionPremiumEffect.DEBIT
            : PolicyTransactionPremiumEffect.NONE;
      const ruleSnapshot = {
        cancellationMethod: rule.cancellationMethod,
        cancellationCharge: rule.cancellationCharge,
        minimumRetainedPremium: rule.minimumRetainedPremium,
        tiraEndorsementType: rule.tiraEndorsementType,
        requireApproval: rule.requireApproval,
      };
      const pricingSnapshot = {
        schemaVersion: 1,
        calculationType: 'POLICY_CANCELLATION',
        policyStartDate: policy.start_date,
        policyEndDate: policy.end_date,
        effectiveDate: dto.effective_date,
        policyDays: pricing.policyDays,
        daysOnRisk: pricing.daysOnRisk,
        remainingDays: pricing.remainingDays,
        grossWrittenPremium: policy.total_premium,
        earnedPremium: pricing.earnedPremium,
        unearnedPremium: pricing.unearnedPremium,
        cancellationCharge: pricing.cancellationCharge,
        refundAmount: pricing.refundAmount,
        amountDue: pricing.amountDue,
        premiumEffect,
        rule: ruleSnapshot,
        sourcePolicyVersionPricingSnapshot: currentVersion.pricing_snapshot,
        sourcePolicyVersionPricingHash: currentVersion.pricing_result_hash,
      };
      const pricingSnapshotHash =
        this.hashService.hashDefinition(pricingSnapshot);
      const proposedPolicySnapshot = JSON.parse(
        JSON.stringify(currentVersion.policy_snapshot),
      ) as Record<string, unknown>;

      proposedPolicySnapshot['policyStatus'] = 'CANCELLED';
      proposedPolicySnapshot['cancellation'] = {
        reasonType: dto.reason_type,
        reason: dto.reason.trim(),
        effectiveDate: dto.effective_date,
        method: rule.cancellationMethod,
        earnedPremium: pricing.earnedPremium,
        unearnedPremium: pricing.unearnedPremium,
        cancellationCharge: pricing.cancellationCharge,
        refundAmount: pricing.refundAmount,
        amountDue: pricing.amountDue,
        previousCoverNoteReference,
      };

      const cover = proposedPolicySnapshot['cover'];

      if (cover && typeof cover === 'object' && !Array.isArray(cover)) {
        (cover as Record<string, unknown>)['endDate'] = dto.effective_date;
      }

      const proposedPolicySnapshotHash = this.hashService.hashDefinition(
        proposedPolicySnapshot,
      );

      const transactionNo =
        await this.identifierService.generatePolicyTransactionNumber(
          PolicyTransactionType.CANCELLATION,
          user.companyId!,
          manager,
        );

      const transaction = await manager.getRepository(PolicyTransaction).save({
        company_id: user.companyId!,
        transaction_no: transactionNo,
        transaction_type: PolicyTransactionType.CANCELLATION,
        source_policy_id: policy.id,
        source_policy_version_id: currentVersion.id,
        source_policy_version_no: currentVersion.version_number,
        source_policy_snapshot: currentVersion.policy_snapshot,
        source_policy_snapshot_hash: currentVersion.policy_snapshot_hash,
        proposed_policy_snapshot: proposedPolicySnapshot,
        proposed_policy_snapshot_hash: proposedPolicySnapshotHash,
        effective_date: dto.effective_date,
        reason: dto.reason.trim(),
        requested_by: user.id,
        currency_code: policy.currency,
        idempotency_key: dto.idempotency_key,
        premium_effect: premiumEffect,
        return_premium: pricing.refundAmount,
        additional_premium: pricing.amountDue,
        net_premium_difference:
          Number(pricing.amountDue) > 0
            ? pricing.amountDue
            : Number(pricing.refundAmount) > 0
              ? `-${pricing.refundAmount}`
              : '0.0000',
        pricing_snapshot: pricingSnapshot,
        pricing_snapshot_hash: pricingSnapshotHash,
      });

      await manager.getRepository(PolicyCancellation).save({
        company_id: user.companyId!,
        policy_transaction_id: transaction.id,
        reason_type: dto.reason_type,
        cancellation_method: rule.cancellationMethod,
        requested_effective_date: dto.effective_date,
        policy_days: pricing.policyDays,
        days_on_risk: pricing.daysOnRisk,
        remaining_days: pricing.remainingDays,
        gross_written_premium: policy.total_premium,
        earned_premium: pricing.earnedPremium,
        unearned_premium: pricing.unearnedPremium,
        cancellation_charge: pricing.cancellationCharge,
        refund_amount: pricing.refundAmount,
        amount_due: pricing.amountDue,
        claims_review_required: eligibility.claimsReviewRequired,
        claims_review_status: eligibility.claimsReviewRequired
          ? 'PENDING'
          : 'NOT_REQUIRED',
        tira_endorsement_type: rule.tiraEndorsementType,
        previous_cover_note_reference: previousCoverNoteReference,
        cancellation_cover_note_reference: null,
        rule_snapshot: ruleSnapshot,
        rule_snapshot_hash: this.hashService.hashDefinition(ruleSnapshot),
      });

      policy.pending_transaction_id = transaction.id;
      await manager.getRepository(Policy).save(policy);

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.CREATED,
        actor_type: 'USER',
        actor_id: user.id,
        to_stage: transaction.stage,
      });

      return transaction;
    });
  }

  async completeClaimsReview(
    user: AuthenticatedUser,
    transactionId: string,
    approved: boolean,
    reason?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const cancellation = await manager
        .getRepository(PolicyCancellation)
        .findOne({
          where: {
            policy_transaction_id: transactionId,
            company_id: user.companyId!,
          },
        });

      if (!cancellation) {
        throw new BadRequestException('Cancellation not found');
      }

      cancellation.claims_review_status = approved ? 'CLEARED' : 'BLOCKED';
      await manager.getRepository(PolicyCancellation).save(cancellation);

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: user.companyId!,
        policy_transaction_id: transactionId,
        event_type: PolicyTransactionEventType.CHANGE_ADDED,
        actor_type: 'USER',
        actor_id: user.id,
        reason: reason ?? null,
        metadata: { claimsReviewStatus: cancellation.claims_review_status },
      });

      return cancellation;
    });
  }

  async complete(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.dataSource.transaction(async (manager) => {
      const transaction = await manager
        .getRepository(PolicyTransaction)
        .findOne({
          where: {
            id: transactionId,
            company_id: user.companyId!,
            transaction_type: PolicyTransactionType.CANCELLATION,
          },
        });

      if (!transaction) {
        throw new BadRequestException('Cancellation not found');
      }

      if (transaction.stage !== 'DRAFT') {
        throw new UnprocessableEntityException(
          `Cancellation cannot be completed while in stage ${transaction.stage}.`,
        );
      }

      const cancellation = await manager
        .getRepository(PolicyCancellation)
        .findOne({
          where: { policy_transaction_id: transaction.id },
        });

      if (
        cancellation?.claims_review_required &&
        cancellation.claims_review_status === 'PENDING'
      ) {
        throw new UnprocessableEntityException(
          'Claims review must be resolved before this cancellation can be completed.',
        );
      }

      if (
        cancellation?.claims_review_required &&
        cancellation.claims_review_status === 'BLOCKED'
      ) {
        throw new UnprocessableEntityException(
          'Claims review blocked this cancellation.',
        );
      }

      transaction.approval_required =
        Boolean(cancellation?.rule_snapshot?.['requireApproval'] ?? true) ||
        Boolean(cancellation?.claims_review_required);
      transaction.payment_required = isPositiveAmount(
        transaction.additional_premium,
      );
      transaction.completed_by = user.id;
      transaction.completed_at = new Date();

      return manager.getRepository(PolicyTransaction).save(transaction);
    });

    return this.lifecycleService.evaluateRequirements(
      user.companyId!,
      transaction.id,
      { changedBy: user.id },
    );
  }

  async requestPayment(user: AuthenticatedUser, transactionId: string) {
    const invoice = await this.dataSource.transaction(async (manager) => {
      const transaction = await manager
        .getRepository(PolicyTransaction)
        .findOne({
          where: {
            id: transactionId,
            company_id: user.companyId!,
            transaction_type: PolicyTransactionType.CANCELLATION,
          },
        });

      if (!transaction) {
        throw new BadRequestException('Cancellation not found');
      }

      if (!isPositiveAmount(transaction.additional_premium)) {
        throw new UnprocessableEntityException(
          'This cancellation has no outstanding charge to invoice.',
        );
      }

      const cancellation = await manager
        .getRepository(PolicyCancellation)
        .findOne({
          where: { policy_transaction_id: transaction.id },
        });
      const policy = await manager.getRepository(Policy).findOne({
        where: { id: transaction.source_policy_id },
      });

      if (!cancellation || !policy) {
        throw new BadRequestException(
          'Cancellation or source policy could not be resolved.',
        );
      }

      const invoice = await this.invoiceService.createOrReuseInvoice(manager, {
        companyId: user.companyId!,
        insurerCompanyId: policy.insurer_company_id,
        intermediaryCompanyId: policy.intermediary_company_id,
        customerId: policy.customer_id,
        branchId: policy.branch_id,
        transaction,
        childResourceId: cancellation.id,
        sourceType: InvoiceSourceType.CANCELLATION,
        amount: transaction.additional_premium,
        description: `Cancellation charge for ${transaction.transaction_no}`,
        createdBy: user.id,
      });

      transaction.active_invoice_id = invoice.id;
      await manager.getRepository(PolicyTransaction).save(transaction);

      return invoice;
    });

    await this.lifecycleService.markPaymentRequested(
      user.companyId!,
      transactionId,
      { changedBy: user.id },
    );

    return invoice;
  }

  findAll(companyId: string, policyId?: string) {
    return this.transactionRepository.find({
      where: policyId
        ? {
            company_id: companyId,
            transaction_type: PolicyTransactionType.CANCELLATION,
            source_policy_id: policyId,
          }
        : {
            company_id: companyId,
            transaction_type: PolicyTransactionType.CANCELLATION,
          },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(companyId: string, id: string) {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id,
        company_id: companyId,
        transaction_type: PolicyTransactionType.CANCELLATION,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Cancellation not found');
    }

    return transaction;
  }

  async findContext(companyId: string, id: string) {
    const transaction = await this.findOne(companyId, id);
    const cancellation = await this.cancellationRepository.findOne({
      where: {
        company_id: companyId,
        policy_transaction_id: transaction.id,
      },
    });

    if (!cancellation) {
      throw new BadRequestException('Cancellation details not found');
    }

    return {
      transaction,
      cancellation,
    };
  }
}

function isPositiveAmount(value: string): boolean {
  return Number(value) > 0;
}
