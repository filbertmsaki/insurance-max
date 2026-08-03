import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DateTime } from 'luxon';
import { In, IsNull, Repository } from 'typeorm';

import { Company } from '../../companies/entities/company.entity';
import { CompanySubscription } from '../entities/company-subscription.entity';
import { SaasPlanFeature } from '../entities/saas-plan-feature.entity';
import { SaasPlan } from '../entities/saas-plan.entity';
import { SubscriptionEntitlement } from '../entities/subscription-entitlement.entity';
import {
  BillingInterval,
  SaasPlanStatus,
  SubscriptionStatus,
} from '../enums/saas-billing.enums';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SaasPlan)
    private readonly planRepository: Repository<SaasPlan>,
    @InjectRepository(SaasPlanFeature)
    private readonly planFeatureRepository: Repository<SaasPlanFeature>,
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(SubscriptionEntitlement)
    private readonly entitlementRepository: Repository<SubscriptionEntitlement>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  listPlans() {
    return this.planRepository.find({
      order: {
        created_at: 'DESC',
      },
    });
  }

  async createPlan(
    user: AuthenticatedUser,
    dto: Partial<SaasPlan> & { features?: Array<Partial<SaasPlanFeature>> },
  ) {
    const plan = this.planRepository.create({
      code: dto.code?.trim(),
      name: dto.name?.trim(),
      description: dto.description ?? null,
      applicable_company_types: dto.applicable_company_types ?? [],
      billing_interval: dto.billing_interval ?? BillingInterval.MONTHLY,
      currency: dto.currency ?? 'TZS',
      base_price: dto.base_price ?? '0.00',
      trial_days: dto.trial_days ?? 0,
      status: dto.status ?? SaasPlanStatus.DRAFT,
      created_by: user.id,
      updated_by: user.id,
    });

    const savedPlan = await this.planRepository.save(plan);

    if (dto.features?.length) {
      const features = dto.features.map((feature) =>
        this.planFeatureRepository.create({
          plan_id: savedPlan.id,
          feature_code: feature.feature_code?.trim() ?? '',
          value_type: feature.value_type,
          value: feature.value,
          description: feature.description ?? null,
        }),
      );

      await this.planFeatureRepository.save(features);
    }

    return this.findPlan(savedPlan.id);
  }

  async updatePlan(
    user: AuthenticatedUser,
    id: string,
    dto: Partial<SaasPlan> & { features?: Array<Partial<SaasPlanFeature>> },
  ) {
    const plan = await this.findPlan(id);

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
      status: dto.status ?? plan.status,
      updated_by: user.id,
    });

    await this.planRepository.save(plan);

    if (dto.features) {
      await this.planFeatureRepository.delete({ plan_id: plan.id });
      if (dto.features.length) {
        await this.planFeatureRepository.save(
          dto.features.map((feature) =>
            this.planFeatureRepository.create({
              plan_id: plan.id,
              feature_code: feature.feature_code?.trim() ?? '',
              value_type: feature.value_type,
              value: feature.value,
              description: feature.description ?? null,
            }),
          ),
        );
      }
    }

    return this.findPlan(plan.id);
  }

  async activatePlan(user: AuthenticatedUser, id: string) {
    const plan = await this.findPlan(id);
    plan.status = SaasPlanStatus.ACTIVE;
    plan.updated_by = user.id;
    await this.planRepository.save(plan);
    return this.findPlan(id);
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

    if (!plan) {
      throw new BadRequestException('Only active SaaS plans can be assigned');
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
      plan.billing_interval,
    ).minus({ day: 1 });

    const trialEndsAt =
      plan.trial_days > 0 ? startedAt.plus({ day: plan.trial_days }) : null;

    const subscription = this.subscriptionRepository.create({
      company_id: company.id,
      plan_id: plan.id,
      subscription_no: `SUB-${startedAt.toFormat('yyyyLLddHHmmss')}-${company.id.slice(0, 6).toUpperCase()}`,
      status:
        plan.trial_days > 0
          ? SubscriptionStatus.TRIALING
          : SubscriptionStatus.ACTIVE,
      billing_interval: plan.billing_interval,
      currency: plan.currency,
      base_price: plan.base_price,
      started_at: startedAt.toJSDate(),
      trial_ends_at: trialEndsAt?.toJSDate() ?? null,
      current_period_start: startedAt.toJSDate(),
      current_period_end: periodEnd.toJSDate(),
      metadata: dto.metadata ?? null,
      created_by: user.id,
      updated_by: user.id,
    });

    const savedSubscription =
      await this.subscriptionRepository.save(subscription);
    await this.copyPlanFeaturesToEntitlements(
      savedSubscription.id,
      plan.id,
      company.id,
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
    subscription.updated_by = user.id;
    return this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(user: AuthenticatedUser, id: string) {
    const subscription = await this.getSubscription(id);
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelled_at = new Date();
    subscription.cancel_at_period_end = false;
    subscription.updated_by = user.id;
    return this.subscriptionRepository.save(subscription);
  }

  private async findPlan(id: string) {
    const plan = await this.planRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!plan) {
      throw new NotFoundException('SaaS plan was not found');
    }

    const features = await this.planFeatureRepository.find({
      where: { plan_id: plan.id },
      order: { feature_code: 'ASC' },
    });

    return {
      ...plan,
      features,
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

  private async copyPlanFeaturesToEntitlements(
    subscriptionId: string,
    planId: string,
    companyId: string,
  ) {
    const features = await this.planFeatureRepository.find({
      where: { plan_id: planId },
    });

    if (!features.length) {
      return;
    }

    await this.entitlementRepository.save(
      features.map((feature) =>
        this.entitlementRepository.create({
          subscription_id: subscriptionId,
          company_id: companyId,
          feature_code: feature.feature_code,
          value_type: feature.value_type,
          value: feature.value,
          source: 'PLAN',
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
