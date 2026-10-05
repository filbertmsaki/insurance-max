import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  PolicyTransactionEventType,
  PolicyTransactionStage,
  PolicyTransactionType,
  PolicyVersionType,
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
import { RenewalQuotationFactoryService } from './renewal-quotation-factory.service';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';

const ACTIVE_RENEWAL_STAGES = [
  RenewalLifecycleStatus.ELIGIBLE,
  RenewalLifecycleStatus.OFFER_DRAFT,
  RenewalLifecycleStatus.OFFER_READY,
  RenewalLifecycleStatus.OFFER_SENT,
  RenewalLifecycleStatus.CUSTOMER_ACCEPTED,
  RenewalLifecycleStatus.PAYMENT_PENDING,
  RenewalLifecycleStatus.SUBMISSION_PROCESSING,
];

/** Statuses an offer can be (re)sent from. */
const SENDABLE_RENEWAL_STATUSES: RenewalLifecycleStatus[] = [
  RenewalLifecycleStatus.OFFER_DRAFT,
  RenewalLifecycleStatus.OFFER_READY,
  RenewalLifecycleStatus.OFFER_SENT,
];

/** Statuses a customer can accept the offer from. */
const ACCEPTABLE_RENEWAL_STATUSES: RenewalLifecycleStatus[] = [
  RenewalLifecycleStatus.OFFER_DRAFT,
  RenewalLifecycleStatus.OFFER_READY,
  RenewalLifecycleStatus.OFFER_SENT,
];

/** Statuses a renewal can no longer be declined from. */
const NON_DECLINABLE_RENEWAL_STATUSES: RenewalLifecycleStatus[] = [
  RenewalLifecycleStatus.SUBMISSION_PROCESSING,
  RenewalLifecycleStatus.RENEWED,
  RenewalLifecycleStatus.CUSTOMER_DECLINED,
  RenewalLifecycleStatus.LAPSED,
  RenewalLifecycleStatus.CANCELLED,
];

