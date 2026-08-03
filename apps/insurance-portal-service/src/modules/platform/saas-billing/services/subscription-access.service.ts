import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';

import { CompanySubscription } from '../entities/company-subscription.entity';
import { SubscriptionEntitlement } from '../entities/subscription-entitlement.entity';
import { SubscriptionStatus } from '../enums/saas-billing.enums';

@Injectable()
export class SubscriptionAccessService {
  constructor(
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(SubscriptionEntitlement)
    private readonly entitlementRepository: Repository<SubscriptionEntitlement>,
  ) {}

  async getActiveSubscription(companyId: string): Promise<CompanySubscription> {
    const now = new Date();
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        company_id: companyId,
        deleted_at: IsNull(),
        status: In([
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.SUSPENDED,
        ]),
        current_period_start: LessThanOrEqual(now),
        current_period_end: MoreThanOrEqual(now),
      },
      order: { created_at: 'DESC' },
    });

    if (!subscription) {
      throw new NotFoundException(
        'No active company subscription was found for this tenant',
      );
    }

    return subscription;
  }

  async getEntitlements(companyId: string): Promise<SubscriptionEntitlement[]> {
    const subscription = await this.getActiveSubscription(companyId);
    const now = new Date();

    return this.entitlementRepository.find({
      where: {
        company_id: companyId,
        subscription_id: subscription.id,
        effective_from: LessThanOrEqual(now),
        effective_to: IsNull(),
      },
      order: {
        feature_code: 'ASC',
      },
    });
  }

  async getFeatureValue(
    companyId: string,
    featureCode: string,
  ): Promise<unknown> {
    const entitlements = await this.getEntitlements(companyId);
    return entitlements.find(
      (entitlement) => entitlement.feature_code === featureCode,
    )?.value;
  }

  async assertFeatureEnabled(
    companyId: string,
    featureCode: string,
  ): Promise<void> {
    const value = await this.getFeatureValue(companyId, featureCode);

    if (value === true || value === 'true' || value === 1 || value === '1') {
      return;
    }

    throw new ForbiddenException(
      `Subscription feature "${featureCode}" is not enabled`,
    );
  }
}
