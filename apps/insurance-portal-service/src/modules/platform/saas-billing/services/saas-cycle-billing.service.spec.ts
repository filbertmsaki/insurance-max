import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasCycleBillingService } from './saas-cycle-billing.service';
import { CompanySubscription } from '../entities/company-subscription.entity';
import { PlatformUsageSnapshot } from '../entities/platform-usage-snapshot.entity';
import { SaasBillingCycle } from '../entities/saas-billing-cycle.entity';
import { SaasInvoice } from '../entities/saas-invoice.entity';
import { SaasInvoiceItem } from '../entities/saas-invoice-item.entity';
import { SaasPayment } from '../entities/saas-payment.entity';

describe('SaasCycleBillingService', () => {
  let service: SaasCycleBillingService;
  let subscriptionRepository: { findOneBy: jest.Mock };
  let snapshotRepository: { find: jest.Mock };
  let cycleRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    subscriptionRepository = {
      findOneBy: jest.fn(),
    };

    snapshotRepository = {
      find: jest.fn(),
    };

    cycleRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        id: 'cycle-1',
        ...value,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasCycleBillingService,
        {
          provide: getRepositoryToken(CompanySubscription),
          useValue: subscriptionRepository,
        },
        {
          provide: getRepositoryToken(PlatformUsageSnapshot),
          useValue: snapshotRepository,
        },
        {
          provide: getRepositoryToken(SaasBillingCycle),
          useValue: cycleRepository,
        },
        { provide: getRepositoryToken(SaasInvoice), useValue: {} },
        { provide: getRepositoryToken(SaasInvoiceItem), useValue: {} },
        { provide: getRepositoryToken(SaasPayment), useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((_key: string, fallback?: unknown) => fallback),
          },
        },
      ],
    }).compile();

    service = module.get(SaasCycleBillingService);
  });

  it('uses the frozen plan snapshot meter rates to calculate overage billing', async () => {
    const currentPeriodStart = new Date('2026-08-01T00:00:00.000Z');
    const currentPeriodEnd = new Date('2026-08-31T23:59:59.999Z');

    subscriptionRepository.findOneBy.mockResolvedValue({
      id: 'subscription-1',
      company_id: 'company-1',
      plan_version_id: 'plan-version-1',
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      currency: 'TZS',
      base_price: '100.00',
      plan_snapshot: {
        meter_rates: [
          {
            metric_code: 'tiramis.submissions.monthly',
            included_quantity: '100',
            billing_unit: '10',
            unit_price: '2',
            currency: 'TZS',
            is_active: true,
          },
        ],
      },
    } as CompanySubscription);
    cycleRepository.findOne.mockResolvedValue(null);
    snapshotRepository.find.mockResolvedValue([
      {
        metric_code: 'tiramis.submissions.monthly',
        dimension_key: 'default',
        quantity: '150.000000',
        dimensions: {},
      },
    ] as PlatformUsageSnapshot[]);

    const cycle = await service.ensureOpenCycleForSubscription('subscription-1');

    expect(cycle.plan_version_id).toBe('plan-version-1');
    expect(cycle.usage_amount).toBe('10.00');
    expect(cycle.total_amount).toBe('110.00');
    expect(cycle.billing_snapshot).toEqual(
      expect.objectContaining({
        usage_amount: '10.00',
        usage_charges: [
          expect.objectContaining({
            metric_code: 'tiramis.submissions.monthly',
            overage_quantity: '50.000000',
            billable_units: '5.000000',
            amount: '10.00',
          }),
        ],
      }),
    );
    expect(cycle.billing_snapshot_hash).toEqual(expect.any(String));
  });
});
