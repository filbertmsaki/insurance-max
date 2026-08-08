import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  CancellationMethod,
  CancellationReasonType,
  InvoiceSourceType,
  PolicyTransactionEventType,
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

export interface CreateCancellationInput {
  effective_date: string;
  reason_type: CancellationReasonType;
  reason: string;
  requested_method?: CancellationMethod;
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
    private readonly configService: ConfigService,
    private readonly invoiceService: PolicyTransactionInvoiceService,
  ) {}

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
      const cancellationMethod = this.resolveCancellationMethod();

      const pricing = this.pricingService.calculate({
        policyStartDate: policy.start_date,
        policyEndDate: policy.end_date,
        cancellationEffectiveDate: dto.effective_date,
        grossWrittenPremium: policy.total_premium,
        cancellationMethod,
      });

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
        return_premium: pricing.refundAmount,
        additional_premium: pricing.amountDue,
      });

      await manager.getRepository(PolicyCancellation).save({
        company_id: user.companyId!,
        policy_transaction_id: transaction.id,
        reason_type: dto.reason_type,
        cancellation_method: cancellationMethod,
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

      transaction.approval_required =
        Boolean(cancellation?.claims_review_required) ||
        isPositiveAmount(transaction.return_premium);
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

  private resolveCancellationMethod(): CancellationMethod {
    const configured = this.configService.get<string>(
      'CANCELLATION_DEFAULT_METHOD',
    );

    return (
      Object.values(CancellationMethod).find((value) => value === configured) ??
      CancellationMethod.PRO_RATA
    );
  }
}

function isPositiveAmount(value: string): boolean {
  return Number(value) > 0;
}