const TERMINAL_TRANSACTION_STAGES: PolicyTransactionStage[] = [
  PolicyTransactionStage.APPLIED,
  PolicyTransactionStage.CANCELLED,
  PolicyTransactionStage.EXPIRED,
  PolicyTransactionStage.REJECTED,
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
    private readonly quotationFactory: RenewalQuotationFactoryService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly dataAccessScopeService: DataAccessScopeService,
  ) {}

  async getEligibility(user: AuthenticatedUser, policyId: string) {
    const policy = await this.findPolicyInUserScope(
      user,
      policyId,
      'renewals:create',
    );

    if (!policy) {
      throw new BadRequestException('Policy not found');
    }

    const result = await this.dataSource.transaction((manager) =>
      this.eligibilityService.validate(manager, policy),
    );

    return {
      eligible: result.eligible,
      blockers: result.blockers,
      renewalStartDate: result.renewalStartDate,
      renewalEndDate: result.renewalEndDate,
      coverNoteEndDate: result.coverNoteEndDate,
      prevCoverNoteReferenceNumber: result.prevCoverNoteReferenceNumber,
      renewalOfPolicyId: result.renewalOfPolicyId,
      renewalSequence: result.renewalSequence,
      renewalWindowBeforeDays: result.renewalWindowBeforeDays,
      renewalWindowAfterDays: result.renewalWindowAfterDays,
      renewalProductVersionId: result.renewalProductVersionId,
      renewalProductDefinitionHash: result.renewalProductDefinitionHash,
      currentVersion: result.currentVersion
        ? {
            id: result.currentVersion.id,
            version_number: result.currentVersion.version_number,
            version_type: result.currentVersion.version_type,
            regulatory_reference: result.currentVersion.regulatory_reference,
          }
        : null,
    };
  }

  @Cron(process.env.RENEWAL_ELIGIBILITY_CRON || '0 1 * * *')
  async createEligibleRenewals() {
    const beforeDays = Number(
      this.configService.get('RENEWAL_WINDOW_BEFORE_DAYS') ?? 7,
    );
    const afterDays = Number(
      this.configService.get('RENEWAL_WINDOW_AFTER_DAYS') ?? 7,
    );
    const today = new Date();
    const earliest = new Date(today);
    earliest.setUTCDate(earliest.getUTCDate() - afterDays);
    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + beforeDays);

    const candidates = await this.policyRepository
      .createQueryBuilder('policy')
      .where('policy.policy_status IN (:...statuses)', {
        statuses: ['ACTIVE', 'ENDORSED'],
      })
      .andWhere('policy.end_date >= :earliest', {
        earliest: earliest.toISOString().slice(0, 10),
      })
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
    actor?: AuthenticatedUser,
  ) {
    if (
      actor &&
      !(await this.findPolicyInUserScope(actor, policyId, 'renewals:create'))
    ) {
      throw new BadRequestException('Policy not found');
    }
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

      const currentVersion = eligibility.currentVersion;

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
        source_cover_note_reference:
          eligibility.prevCoverNoteReferenceNumber ??
          currentVersion.regulatory_reference ??
          policy.cover_note_no ??
          '',
        previous_policy_id: policy.id,
        previous_cover_note_reference_number:
          eligibility.prevCoverNoteReferenceNumber,
        renewal_of_policy_id: eligibility.renewalOfPolicyId,
        renewal_sequence: eligibility.renewalSequence ?? 1,
      });

      policy.pending_transaction_id = transaction.id;
      await manager.getRepository(Policy).save(policy);

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

  async createRenewalOffer(user: AuthenticatedUser, renewalId: string) {
    await this.assertRenewalInUserScope(
      user,
      renewalId,
      'renewals:create-offer',
    );
    const renewal = await this.requireRenewal(user.companyId!, renewalId);

    if (renewal.renewal_quotation_id) {
      const quotation = await this.dataSource.getRepository(Quotation).findOne({
        where: {
          id: renewal.renewal_quotation_id,
          company_id: user.companyId!,
        },
      });

      if (quotation) {
        return quotation;
      }
    }

    const transaction = await this.transactionRepository.findOne({
      where: {
        id: renewal.policy_transaction_id,
        company_id: user.companyId!,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Renewal transaction not found');
    }

    const [policy, version] = await Promise.all([
      this.policyRepository.findOne({
        where: {
          id: transaction.source_policy_id,
          company_id: user.companyId!,
        },
      }),
      this.dataSource.getRepository(PolicyVersion).findOne({
        where: {
          id: transaction.source_policy_version_id,
          company_id: user.companyId!,
        },
      }),
    ]);

    if (!policy || !version) {
      throw new BadRequestException(
        'Source policy or version could not be resolved.',
      );
    }

    const quotation = await this.quotationFactory.create(user, {
      policy,
      version,
      renewalStartDate: renewal.renewal_start_date,
      renewalEndDate: renewal.renewal_end_date,
      previousCoverNoteReference: renewal.source_cover_note_reference,
    });

    renewal.renewal_quotation_id = quotation.id;
    renewal.renewal_status = RenewalLifecycleStatus.OFFER_DRAFT;
    await this.renewalRepository.save(renewal);

    return quotation;
  }

  /**
   * Links a renewal offer to a quotation created through the existing
   * quotation flow. Building an automated "prefill a new
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
    await this.assertRenewalInUserScope(
      user,
      renewalId,
      'renewals:create-offer',
    );
    const renewal = await this.renewalRepository.findOne({
      where: { id: renewalId, company_id: user.companyId! },
    });

    if (!renewal) {
      throw new BadRequestException('Renewal not found');
    }

    const quotationQuery = this.dataSource
      .getRepository(Quotation)
      .createQueryBuilder('quotation')
      .where('quotation.id = :quotationId', { quotationId })
      .andWhere('quotation.company_id = :companyId', {
        companyId: user.companyId!,
      });
    this.dataAccessScopeService.applyQuotationReadScope(
      quotationQuery,
      'quotation',
      this.dataAccessScopeService.resolve(user, 'quotations:update'),
    );
    const quotation = await quotationQuery.getOne();

    if (!quotation) {
      throw new BadRequestException('Quotation not found');
    }

    renewal.renewal_quotation_id = quotation.id;
    renewal.renewal_status = RenewalLifecycleStatus.OFFER_READY;

    return this.renewalRepository.save(renewal);
  }

  async sendOffer(user: AuthenticatedUser, renewalId: string) {
    await this.assertRenewalInUserScope(user, renewalId, 'renewals:send-offer');
    const renewal = await this.requireRenewal(user.companyId!, renewalId);
    this.assertRenewalStatus(renewal, SENDABLE_RENEWAL_STATUSES, 'sent');

    if (!renewal.renewal_quotation_id) {
      throw new ConflictException({
        code: 'RENEWAL_OFFER_QUOTATION_MISSING',
        message: 'Create the renewal quotation before sending the offer.',
      });
    }

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
    await this.assertRenewalInUserScope(user, renewalId, 'renewals:accept');
    const renewal = await this.requireRenewal(user.companyId!, renewalId);
    this.assertRenewalStatus(renewal, ACCEPTABLE_RENEWAL_STATUSES, 'accepted');

    if (
      renewal.renewal_status === RenewalLifecycleStatus.OFFER_SENT &&
      renewal.offer_expires_at &&
      new Date(renewal.offer_expires_at).getTime() <= Date.now()
    ) {
      throw new ConflictException({
        code: 'RENEWAL_OFFER_EXPIRED',
        message: 'This renewal offer has expired.',
      });
    }

    const transaction = await this.transactionRepository.findOne({
      where: { id: renewal.policy_transaction_id, company_id: user.companyId! },
    });

    if (!transaction) {
      throw new BadRequestException('Renewal transaction not found');
    }

    const policy = await this.policyRepository.findOne({
      where: { id: transaction.source_policy_id, company_id: user.companyId! },
    });

    if (
      !policy ||
      policy.active_version_id !== transaction.source_policy_version_id
    ) {
      throw new BadRequestException({
        code: 'RENEWAL_SOURCE_POLICY_CHANGED',
        message:
          'The source policy changed after this renewal offer was prepared.',
      });
    }

    renewal.renewal_status = RenewalLifecycleStatus.CUSTOMER_ACCEPTED;
    renewal.customer_accepted_at = new Date();

    return this.renewalRepository.save(renewal);
  }

  async decline(user: AuthenticatedUser, renewalId: string, reason: string) {
    await this.assertRenewalInUserScope(user, renewalId, 'renewals:decline');
    const renewal = await this.requireRenewal(user.companyId!, renewalId);

    if (NON_DECLINABLE_RENEWAL_STATUSES.includes(renewal.renewal_status)) {
      throw this.invalidStatus(renewal, 'declined');
    }

    return this.dataSource.transaction(async (manager) => {
      renewal.renewal_status = RenewalLifecycleStatus.CUSTOMER_DECLINED;
      renewal.customer_declined_at = new Date();
      renewal.decline_reason = reason;
      const saved = await manager.getRepository(PolicyRenewal).save(renewal);

      await this.closeRenewalTransaction(manager, renewal, {
        stage: PolicyTransactionStage.CANCELLED,
        eventType: PolicyTransactionEventType.CANCELLED,
        actorId: user.id,
        reason,
      });

      return saved;
    });
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
      const lockedRenewal = await manager
        .getRepository(PolicyRenewal)
        .createQueryBuilder('renewal')
        .setLock('pessimistic_write')
        .where('renewal.id = :id', { id: renewal.id })
        .getOneOrFail();

      if (
        lockedRenewal.renewal_status === RenewalLifecycleStatus.RENEWED &&
        lockedRenewal.renewed_policy_id === newPolicy.id
      ) {
        return lockedRenewal;
      }

      if (
        lockedRenewal.renewed_policy_id &&
        lockedRenewal.renewed_policy_id !== newPolicy.id
      ) {
        throw new BadRequestException({
          code: 'RENEWAL_ALREADY_ISSUED_TO_DIFFERENT_POLICY',
          message: 'This renewal already produced another policy.',
        });
      }

      if (!newPolicy.issued_by_system || newPolicy.tira_status !== 'SUCCESS') {
        throw new BadRequestException(
          'Renewed policy is not a successful TIRAMIS-issued policy.',
        );
      }

      const transaction = await manager
        .getRepository(PolicyTransaction)
        .findOneOrFail({
          where: { id: lockedRenewal.policy_transaction_id },
        });
      const oldPolicy = await manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', {
          policyId: transaction.source_policy_id,
        })
        .getOneOrFail();
      const persistedNewPolicy = await manager
        .getRepository(Policy)
        .findOneOrFail({ where: { id: newPolicy.id } });

      oldPolicy.renewed_to_policy_id = persistedNewPolicy.id;
      oldPolicy.renewal_status = RenewalLifecycleStatus.RENEWED;
      oldPolicy.pending_transaction_id = null;
      await manager.getRepository(Policy).save(oldPolicy);

      persistedNewPolicy.renewed_from_policy_id = oldPolicy.id;
      persistedNewPolicy.previous_policy_id = oldPolicy.id;
      persistedNewPolicy.previous_cover_note_reference_number =
        lockedRenewal.previous_cover_note_reference_number ??
        lockedRenewal.source_cover_note_reference;
      persistedNewPolicy.renewal_of_policy_id =
        lockedRenewal.renewal_of_policy_id ??
        oldPolicy.renewal_of_policy_id ??
        oldPolicy.id;
      persistedNewPolicy.renewal_sequence =
        lockedRenewal.renewal_sequence ??
        Number(oldPolicy.renewal_sequence ?? 0) + 1;
      await manager.getRepository(Policy).save(persistedNewPolicy);

      if (persistedNewPolicy.active_version_id) {
        const version = await manager.getRepository(PolicyVersion).findOne({
          where: { id: persistedNewPolicy.active_version_id },
        });

        if (version) {
          const snapshot = JSON.parse(
            JSON.stringify(version.policy_snapshot),
          ) as Record<string, unknown>;

          snapshot['renewal'] = {
            renewalId: lockedRenewal.id,
            renewalNo: lockedRenewal.renewal_no,
            renewedFromPolicyId: oldPolicy.id,
            renewedFromPolicyNo: oldPolicy.policy_no,
            previousCoverNoteReference:
              lockedRenewal.previous_cover_note_reference_number ??
              lockedRenewal.source_cover_note_reference,
            renewalOfPolicyId: persistedNewPolicy.renewal_of_policy_id,
            renewalSequence: persistedNewPolicy.renewal_sequence,
          };
          version.version_type = PolicyVersionType.RENEWAL;
          version.policy_snapshot = snapshot;
          version.policy_snapshot_hash =
            this.hashService.hashDefinition(snapshot);
          await manager.getRepository(PolicyVersion).save(version);
        }
      }

      lockedRenewal.renewed_policy_id = persistedNewPolicy.id;
      lockedRenewal.renewal_status = RenewalLifecycleStatus.RENEWED;
      await manager.getRepository(PolicyRenewal).save(lockedRenewal);

      const fromStage = transaction.stage;
      transaction.stage = PolicyTransactionStage.APPLIED;
      transaction.target_policy_id = persistedNewPolicy.id;
      transaction.target_policy_version_id =
        persistedNewPolicy.active_version_id;
      transaction.tiramis_transaction_id =
        persistedNewPolicy.tiramis_transaction_id;
      transaction.tiramis_request_id = persistedNewPolicy.tiramis_request_id;
      transaction.tiramis_tracking_id =
        persistedNewPolicy.tiramis_submission_tracking_id;
      transaction.regulatory_response =
        persistedNewPolicy.regulatory_response_payload;
      transaction.regulatory_response_hash =
        persistedNewPolicy.regulatory_response_hash;
      transaction.last_command = 'RENEWAL_POLICY_ISSUED';
      await manager.getRepository(PolicyTransaction).save(transaction);

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.RENEWAL_POLICY_ISSUED,
        actor_type: 'SYSTEM',
        from_stage: fromStage,
        to_stage: PolicyTransactionStage.APPLIED,
        metadata: {
          sourcePolicyId: oldPolicy.id,
          sourcePolicyNo: oldPolicy.policy_no,
          renewedPolicyId: persistedNewPolicy.id,
          renewedPolicyNo: persistedNewPolicy.policy_no,
          previousCoverNoteReference:
            lockedRenewal.previous_cover_note_reference_number ??
            lockedRenewal.source_cover_note_reference,
          renewalOfPolicyId: persistedNewPolicy.renewal_of_policy_id,
          renewalSequence: persistedNewPolicy.renewal_sequence,
          newCoverNoteReference: persistedNewPolicy.cover_note_no,
        },
      });

      return lockedRenewal;
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
      await this.dataSource.transaction(async (manager) => {
        renewal.renewal_status = RenewalLifecycleStatus.LAPSED;
        await manager.getRepository(PolicyRenewal).save(renewal);
        await this.closeRenewalTransaction(manager, renewal, {
          stage: PolicyTransactionStage.EXPIRED,
          eventType: PolicyTransactionEventType.EXPIRED,
          actorId: null,
          reason: 'Renewal offer expired',
        });
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const expiredPolicies = await this.policyRepository
      .createQueryBuilder('policy')
      .where('policy.policy_status = :status', { status: 'ACTIVE' })
      .andWhere('policy.end_date < :today', { today })
      .getMany();

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

  findAll(companyId: string, policyId?: string, user?: AuthenticatedUser) {
    const query = this.renewalRepository
      .createQueryBuilder('renewal')
      .innerJoin(
        PolicyTransaction,
        'transaction',
        'transaction.id = renewal.policy_transaction_id',
      )
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .where('renewal.company_id = :companyId', { companyId })
      .orderBy('renewal.created_at', 'DESC');

    if (user)
      this.dataAccessScopeService.applyPolicyReadScope(
        query,
        'policy',
        this.dataAccessScopeService.resolve(user, 'renewals:read'),
      );

    if (policyId) {
      query.andWhere('transaction.source_policy_id = :policyId', { policyId });
    }

    return query.getMany();
  }

  async findContext(
    companyId: string,
    renewalId: string,
    user?: AuthenticatedUser,
  ) {
    if (user)
      await this.assertRenewalInUserScope(user, renewalId, 'renewals:read');
    const renewal = await this.requireRenewal(companyId, renewalId);
    const transaction = await this.transactionRepository.findOne({
      where: { id: renewal.policy_transaction_id, company_id: companyId },
    });
    const sourcePolicy = transaction
      ? await this.policyRepository.findOne({
          where: { id: transaction.source_policy_id, company_id: companyId },
        })
      : null;
    const quotation = renewal.renewal_quotation_id
      ? await this.dataSource.getRepository(Quotation).findOne({
          where: { id: renewal.renewal_quotation_id, company_id: companyId },
        })
      : null;

    return {
      renewal,
      transaction,
      source_policy: sourcePolicy,
      renewal_quotation: quotation,
    };
  }

  /**
   * A declined or lapsed renewal no longer occupies its source policy: move
   * its transaction to a terminal stage and clear the policy's
   * `pending_transaction_id` lock (only while it still points at this
   * transaction) so a new renewal can be started.
   */
  private async closeRenewalTransaction(
    manager: EntityManager,
    renewal: PolicyRenewal,
    close: {
      stage:
        | typeof PolicyTransactionStage.CANCELLED
        | typeof PolicyTransactionStage.EXPIRED;
      eventType: PolicyTransactionEventType;
      actorId: string | null;
      reason: string | null;
    },
  ) {
    const transaction = await manager.getRepository(PolicyTransaction).findOne({
      where: {
        id: renewal.policy_transaction_id,
        company_id: renewal.company_id,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!transaction) {
      return;
    }

    if (transaction.source_policy_id) {
      await manager.getRepository(Policy).update(
        {
          id: transaction.source_policy_id,
          company_id: transaction.company_id,
          pending_transaction_id: transaction.id,
        },
        { pending_transaction_id: null },
      );
    }

    if (TERMINAL_TRANSACTION_STAGES.includes(transaction.stage)) {
      return;
    }

    const fromStage = transaction.stage;
    transaction.stage = close.stage;
    transaction.last_command =
      close.stage === PolicyTransactionStage.CANCELLED
        ? 'RENEWAL_DECLINED'
        : 'RENEWAL_OFFER_LAPSED';

    if (close.stage === PolicyTransactionStage.CANCELLED) {
      transaction.cancelled_by = close.actorId;
      transaction.cancelled_at = new Date();
      transaction.cancellation_reason = close.reason;
    }

    transaction.state_version = Number(transaction.state_version || 1) + 1;
    await manager.getRepository(PolicyTransaction).save(transaction);

    await manager.getRepository(PolicyTransactionEvent).save({
      company_id: transaction.company_id,
      policy_transaction_id: transaction.id,
      event_type: close.eventType,
      actor_type: close.actorId ? 'USER' : 'SYSTEM',
      actor_id: close.actorId,
      from_stage: fromStage,
      to_stage: transaction.stage,
      reason: close.reason,
      metadata: {
        renewalId: renewal.id,
        renewalNo: renewal.renewal_no,
        renewalStatus: renewal.renewal_status,
      },
    });
  }

  private assertRenewalStatus(
    renewal: PolicyRenewal,
    allowed: RenewalLifecycleStatus[],
    action: string,
  ) {
    if (!allowed.includes(renewal.renewal_status)) {
      throw this.invalidStatus(renewal, action);
    }
  }

  private invalidStatus(renewal: PolicyRenewal, action: string) {
    return new ConflictException({
      code: 'RENEWAL_INVALID_STATUS',
      message: `A ${renewal.renewal_status} renewal cannot be ${action}.`,
      details: { renewalStatus: renewal.renewal_status },
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

  private async findPolicyInUserScope(
    user: AuthenticatedUser,
    policyId: string,
    permission: string,
  ): Promise<Policy | null> {
    const query = this.policyRepository
      .createQueryBuilder('policy')
      .where('policy.id = :policyId', { policyId })
      .andWhere('policy.company_id = :companyId', {
        companyId: user.companyId!,
      });
    this.dataAccessScopeService.applyPolicyReadScope(
      query,
      'policy',
      this.dataAccessScopeService.resolve(user, permission),
    );
    return query.getOne();
  }

  private async assertRenewalInUserScope(
    user: AuthenticatedUser,
    renewalId: string,
    permission: string,
  ): Promise<void> {
    const query = this.renewalRepository
      .createQueryBuilder('renewal')
      .innerJoin(
        PolicyTransaction,
        'transaction',
        'transaction.id = renewal.policy_transaction_id',
      )
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .where('renewal.id = :renewalId', { renewalId })
      .andWhere('renewal.company_id = :companyId', {
        companyId: user.companyId!,
      });
    this.dataAccessScopeService.applyPolicyReadScope(
      query,
      'policy',
      this.dataAccessScopeService.resolve(user, permission),
    );
    if (!(await query.getOne()))
      throw new BadRequestException('Renewal not found');
  }
}
