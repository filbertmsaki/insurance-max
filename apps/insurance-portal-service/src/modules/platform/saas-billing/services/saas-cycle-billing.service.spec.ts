import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasCycleBillingService } from './saas-cycle-billing.service';
import { CompanySubscription } from '../entities/company-subscription.entity';
import { PlatformUsageSnapshot } from '../entities/platform-usage-snapshot.entity';
import { SaasBillingCycle } from '../entities/saas-billing-cycle.entity';
import { SaasInvoice } from '../entities/saas-invoice.entity';
import { SaasInvoiceAdjustment } from '../entities/saas-invoice-adjustment.entity';
import { SaasInvoiceItem } from '../entities/saas-invoice-item.entity';
import { SaasPayment } from '../entities/saas-payment.entity';
import { SubscriptionChange } from '../entities/subscription-change.entity';
import {
  SaasInvoiceAdjustmentType,
  SaasInvoiceStatus,
  SubscriptionStatus,
} from '../enums/saas-billing.enums';

describe('SaasCycleBillingService', () => {
  let service: SaasCycleBillingService;
  let subscriptionRepository: {
    findOneBy: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
  };
  let snapshotRepository: { find: jest.Mock };
  let cycleRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let invoiceRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  let invoiceAdjustmentRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
  };
  let invoiceItemRepository: { create: jest.Mock; save: jest.Mock };
  let paymentRepository: { create: jest.Mock; save: jest.Mock };
  let subscriptionChangeRepository: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    subscriptionRepository = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
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

    invoiceRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
      create: jest.fn().mockImplementation((value) => value),
      count: jest.fn().mockResolvedValue(0),
    };

    invoiceAdjustmentRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        id: 'adjustment-1',
        ...value,
      })),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
    };

    invoiceItemRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue([]),
    };

    paymentRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        id: 'payment-1',
        ...value,
      })),
    };

    subscriptionChangeRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: getRepositoryToken(SaasInvoice),
          useValue: invoiceRepository,
        },
        {
          provide: getRepositoryToken(SaasInvoiceAdjustment),
          useValue: invoiceAdjustmentRepository,
        },
        {
          provide: getRepositoryToken(SaasInvoiceItem),
          useValue: invoiceItemRepository,
        },
        {
          provide: getRepositoryToken(SaasPayment),
          useValue: paymentRepository,
        },
        {
          provide: getRepositoryToken(SubscriptionChange),
          useValue: subscriptionChangeRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, fallback?: unknown) => {
                const config: Record<string, unknown> = {
                  SAAS_PAST_DUE_GRACE_DAYS: '7',
                  SAAS_AUTO_SUSPEND_ENABLED: true,
                  SAAS_AUTO_RESTORE_AFTER_PAYMENT: true,
                  SAAS_INVOICE_DUE_DAYS: '14',
                };
                return config[key] ?? fallback;
              }),
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
    });
    cycleRepository.findOne.mockResolvedValue(null);
    snapshotRepository.find.mockResolvedValue([
      {
        metric_code: 'tiramis.submissions.monthly',
        dimension_key: 'default',
        quantity: '150.000000',
        dimensions: {},
      },
    ] as PlatformUsageSnapshot[]);

    const cycle =
      await service.ensureOpenCycleForSubscription('subscription-1');

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

  it('moves unpaid subscriptions from active to suspended when dunning grace expires', async () => {
    const now = new Date();
    const dueAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const subscription = {
      id: 'subscription-1',
      company_id: 'company-1',
      plan_version_id: 'plan-version-1',
      status: SubscriptionStatus.ACTIVE,
      suspended_at: null,
      suspension_reason: null,
      state_version: 1,
      grace_period_ends_at: null,
    } as CompanySubscription;

    invoiceRepository.find.mockResolvedValue([
      {
        id: 'invoice-1',
        subscription_id: 'subscription-1',
        company_id: 'company-1',
        due_at: dueAt,
        balance_amount: '150.00',
        status: SaasInvoiceStatus.ISSUED,
      } as SaasInvoice,
    ]);
    subscriptionRepository.findOneBy.mockResolvedValue(subscription);

    const result = await service.processDunning();

    expect(result).toEqual({ processed: 1 });
    expect(subscription.status).toBe(SubscriptionStatus.SUSPENDED);
    expect(subscription.suspension_reason).toBe('SUBSCRIPTION_PAYMENT_OVERDUE');
    expect(invoiceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SaasInvoiceStatus.OVERDUE }),
    );
    expect(subscriptionChangeRepository.save).toHaveBeenCalled();
  });

  it('applies approved credit adjustments through a tracked adjustment record', async () => {
    invoiceAdjustmentRepository.findOneBy.mockResolvedValue({
      id: 'adjustment-1',
      invoice_id: 'invoice-1',
      amount: '25.0000',
      adjustment_type: SaasInvoiceAdjustmentType.CREDIT,
      status: 'DRAFT',
    });
    invoiceRepository.findOneBy.mockResolvedValue({
      id: 'invoice-1',
      subscription_id: 'subscription-1',
      company_id: 'company-1',
      total_amount: '100.00',
      paid_amount: '20.00',
      balance_amount: '80.00',
      status: SaasInvoiceStatus.PARTIALLY_PAID,
      metadata: null,
    });
    subscriptionRepository.findOneBy.mockResolvedValue({
      id: 'subscription-1',
      company_id: 'company-1',
      plan_version_id: 'plan-version-1',
      status: SubscriptionStatus.ACTIVE,
    });

    const adjustment = await service.approveInvoiceAdjustment(
      { id: 'user-1' } as any,
      'adjustment-1',
    );

    expect(adjustment.status).toBe('APPLIED');
    expect(invoiceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_amount: '75.00',
        balance_amount: '55.00',
      }),
    );
  });
});
