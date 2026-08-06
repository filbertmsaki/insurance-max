import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  PolicyTransactionEventType,
  PolicyTransactionStage,
  PolicyTransactionType,
  RenewalLifecycleStatus,
} from '@insurance-max/contracts';

import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';
import { PolicyRenewal } from '../entities/policy-renewal.entity';
import { RenewalEligibilityService } from './renewal-eligibility.service';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';

const ACTIVE_RENEWAL_STAGES = [
  RenewalLifecycleStatus.ELIGIBLE,
  RenewalLifecycleStatus.OFFER_DRAFT,
  RenewalLifecycleStatus.OFFER_READY,
  RenewalLifecycleStatus.OFFER_SENT,
  RenewalLifecycleStatus.CUSTOMER_ACCEPTED,
  RenewalLifecycleStatus.PAYMENT_PENDING,
  RenewalLifecycleStatus.SUBMISSION_PROCESSING,
];

@Injectable()
export class RenewalService {
  private readonly logger = new Logger(RenewalService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyRenewal)
    private readonly renewalRepository: Repository<PolicyRenewal>,
    private readonly eligibilityService: RenewalEligibilityService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly identifierService: IdentifierGeneratorService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(process.env.RENEWAL_ELIGIBILITY_CRON || '0 1 * * *')
  async createEligibleRenewals() {
    const firstNoticeDays = Number(
      this.configService.get('RENEWAL_FIRST_NOTICE_DAYS') ?? 60,
    );
    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + firstNoticeDays);

    const candidates = await this.policyRepository
      .createQueryBuilder('policy')
      .where('policy.policy_status = :status', { status: 'ACTIVE' })
      .andWhere('policy.end_date <= :horizon', {
        horizon: horizon.toISOString().slice(0, 10),
      })
      .andWhere('policy.renewed_to_policy_id IS NULL')
      .getMany();

    let created = 0;

    for (const policy of candidates) {
      const existing = await this.transactionRepository.findOne({
        where: {
          source_policy_id: policy.id,
          transaction_type: PolicyTransactionType.RENEWAL,
        },
      });

      if (existing) {
        continue;
      }

      try {
        await this.createEligibleRenewal(policy);
        created += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to create renewal candidate for policy ${policy.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    if (created > 0) {
      this.logger.log(`Created ${created} renewal candidate(s)`);
    }
  }

  async createEligibleRenewalForPolicy(
    companyId: string,
    policyId: string,
    actorId: string | null = null,
  ) {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, company_id: companyId },
    });

    if (!policy) {
      throw new BadRequestException('Policy not found');
    }

