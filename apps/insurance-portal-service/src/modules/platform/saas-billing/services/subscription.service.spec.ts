import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SubscriptionService } from './subscription.service';
import { Company } from '../../companies/entities/company.entity';
import { CompanySubscription } from '../entities/company-subscription.entity';
import { SaasPlan } from '../entities/saas-plan.entity';
import { SaasPlanFeature } from '../entities/saas-plan-feature.entity';
import { SaasPlanMeterRate } from '../entities/saas-plan-meter-rate.entity';
import { SaasPlanVersion } from '../entities/saas-plan-version.entity';
import { SubscriptionChange } from '../entities/subscription-change.entity';
import { SubscriptionEntitlement } from '../entities/subscription-entitlement.entity';
import {
  BillingInterval,
  SubscriptionChangeType,
  SubscriptionStatus,
} from '../enums/saas-billing.enums';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let planRepository: { findOne: jest.Mock };
  let planVersionRepository: {
    findOneByOrFail: jest.Mock;
    findOneBy: jest.Mock;
  };
  let subscriptionRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let subscriptionChangeRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let entitlementRepository: {
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    planRepository = {
      findOne: jest.fn(),
    };
    planVersionRepository = {
      findOneByOrFail: jest.fn(),
      findOneBy: jest.fn(),
    };
    subscriptionRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
      find: jest.fn(),
    };
    subscriptionChangeRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    entitlementRepository = {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getRepositoryToken(SaasPlan), useValue: planRepository },
        {
          provide: getRepositoryToken(SaasPlanVersion),
          useValue: planVersionRepository,
        },
        {
          provide: getRepositoryToken(SaasPlanFeature),
          useValue: {},
        },
        {
          provide: getRepositoryToken(SaasPlanMeterRate),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CompanySubscription),
          useValue: subscriptionRepository,
        },
        {
          provide: getRepositoryToken(SubscriptionChange),
          useValue: subscriptionChangeRepository,
        },
        {
          provide: getRepositoryToken(SubscriptionEntitlement),
          useValue: entitlementRepository,
        },
        { provide: getRepositoryToken(Company), useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation(
                (_key: string, fallback?: unknown) => fallback,
              ),
          },
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('schedules a future plan change against the active published plan version', async () => {
    const currentPeriodEnd = new Date('2026-08-31T23:59:59.999Z');
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'subscription-1',
      company_id: 'company-1',
      plan_version_id: 'version-old',
      base_price: '50.00',
      current_period_end: currentPeriodEnd,
      status: SubscriptionStatus.ACTIVE,
      state_version: 1,
    });
    planRepository.findOne.mockResolvedValue({
      id: 'plan-new',
      active_version_id: 'version-new',
    });
    planVersionRepository.findOneByOrFail.mockResolvedValue({
      id: 'version-new',
      base_price: '75.00',
    });

    const result = await service.schedulePlanChange(
      { id: 'user-1' } as any,
      'subscription-1',
      { plan_id: 'plan-new', reason: 'upgrade' },
    );

    expect(result.scheduled_plan_id).toBe('plan-new');
    expect(result.scheduled_plan_version_id).toBe('version-new');
    expect(subscriptionChangeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        change_type: SubscriptionChangeType.UPGRADE,
      }),
    );
  });

  it('applies due scheduled plan changes and refreshes entitlements from the new version snapshot', async () => {
    const dueSubscription = {
      id: 'subscription-1',
      company_id: 'company-1',
      plan_id: 'plan-old',
      plan_version_id: 'version-old',
      scheduled_plan_id: 'plan-new',
      scheduled_plan_version_id: 'version-new',
      scheduled_change_at: new Date('2026-08-01T00:00:00.000Z'),
      current_period_end: new Date('2026-08-31T23:59:59.999Z'),
      status: SubscriptionStatus.ACTIVE,
      billing_interval: BillingInterval.MONTHLY,
      currency: 'TZS',
      base_price: '50.00',
      state_version: 1,
      updated_by: 'user-1',
    } as CompanySubscription;

    subscriptionRepository.find.mockResolvedValue([dueSubscription]);
    planVersionRepository.findOneByOrFail.mockResolvedValue({
      id: 'version-new',
      billing_interval: BillingInterval.MONTHLY,
      currency: 'TZS',
      base_price: '75.00',
      plan_snapshot: { plan_id: 'plan-new' },
      plan_snapshot_hash: 'hash-new',
      feature_snapshot: [
        {
          feature_code: 'api_clients.max',
          value_type: 'INTEGER',
          value: 10,
        },
      ],
    });

    const result = await service.applyDueScheduledChanges();

    expect(result).toEqual({ processed: 1 });
    expect(subscriptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan-new',
        plan_version_id: 'version-new',
        scheduled_plan_id: null,
        scheduled_plan_version_id: null,
      }),
    );
    expect(entitlementRepository.update).toHaveBeenCalled();
    expect(entitlementRepository.save).toHaveBeenCalled();
  });
});
