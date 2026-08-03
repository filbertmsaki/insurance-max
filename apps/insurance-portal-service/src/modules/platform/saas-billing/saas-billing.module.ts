import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from '../companies/entities/company.entity';
import { SaasBillingController } from './saas-billing.controller';
import { CompanySubscription } from './entities/company-subscription.entity';
import { PlatformUsageEvent } from './entities/platform-usage-event.entity';
import { PlatformUsageSnapshot } from './entities/platform-usage-snapshot.entity';
import { SaasBillingCycle } from './entities/saas-billing-cycle.entity';
import { SaasInvoiceItem } from './entities/saas-invoice-item.entity';
import { SaasInvoice } from './entities/saas-invoice.entity';
import { SaasPayment } from './entities/saas-payment.entity';
import { SaasPlanFeature } from './entities/saas-plan-feature.entity';
import { SaasPlanMeterRate } from './entities/saas-plan-meter-rate.entity';
import { SaasPlan } from './entities/saas-plan.entity';
import { SubscriptionEntitlement } from './entities/subscription-entitlement.entity';
import { SubscriptionFeatureGuard } from './guards/subscription-feature.guard';
import { SaasCycleBillingService } from './services/saas-cycle-billing.service';
import { SubscriptionAccessService } from './services/subscription-access.service';
import { SubscriptionService } from './services/subscription.service';
import { UsageMeteringService } from './services/usage-metering.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      SaasPlan,
      SaasPlanFeature,
      SaasPlanMeterRate,
      CompanySubscription,
      SubscriptionEntitlement,
      PlatformUsageEvent,
      PlatformUsageSnapshot,
      SaasBillingCycle,
      SaasInvoice,
      SaasInvoiceItem,
      SaasPayment,
    ]),
  ],
  controllers: [SaasBillingController],
  providers: [
    SubscriptionService,
    SubscriptionAccessService,
    SubscriptionFeatureGuard,
    UsageMeteringService,
    SaasCycleBillingService,
  ],
  exports: [
    SubscriptionAccessService,
    SubscriptionFeatureGuard,
    UsageMeteringService,
    SubscriptionService,
  ],
})
export class SaasBillingModule {}