    return this.createEligibleRenewal(policy, actorId);
  }

  async createEligibleRenewal(policy: Policy, actorId: string | null = null) {
    return this.dataSource.transaction(async (manager) => {
      const eligibility = await this.eligibilityService.validate(
        manager,
        policy,
      );

      if (!eligibility.eligible) {
        throw new BadRequestException({
          code: 'RENEWAL_NOT_ELIGIBLE',
          details: eligibility.blockers,
        });
      }

      const currentVersion = await manager.getRepository(PolicyVersion).findOne({
        where: { policy_id: policy.id, is_current: true },
      });

      if (!currentVersion) {
        throw new BadRequestException(
          'The current policy version could not be resolved.',
        );
      }

      const transactionNo =
        await this.identifierService.generatePolicyTransactionNumber(
          PolicyTransactionType.RENEWAL,
          policy.company_id,
          manager,
        );

      const transaction = await manager.getRepository(PolicyTransaction).save({
        company_id: policy.company_id,
        transaction_no: transactionNo,
        transaction_type: PolicyTransactionType.RENEWAL,
        source_policy_id: policy.id,
        source_policy_version_id: currentVersion.id,
        source_policy_version_no: currentVersion.version_number,
        source_policy_snapshot: currentVersion.policy_snapshot,
        source_policy_snapshot_hash: currentVersion.policy_snapshot_hash,
        effective_date: eligibility.renewalStartDate!,
        reason: 'Scheduled renewal candidate',
        requested_by: actorId ?? policy.created_by ?? policy.customer_id,
        currency_code: policy.currency,
      });

      const renewalNo =
        await this.identifierService.generatePolicyTransactionNumber(
          PolicyTransactionType.RENEWAL,
          policy.company_id,
          manager,
        );

      const renewal = await manager.getRepository(PolicyRenewal).save({
        company_id: policy.company_id,
        policy_transaction_id: transaction.id,
        renewal_no: renewalNo,
        renewal_status: RenewalLifecycleStatus.ELIGIBLE,
        renewal_start_date: eligibility.renewalStartDate!,
        renewal_end_date: eligibility.renewalEndDate!,
        source_cover_note_reference: policy.cover_note_no ?? '',
      });

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: policy.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.CREATED,
        actor_type: actorId ? 'USER' : 'SYSTEM',
        actor_id: actorId,
        to_stage: transaction.stage,
      });

      return renewal;
    });
  }

  /**
   * Links a renewal offer to a quotation created through the existing
   * (Phase 9) quotation flow. Building an automated "prefill a new
   * quotation from the expiring policy" step (§13.23's
   * `quotationDraftService.createFromPolicy`) is a larger integration left
   * for a follow-up pass — today the underwriter creates the renewal
   * quotation normally (current products/rates/customer data, per §13.23's
   * intent) and links it here.
   */
  async linkQuotation(
    user: AuthenticatedUser,
    renewalId: string,
    quotationId: string,
  ) {
    const renewal = await this.renewalRepository.findOne({
      where: { id: renewalId, company_id: user.companyId! },
    });

    if (!renewal) {
      throw new BadRequestException('Renewal not found');
    }

    const quotation = await this.dataSource.getRepository(Quotation).findOne({
      where: { id: quotationId, company_id: user.companyId! },
    });

    if (!quotation) {
      throw new BadRequestException('Quotation not found');
    }

    renewal.renewal_quotation_id = quotation.id;
    renewal.renewal_status = RenewalLifecycleStatus.OFFER_READY;

    return this.renewalRepository.save(renewal);
  }

  async sendOffer(user: AuthenticatedUser, renewalId: string) {
    const renewal = await this.requireRenewal(user.companyId!, renewalId);
    const validDays = Number(
      this.configService.get('RENEWAL_OFFER_VALID_DAYS') ?? 30,
    );
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + validDays);

    renewal.renewal_status = RenewalLifecycleStatus.OFFER_SENT;
    renewal.offer_expires_at = expiresAt;

    return this.renewalRepository.save(renewal);
  }

  async accept(user: AuthenticatedUser, renewalId: string) {
    const renewal = await this.requireRenewal(user.companyId!, renewalId);
    renewal.renewal_status = RenewalLifecycleStatus.CUSTOMER_ACCEPTED;
    renewal.customer_accepted_at = new Date();

    return this.renewalRepository.save(renewal);
  }

  async decline(user: AuthenticatedUser, renewalId: string, reason: string) {
    const renewal = await this.requireRenewal(user.companyId!, renewalId);
    renewal.renewal_status = RenewalLifecycleStatus.CUSTOMER_DECLINED;
    renewal.customer_declined_at = new Date();
    renewal.decline_reason = reason;

    return this.renewalRepository.save(renewal);
  }

  /**
   * Called after a policy is issued through the normal cover-note issuance
   * path (`IssuanceService.applyCoverNoteIssuance`) — if the issuing
   * quotation is linked to a pending renewal, this completes the renewal
   * linkage (§13.25) instead of requiring a bespoke renewal-issuance path.
   */
  async applyIssuedPolicyIfRenewal(newPolicy: Policy) {
    if (!newPolicy.quotation_id) {
      return null;
    }

    const renewal = await this.renewalRepository.findOne({
      where: { renewal_quotation_id: newPolicy.quotation_id },
    });

    if (!renewal) {
      return null;
    }

    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.getRepository(PolicyTransaction).findOne({
        where: { id: renewal.policy_transaction_id },
      });

      if (!transaction) {
        return null;
      }

      const oldPolicy = await manager.getRepository(Policy).findOne({
        where: { id: transaction.source_policy_id },
      });

      if (oldPolicy) {
        oldPolicy.renewed_to_policy_id = newPolicy.id;
        oldPolicy.renewal_status = RenewalLifecycleStatus.RENEWED;
        oldPolicy.pending_transaction_id = null;
        await manager.getRepository(Policy).save(oldPolicy);
      }

      newPolicy.renewed_from_policy_id = transaction.source_policy_id;
      await manager.getRepository(Policy).save(newPolicy);

      renewal.renewed_policy_id = newPolicy.id;
      renewal.renewal_status = RenewalLifecycleStatus.RENEWED;
      await manager.getRepository(PolicyRenewal).save(renewal);

      transaction.stage = PolicyTransactionStage.APPLIED;
      transaction.target_policy_id = newPolicy.id;
      await manager.getRepository(PolicyTransaction).save(transaction);

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.RENEWAL_POLICY_ISSUED,
        actor_type: 'SYSTEM',
        to_stage: transaction.stage,
        metadata: { newPolicyId: newPolicy.id },
      });

      return renewal;
    });
  }

  @Cron('0 2 * * *')
  async expireLapsedRenewals() {
    const now = new Date();

    const offerExpired = await this.renewalRepository.find({
      where: {
        renewal_status: In([
          RenewalLifecycleStatus.OFFER_SENT,
          RenewalLifecycleStatus.OFFER_READY,
        ]),
        offer_expires_at: LessThanOrEqual(now),
      },
    });

    for (const renewal of offerExpired) {
      renewal.renewal_status = RenewalLifecycleStatus.LAPSED;
      await this.renewalRepository.save(renewal);
    }

    const expiredPolicies = await this.policyRepository.find({
      where: {
        policy_status: 'ACTIVE',
        end_date: LessThanOrEqual(now.toISOString().slice(0, 10)),
        renewed_to_policy_id: IsNull(),
      },
    });

    for (const policy of expiredPolicies) {
      policy.policy_status = 'EXPIRED';
      await this.policyRepository.save(policy);
    }

    if (offerExpired.length || expiredPolicies.length) {
      this.logger.log(
        `Lapsed ${offerExpired.length} renewal offer(s), expired ${expiredPolicies.length} policy(ies)`,
      );
    }
  }

  findAll(companyId: string) {
    return this.renewalRepository.find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
    });
  }

  private async requireRenewal(companyId: string, id: string) {
    const renewal = await this.renewalRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!renewal) {
      throw new BadRequestException('Renewal not found');
    }

    return renewal;
  }
}
