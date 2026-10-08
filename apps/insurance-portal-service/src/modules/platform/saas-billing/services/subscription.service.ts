import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { createHash } from 'crypto';
import { DateTime } from 'luxon';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { Company } from '../../companies/entities/company.entity';
import { CompanySubscription } from '../entities/company-subscription.entity';
import { SaasPlanFeature } from '../entities/saas-plan-feature.entity';
import { SaasPlanMeterRate } from '../entities/saas-plan-meter-rate.entity';
import { SaasPlan } from '../entities/saas-plan.entity';
import { SaasPlanVersion } from '../entities/saas-plan-version.entity';
import { SubscriptionChange } from '../entities/subscription-change.entity';
import { SubscriptionEntitlement } from '../entities/subscription-entitlement.entity';
import {
  BillingInterval,
  EntitlementValueType,
  SaasPlanStatus,
  SaasPlanVersionStatus,
  SubscriptionChangeType,
  SubscriptionStatus,
} from '../enums/saas-billing.enums';

type PlanFeatureInput = Partial<SaasPlanFeature>;
type PlanMeterRateInput = Partial<SaasPlanMeterRate>;

type PlanMutationDto = Partial<SaasPlan> & {
  features?: PlanFeatureInput[];
  meter_rates?: PlanMeterRateInput[];
};

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SaasPlan)
    private readonly planRepository: Repository<SaasPlan>,
    @InjectRepository(SaasPlanVersion)
    private readonly planVersionRepository: Repository<SaasPlanVersion>,
    @InjectRepository(SaasPlanFeature)
    private readonly planFeatureRepository: Repository<SaasPlanFeature>,
    @InjectRepository(SaasPlanMeterRate)
    private readonly planMeterRateRepository: Repository<SaasPlanMeterRate>,
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(SubscriptionChange)
    private readonly subscriptionChangeRepository: Repository<SubscriptionChange>,
    @InjectRepository(SubscriptionEntitlement)
    private readonly entitlementRepository: Repository<SubscriptionEntitlement>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async listPlans() {
    const plans = await this.planRepository.find({
      where: { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });

    return Promise.all(plans.map((plan) => this.findPlan(plan.id)));
  }

  async createPlan(user: AuthenticatedUser, dto: PlanMutationDto) {
    return this.dataSource.transaction(async (manager) => {
      const planRepository = manager.getRepository(SaasPlan);

      const plan = planRepository.create({
        code: dto.code?.trim(),
        name: dto.name?.trim(),
        description: dto.description ?? null,
        applicable_company_types: dto.applicable_company_types ?? [],
        billing_interval: dto.billing_interval ?? BillingInterval.MONTHLY,
        currency: dto.currency ?? 'TZS',
        base_price: dto.base_price ?? '0.00',
        trial_days: dto.trial_days ?? 0,
        status: SaasPlanStatus.DRAFT,
        current_version_number: 1,
        active_version_id: null,
        created_by: user.id,
        updated_by: user.id,
      });

      const savedPlan = await planRepository.save(plan);
      await this.replacePlanFeatures(manager, savedPlan.id, dto.features ?? []);
      await this.replacePlanMeterRates(
        manager,
        savedPlan.id,
        dto.meter_rates ?? [],
      );

      await this.createPlanVersionRecord(manager, savedPlan, {
        versionNumber: 1,
        status: SaasPlanVersionStatus.DRAFT,
        createdBy: user.id,
      });

      return this.findPlan(savedPlan.id);
    });
  }

  async updatePlan(user: AuthenticatedUser, id: string, dto: PlanMutationDto) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.getPlanEntity(id, manager);

      if (plan.active_version_id && dto.code && dto.code.trim() !== plan.code) {
        throw new ConflictException(
          'Published plan codes are immutable. Create a new plan instead.',
        );
      }

      Object.assign(plan, {
        code: dto.code?.trim() ?? plan.code,
        name: dto.name?.trim() ?? plan.name,
        description: dto.description ?? plan.description,
        applicable_company_types:
          dto.applicable_company_types ?? plan.applicable_company_types,
        billing_interval: dto.billing_interval ?? plan.billing_interval,
        currency: dto.currency ?? plan.currency,
        base_price: dto.base_price ?? plan.base_price,
        trial_days: dto.trial_days ?? plan.trial_days,
        updated_by: user.id,
      });

      await manager.getRepository(SaasPlan).save(plan);

      if (dto.features) {
        await this.replacePlanFeatures(manager, plan.id, dto.features);
      }

      if (dto.meter_rates) {
        await this.replacePlanMeterRates(manager, plan.id, dto.meter_rates);
      }

      const editableVersion = await this.ensureEditableVersion(
        manager,
        plan,
        user.id,
      );

      await this.updateVersionSnapshot(
        manager,
        plan,
        editableVersion.id,
        user.id,
      );

      return this.findPlan(plan.id);
    });
  }

  async createPlanVersion(user: AuthenticatedUser, id: string) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.getPlanEntity(id, manager);
      const draftVersion = await manager
        .getRepository(SaasPlanVersion)
        .findOne({
          where: {
            plan_id: plan.id,
            status: SaasPlanVersionStatus.DRAFT,
          },
        });

      if (draftVersion) {
        throw new ConflictException(
          'A draft plan version already exists for this plan.',
        );
      }

      plan.current_version_number += 1;
      plan.updated_by = user.id;
      await manager.getRepository(SaasPlan).save(plan);

      const version = await this.createPlanVersionRecord(manager, plan, {
        versionNumber: plan.current_version_number,
        status: SaasPlanVersionStatus.DRAFT,
        createdBy: user.id,
      });

      return version;
    });
  }

  async listPlanVersions(id: string) {
    await this.getPlanEntity(id);

    return this.planVersionRepository.find({
      where: { plan_id: id },
      order: { version_number: 'DESC' },
    });
  }

  async approvePlanVersion(
    user: AuthenticatedUser,
    planId: string,
    versionId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.getPlanEntity(planId, manager);
      const version = await this.getPlanVersion(planId, versionId, manager);

      if (version.status !== SaasPlanVersionStatus.DRAFT) {
        throw new ConflictException('Only draft versions can be approved.');
      }

      version.status = SaasPlanVersionStatus.APPROVED;
      version.approved_by = user.id;
      version.approved_at = new Date();
      return manager.getRepository(SaasPlanVersion).save(version);
    });
  }

  async publishPlanVersion(
    user: AuthenticatedUser,
    planId: string,
    versionId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.getPlanEntity(planId, manager);
      const version = await this.getPlanVersion(planId, versionId, manager);

      if (version.status !== SaasPlanVersionStatus.APPROVED) {
        throw new ConflictException(
          'Only approved plan versions can be published.',
        );
      }

      if (plan.active_version_id) {
        await manager
          .getRepository(SaasPlanVersion)
          .update(plan.active_version_id, {
            status: SaasPlanVersionStatus.SUPERSEDED,
            effective_to: new Date(),
          });
      }

      version.status = SaasPlanVersionStatus.ACTIVE;
      version.effective_from = new Date();
      await manager.getRepository(SaasPlanVersion).save(version);

      plan.active_version_id = version.id;
      plan.current_version_number = Math.max(
        plan.current_version_number,
        version.version_number,
      );
      plan.status = SaasPlanStatus.ACTIVE;
      plan.name = version.name;
      plan.description = version.description;
      plan.billing_interval = version.billing_interval;
      plan.currency = version.currency;
      plan.base_price = version.base_price;
      plan.trial_days = version.trial_days;
      plan.updated_by = user.id;
      await manager.getRepository(SaasPlan).save(plan);

      return this.findPlan(plan.id);
    });
  }

  async activatePlan(user: AuthenticatedUser, id: string) {
    const latestApproved = await this.planVersionRepository.findOne({
      where: {
        plan_id: id,
        status: SaasPlanVersionStatus.APPROVED,
      },
      order: { version_number: 'DESC' },
    });

    if (!latestApproved) {
      throw new ConflictException(
        'Approve a plan version before publishing the plan.',
      );
    }

    return this.publishPlanVersion(user, id, latestApproved.id);
  }

  listSubscriptions() {
    return this.subscriptionRepository.find({
      where: {
        deleted_at: IsNull(),
      },
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findSubscription(id: string) {
    const subscription = await this.getSubscription(id);
    const [changes, entitlements] = await Promise.all([
      this.subscriptionChangeRepository.find({
        where: { subscription_id: id },
        order: { effective_at: 'DESC', created_at: 'DESC' },
        take: 50,
      }),
      this.entitlementRepository.find({
        where: { subscription_id: id, effective_to: IsNull() },
        order: { feature_code: 'ASC' },
      }),
    ]);

    return {
      ...subscription,
      changes,
      entitlements,
    };
  }

  async createSubscription(
    user: AuthenticatedUser,
    dto: {
      company_id: string;
      plan_id: string;
      started_at?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const company = await this.companyRepository.findOne({
      where: { id: dto.company_id, deleted_at: IsNull() },
    });
    if (!company) {
      throw new NotFoundException('Company was not found');
    }

    const plan = await this.planRepository.findOne({
      where: {
        id: dto.plan_id,
        status: SaasPlanStatus.ACTIVE,
        deleted_at: IsNull(),
      },
    });

    if (!plan || !plan.active_version_id) {
      throw new BadRequestException(
        'Only published SaaS plans can be assigned to a subscription.',
      );
    }

    const activeVersion = await this.planVersionRepository.findOne({
      where: { id: plan.active_version_id },
    });

    if (!activeVersion) {
      throw new BadRequestException(
        'The active plan version is missing for this SaaS plan.',
      );
    }

    const existingActive = await this.subscriptionRepository.findOne({
      where: {
        company_id: company.id,
        deleted_at: IsNull(),
        status: In([
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.SUSPENDED,
        ]),
      },
    });

    if (existingActive) {
      throw new BadRequestException(
        'A company cannot have more than one active subscription',
      );
    }

    const startedAt = dto.started_at
      ? DateTime.fromISO(dto.started_at)
      : DateTime.utc();

    const periodEnd = this.addBillingInterval(
      startedAt,
      activeVersion.billing_interval,
    ).minus({ day: 1 });

    const trialEndsAt =
      activeVersion.trial_days > 0
        ? startedAt.plus({ day: activeVersion.trial_days })
        : null;

    const subscription = this.subscriptionRepository.create({
      company_id: company.id,
      plan_id: plan.id,
      plan_version_id: activeVersion.id,
      subscription_no: `SUB-${startedAt.toFormat('yyyyLLddHHmmss')}-${company.id.slice(0, 6).toUpperCase()}`,
      status:
        activeVersion.trial_days > 0
          ? SubscriptionStatus.TRIALING
          : SubscriptionStatus.ACTIVE,
      billing_interval: activeVersion.billing_interval,
      currency: activeVersion.currency,
      base_price: activeVersion.base_price,
      plan_snapshot: activeVersion.plan_snapshot,
      plan_snapshot_hash: activeVersion.plan_snapshot_hash,
      started_at: startedAt.toJSDate(),
      trial_ends_at: trialEndsAt?.toJSDate() ?? null,
      current_period_start: startedAt.toJSDate(),
      current_period_end: periodEnd.toJSDate(),
      next_billing_at: periodEnd.toJSDate(),
      last_billed_at: null,
      metadata: dto.metadata ?? null,
      state_version: 1,
      created_by: user.id,
      updated_by: user.id,
    });

    const savedSubscription =
      await this.subscriptionRepository.save(subscription);
    await this.copyVersionFeaturesToEntitlements(
      savedSubscription.id,
      company.id,
      activeVersion,
    );

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: savedSubscription.id,
        company_id: company.id,
        change_type: SubscriptionChangeType.CREATED,
        old_plan_version_id: null,
        new_plan_version_id: activeVersion.id,
        effective_at: startedAt.toJSDate(),
        change_summary: {
          status: savedSubscription.status,
          subscription_no: savedSubscription.subscription_no,
        },
        changed_by: user.id,
      }),
    );

    return this.subscriptionRepository.findOneByOrFail({
      id: savedSubscription.id,
    });
  }

  async suspendSubscription(
    user: AuthenticatedUser,
    id: string,
    reason?: string,
  ) {
    const subscription = await this.getSubscription(id);
    subscription.status = SubscriptionStatus.SUSPENDED;
    subscription.suspended_at = new Date();
    subscription.suspension_reason = reason ?? null;
    subscription.state_version += 1;
    subscription.updated_by = user.id;
    const saved = await this.subscriptionRepository.save(subscription);

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: subscription.id,
        company_id: subscription.company_id,
        change_type: SubscriptionChangeType.SUSPENDED,
        old_plan_version_id: subscription.plan_version_id,
        new_plan_version_id: subscription.plan_version_id,
        effective_at: saved.suspended_at ?? new Date(),
        change_summary: { reason: reason ?? null },
        changed_by: user.id,
      }),
    );

    return saved;
  }

  async cancelSubscription(user: AuthenticatedUser, id: string) {
    const subscription = await this.getSubscription(id);
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelled_at = new Date();
    subscription.cancel_at_period_end = false;
    subscription.state_version += 1;
    subscription.updated_by = user.id;
    const saved = await this.subscriptionRepository.save(subscription);

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: subscription.id,
        company_id: subscription.company_id,
        change_type: SubscriptionChangeType.CANCELLED,
        old_plan_version_id: subscription.plan_version_id,
        new_plan_version_id: null,
        effective_at: saved.cancelled_at ?? new Date(),
        change_summary: {
          cancel_at_period_end: subscription.cancel_at_period_end,
        },
        changed_by: user.id,
      }),
    );

    return saved;
  }

  async schedulePlanChange(
    user: AuthenticatedUser,
    id: string,
    dto: {
      plan_id: string;
      effective_at?: string;
      reason?: string;
    },
  ) {
    const subscription = await this.getSubscription(id);
    if (
      ![
        SubscriptionStatus.TRIALING,
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
      ].includes(subscription.status)
    ) {
      throw new ConflictException(
        'Only active or past-due subscriptions can schedule a plan change.',
      );
    }

    const plan = await this.planRepository.findOne({
      where: {
        id: dto.plan_id,
        status: SaasPlanStatus.ACTIVE,
        deleted_at: IsNull(),
      },
    });
    if (!plan?.active_version_id) {
      throw new NotFoundException('The target SaaS plan is not published.');
    }

    const version = await this.planVersionRepository.findOneByOrFail({
      id: plan.active_version_id,
    });

    const effectiveAt = dto.effective_at
      ? DateTime.fromISO(dto.effective_at)
      : DateTime.fromJSDate(subscription.current_period_end).plus({
          millisecond: 1,
        });

    if (!effectiveAt.isValid) {
      throw new BadRequestException('Invalid scheduled change date.');
    }

    if (effectiveAt < DateTime.utc()) {
      throw new BadRequestException(
        'Scheduled subscription changes must be in the future.',
      );
    }

    subscription.scheduled_plan_id = plan.id;
    subscription.scheduled_plan_version_id = version.id;
    subscription.scheduled_change_at = effectiveAt.toJSDate();
    subscription.cancel_at_period_end = false;
    subscription.updated_by = user.id;
    subscription.state_version += 1;
    const saved = await this.subscriptionRepository.save(subscription);

    const changeType =
      Number(version.base_price) >= Number(subscription.base_price)
        ? SubscriptionChangeType.UPGRADE
        : SubscriptionChangeType.DOWNGRADE;

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: saved.id,
        company_id: saved.company_id,
        change_type: changeType,
        old_plan_version_id: saved.plan_version_id,
        new_plan_version_id: version.id,
        effective_at: effectiveAt.toJSDate(),
        change_summary: {
          status: 'SCHEDULED',
          reason: dto.reason ?? null,
          scheduled_change_at: effectiveAt.toISO(),
        },
        changed_by: user.id,
      }),
    );

    return saved;
  }

  async scheduleCancellation(
    user: AuthenticatedUser,
    id: string,
    reason?: string,
  ) {
    const subscription = await this.getSubscription(id);
    if (
      ![
        SubscriptionStatus.TRIALING,
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.SUSPENDED,
      ].includes(subscription.status)
    ) {
      throw new ConflictException(
        'This subscription cannot be scheduled for cancellation.',
      );
    }

    subscription.cancel_at_period_end = true;
    subscription.scheduled_plan_id = null;
    subscription.scheduled_plan_version_id = null;
    subscription.scheduled_change_at = subscription.current_period_end;
    subscription.updated_by = user.id;
    subscription.state_version += 1;
    const saved = await this.subscriptionRepository.save(subscription);

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: saved.id,
        company_id: saved.company_id,
        change_type: SubscriptionChangeType.CANCELLED,
        old_plan_version_id: saved.plan_version_id,
        new_plan_version_id: null,
        effective_at: saved.current_period_end,
        change_summary: {
          status: 'SCHEDULED',
          reason: reason ?? null,
          cancel_at_period_end: true,
        },
        changed_by: user.id,
      }),
    );

    return saved;
  }

  async reactivateSubscription(id: string, changedBy?: string) {
    const subscription = await this.getSubscription(id);
    if (
      ![SubscriptionStatus.SUSPENDED, SubscriptionStatus.PAST_DUE].includes(
        subscription.status,
      )
    ) {
      return subscription;
    }

    const now = DateTime.utc();
    subscription.status =
      subscription.trial_ends_at &&
      DateTime.fromJSDate(subscription.trial_ends_at) > now
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE;
    subscription.suspended_at = null;
    subscription.suspension_reason = null;
    subscription.grace_period_ends_at = null;
    subscription.updated_by = changedBy ?? subscription.updated_by;
    subscription.state_version += 1;
    const saved = await this.subscriptionRepository.save(subscription);

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: saved.id,
        company_id: saved.company_id,
        change_type: SubscriptionChangeType.UNSUSPENSION,
        old_plan_version_id: saved.plan_version_id,
        new_plan_version_id: saved.plan_version_id,
        effective_at: new Date(),
        change_summary: {
          restored_status: saved.status,
          source: 'PAYMENT_RESTORED',
        },
        changed_by: changedBy ?? null,
      }),
    );

    return saved;
  }

  @Cron(process.env.SAAS_SCHEDULED_CHANGES_CRON ?? '0 */15 * * * *')
  async processScheduledChanges() {
    return this.applyDueScheduledChanges();
  }

  async applyDueScheduledChanges() {
    const now = new Date();
    const dueSubscriptions = await this.subscriptionRepository.find({
      where: {
        deleted_at: IsNull(),
      },
      order: { scheduled_change_at: 'ASC' },
    });

    let processed = 0;

    for (const subscription of dueSubscriptions) {
      if (
        !subscription.scheduled_change_at ||
        subscription.scheduled_change_at > now
      ) {
        continue;
      }

      if (subscription.cancel_at_period_end) {
        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.cancelled_at = now;
        subscription.cancel_at_period_end = false;
        subscription.scheduled_plan_id = null;
        subscription.scheduled_plan_version_id = null;
        subscription.scheduled_change_at = null;
        subscription.state_version += 1;
        const saved = await this.subscriptionRepository.save(subscription);
        await this.subscriptionChangeRepository.save(
          this.subscriptionChangeRepository.create({
            subscription_id: saved.id,
            company_id: saved.company_id,
            change_type: SubscriptionChangeType.CANCELLED,
            old_plan_version_id: saved.plan_version_id,
            new_plan_version_id: null,
            effective_at: now,
            change_summary: {
              status: 'APPLIED',
              cancel_at_period_end: true,
            },
            changed_by: saved.updated_by ?? null,
          }),
        );
        processed += 1;
        continue;
      }

      if (
        subscription.scheduled_plan_id &&
        subscription.scheduled_plan_version_id
      ) {
        await this.applyScheduledPlanChange(subscription, now);
        processed += 1;
      }
    }

    return { processed };
  }

  private async applyScheduledPlanChange(
    subscription: CompanySubscription,
    appliedAt: Date,
  ) {
    const oldPlanVersionId = subscription.plan_version_id;
    const version = await this.planVersionRepository.findOneByOrFail({
      id: subscription.scheduled_plan_version_id!,
    });

    await this.entitlementRepository.update(
      {
        subscription_id: subscription.id,
        company_id: subscription.company_id,
        effective_to: IsNull(),
      },
      { effective_to: appliedAt },
    );

    subscription.plan_id = subscription.scheduled_plan_id!;
    subscription.plan_version_id = version.id;
    subscription.billing_interval = version.billing_interval;
    subscription.currency = version.currency;
    subscription.base_price = version.base_price;
    subscription.plan_snapshot = version.plan_snapshot;
    subscription.plan_snapshot_hash = version.plan_snapshot_hash;
    subscription.current_period_start = appliedAt;
    subscription.current_period_end = this.addBillingInterval(
      DateTime.fromJSDate(appliedAt),
      version.billing_interval,
    )
      .minus({ day: 1 })
      .toJSDate();
    subscription.last_billed_at = appliedAt;
    subscription.next_billing_at = subscription.current_period_end;
    subscription.scheduled_plan_id = null;
    subscription.scheduled_plan_version_id = null;
    subscription.scheduled_change_at = null;
    subscription.state_version += 1;

    const saved = await this.subscriptionRepository.save(subscription);
    await this.copyVersionFeaturesToEntitlements(
      saved.id,
      saved.company_id,
      version,
    );

    await this.subscriptionChangeRepository.save(
      this.subscriptionChangeRepository.create({
        subscription_id: saved.id,
        company_id: saved.company_id,
        change_type: SubscriptionChangeType.PLAN_CHANGED,
        old_plan_version_id: oldPlanVersionId,
        new_plan_version_id: version.id,
        effective_at: appliedAt,
        change_summary: {
          status: 'APPLIED',
          current_period_end: saved.current_period_end.toISOString(),
        },
        changed_by: saved.updated_by ?? null,
      }),
    );

    return saved;
  }

  private async findPlan(id: string) {
    const plan = await this.planRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!plan) {
      throw new NotFoundException('SaaS plan was not found');
    }

    const [features, meterRates, versions] = await Promise.all([
      this.planFeatureRepository.find({
        where: { plan_id: plan.id },
        order: { feature_code: 'ASC' },
      }),
      this.planMeterRateRepository.find({
        where: { plan_id: plan.id },
        order: { metric_code: 'ASC' },
      }),
      this.planVersionRepository.find({
        where: { plan_id: plan.id },
        order: { version_number: 'DESC' },
      }),
    ]);

    return {
      ...plan,
      features,
      meter_rates: meterRates,
      versions,
    };
  }

  private async getSubscription(id: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!subscription) {
      throw new NotFoundException('Company subscription was not found');
    }

    return subscription;
  }

  private async getPlanEntity(id: string, manager?: EntityManager) {
    const repository = manager?.getRepository(SaasPlan) ?? this.planRepository;
    const plan = await repository.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!plan) {
      throw new NotFoundException('SaaS plan was not found');
    }

    return plan;
  }

  private async getPlanVersion(
    planId: string,
    versionId: string,
    manager?: EntityManager,
  ) {
    const repository =
      manager?.getRepository(SaasPlanVersion) ?? this.planVersionRepository;
    const version = await repository.findOne({
      where: { id: versionId, plan_id: planId },
    });

    if (!version) {
      throw new NotFoundException('SaaS plan version was not found');
    }

    return version;
  }

  private async ensureEditableVersion(
    manager: EntityManager,
    plan: SaasPlan,
    userId: string,
  ) {
    const versionRepository = manager.getRepository(SaasPlanVersion);
    const existingDraft = await versionRepository.findOne({
      where: {
        plan_id: plan.id,
        status: SaasPlanVersionStatus.DRAFT,
      },
      order: { version_number: 'DESC' },
    });

    if (existingDraft) {
      return existingDraft;
    }

    if (!plan.active_version_id) {
      const firstVersion = await versionRepository.findOne({
        where: { plan_id: plan.id },
        order: { version_number: 'DESC' },
      });

      if (!firstVersion) {
        plan.current_version_number = Math.max(plan.current_version_number, 1);
        await manager.getRepository(SaasPlan).save(plan);

        return this.createPlanVersionRecord(manager, plan, {
          versionNumber: plan.current_version_number,
          status: SaasPlanVersionStatus.DRAFT,
          createdBy: userId,
        });
      }

      return firstVersion;
    }

    plan.current_version_number += 1;
    plan.updated_by = userId;
    await manager.getRepository(SaasPlan).save(plan);

    return this.createPlanVersionRecord(manager, plan, {
      versionNumber: plan.current_version_number,
      status: SaasPlanVersionStatus.DRAFT,
      createdBy: userId,
    });
  }

  private async createPlanVersionRecord(
    manager: EntityManager,
    plan: SaasPlan,
    options: {
      versionNumber: number;
      status: SaasPlanVersionStatus;
      createdBy: string;
    },
  ) {
    const snapshot = await this.buildPlanSnapshot(manager, plan);

    const version = manager.getRepository(SaasPlanVersion).create({
      plan_id: plan.id,
      version_number: options.versionNumber,
      status: options.status,
      name: plan.name,
      description: plan.description,
      billing_interval: plan.billing_interval,
      currency: plan.currency,
      base_price: String(plan.base_price),
      trial_days: plan.trial_days,
      feature_snapshot: snapshot.features,
      meter_rate_snapshot: snapshot.meterRates,
      plan_snapshot: snapshot.plan,
      plan_snapshot_hash: snapshot.hash,
      created_by: options.createdBy,
      approved_by:
        options.status === SaasPlanVersionStatus.ACTIVE
          ? options.createdBy
          : null,
      approved_at:
        options.status === SaasPlanVersionStatus.ACTIVE ? new Date() : null,
      effective_from:
        options.status === SaasPlanVersionStatus.ACTIVE ? new Date() : null,
      effective_to: null,
    });

    return manager.getRepository(SaasPlanVersion).save(version);
  }

  private async updateVersionSnapshot(
    manager: EntityManager,
    plan: SaasPlan,
    versionId: string,
    userId: string,
  ) {
    const snapshot = await this.buildPlanSnapshot(manager, plan);
    const version = await manager
      .getRepository(SaasPlanVersion)
      .findOneByOrFail({
        id: versionId,
      });

    version.name = plan.name;
    version.description = plan.description;
    version.billing_interval = plan.billing_interval;
    version.currency = plan.currency;
    version.base_price = String(plan.base_price);
    version.trial_days = plan.trial_days;
    version.feature_snapshot = snapshot.features;
    version.meter_rate_snapshot = snapshot.meterRates;
    version.plan_snapshot = snapshot.plan;
    version.plan_snapshot_hash = snapshot.hash;
    version.created_by = userId;
    version.approved_by = null;
    version.approved_at = null;
    version.status = SaasPlanVersionStatus.DRAFT;

    await manager.getRepository(SaasPlanVersion).save(version);
  }

  private async buildPlanSnapshot(manager: EntityManager, plan: SaasPlan) {
    const [features, meterRates] = await Promise.all([
      manager.getRepository(SaasPlanFeature).find({
        where: { plan_id: plan.id },
        order: { feature_code: 'ASC' },
      }),
      manager.getRepository(SaasPlanMeterRate).find({
        where: { plan_id: plan.id },
        order: { metric_code: 'ASC' },
      }),
    ]);

    const featureSnapshot = features.map((feature) => ({
      feature_code: feature.feature_code,
      value_type: feature.value_type,
      value: feature.value,
      description: feature.description,
    }));

    const meterRateSnapshot = meterRates.map((rate) => ({
      metric_code: rate.metric_code,
      included_quantity: rate.included_quantity,
      billing_unit: rate.billing_unit,
      unit_price: rate.unit_price,
      currency: rate.currency,
      is_active: rate.is_active,
    }));

    const planSnapshot = {
      plan_id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      applicable_company_types: plan.applicable_company_types ?? [],
      billing_interval: plan.billing_interval,
      currency: plan.currency,
      base_price: String(plan.base_price),
      trial_days: plan.trial_days,
      features: featureSnapshot,
      meter_rates: meterRateSnapshot,
    };

    return {
      plan: planSnapshot,
      features: featureSnapshot,
      meterRates: meterRateSnapshot,
      hash: createHash('sha256')
        .update(JSON.stringify(planSnapshot))
        .digest('hex'),
    };
  }

  private async replacePlanFeatures(
    manager: EntityManager,
    planId: string,
    features: PlanFeatureInput[],
  ) {
    const repository = manager.getRepository(SaasPlanFeature);
    await repository.delete({ plan_id: planId });

    if (!features.length) {
      return;
    }

    await repository.save(
      features.map((feature) =>
        repository.create({
          plan_id: planId,
          feature_code: feature.feature_code?.trim() ?? '',
          value_type: feature.value_type ?? EntitlementValueType.BOOLEAN,
          value: feature.value ?? true,
          description: feature.description ?? null,
        }),
      ),
    );
  }

  private async replacePlanMeterRates(
    manager: EntityManager,
    planId: string,
    meterRates: PlanMeterRateInput[],
  ) {
    const repository = manager.getRepository(SaasPlanMeterRate);
    await repository.delete({ plan_id: planId });

    if (!meterRates.length) {
      return;
    }

    await repository.save(
      meterRates.map((rate) =>
        repository.create({
          plan_id: planId,
          metric_code: rate.metric_code?.trim() ?? '',
          included_quantity: rate.included_quantity ?? '0',
          billing_unit: rate.billing_unit ?? '1',
          unit_price: rate.unit_price ?? '0',
          currency: rate.currency ?? 'TZS',
          is_active: rate.is_active ?? true,
        }),
      ),
    );
  }

  private async copyVersionFeaturesToEntitlements(
    subscriptionId: string,
    companyId: string,
    version: SaasPlanVersion,
  ) {
    const features = (version.feature_snapshot ?? []) as Array<{
      feature_code?: string;
      value_type?: EntitlementValueType;
      value?: unknown;
    }>;

    if (!features.length) {
      return;
    }

    await this.entitlementRepository.save(
      features
        .filter((feature) => feature.feature_code)
        .map((feature) =>
          this.entitlementRepository.create({
            subscription_id: subscriptionId,
            company_id: companyId,
            feature_code: feature.feature_code!,
            value_type: feature.value_type ?? EntitlementValueType.BOOLEAN,
            value: feature.value ?? true,
            source: 'PLAN_VERSION',
          }),
        ),
    );
  }

  private addBillingInterval(
    value: DateTime<true> | DateTime<false>,
    interval: BillingInterval,
  ) {
    switch (interval) {
      case BillingInterval.QUARTERLY:
        return value.plus({ month: 3 });
      case BillingInterval.YEARLY:
        return value.plus({ year: 1 });
      case BillingInterval.MONTHLY:
      default:
        return value.plus({ month: 1 });
    }
  }
}
