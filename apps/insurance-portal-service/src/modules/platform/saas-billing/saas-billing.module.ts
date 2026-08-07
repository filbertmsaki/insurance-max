import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportSchedule } from '../../tenant/reporting/entities/report-schedule.entity';
import { Branch } from '../../tenant/branches/entities/branch.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyUser } from '../companies/entities/company-user.entity';
import { ApiClient } from '../api-clients/entities/api-client.entity';
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
import { SaasPlanVersion } from './entities/saas-plan-version.entity';
import { SubscriptionChange } from './entities/subscription-change.entity';
import { SubscriptionEntitlement } from './entities/subscription-entitlement.entity';
import { SubscriptionFeatureGuard } from './guards/subscription-feature.guard';
import { SaasCycleBillingService } from './services/saas-cycle-billing.service';
import { SubscriptionAccessService } from './services/subscription-access.service';
import { SubscriptionLimitService } from './services/subscription-limit.service';
import { SubscriptionService } from './services/subscription.service';
import { UsageMeteringService } from './services/usage-metering.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyUser,
      Branch,
      ReportSchedule,
      ApiClient,
      SaasPlan,
      SaasPlanVersion,
      SaasPlanFeature,
      SaasPlanMeterRate,
      CompanySubscription,
      SubscriptionChange,
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
    SubscriptionLimitService,
    SubscriptionFeatureGuard,
    UsageMeteringService,
    SaasCycleBillingService,
  ],
  exports: [
    SubscriptionAccessService,
    SubscriptionLimitService,
    SubscriptionFeatureGuard,
    UsageMeteringService,
    SubscriptionService,
  ],
})
export class SaasBillingModule {}
