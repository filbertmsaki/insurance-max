import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnalyticsProjectionEvent } from './entities/analytics-projection-event.entity';
import { AnalyticsProjectionJob } from './jobs/analytics-projection.job';
import { AnalyticsProjectionRegistryService } from './services/analytics-projection-registry.service';
import { AnalyticsDirtyPeriodService } from './services/analytics-dirty-period.service';
import { AnalyticsEventPublisherService } from './services/analytics-event-publisher.service';
import { AnalyticsRollupService } from './services/analytics-rollup.service';
import {
  ANALYTICS_PROJECTION_HANDLERS,
} from './interfaces/analytics-projection-handler.interface';
import { PolicyProjectionHandler } from './handlers/policy-projection.handler';
import { PremiumProjectionHandler } from './handlers/premium-projection.handler';
import { ClaimProjectionHandler } from './handlers/claim-projection.handler';
import { ReinsuranceProjectionHandler } from './handlers/reinsurance-projection.handler';
import { TiramisProjectionHandler } from './handlers/tiramis-projection.handler';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsProjectionEvent])],
  providers: [
    AnalyticsEventPublisherService,
    AnalyticsDirtyPeriodService,
    AnalyticsRollupService,
    PolicyProjectionHandler,
    PremiumProjectionHandler,
    ClaimProjectionHandler,
    ReinsuranceProjectionHandler,
    TiramisProjectionHandler,
    {
      provide: ANALYTICS_PROJECTION_HANDLERS,
      useFactory: (
        policyHandler: PolicyProjectionHandler,
        premiumHandler: PremiumProjectionHandler,
        claimHandler: ClaimProjectionHandler,
        reinsuranceHandler: ReinsuranceProjectionHandler,
        tiramisHandler: TiramisProjectionHandler,
      ) => [
        policyHandler,
        premiumHandler,
        claimHandler,
        reinsuranceHandler,
        tiramisHandler,
      ],
      inject: [
        PolicyProjectionHandler,
        PremiumProjectionHandler,
        ClaimProjectionHandler,
        ReinsuranceProjectionHandler,
        TiramisProjectionHandler,
      ],
    },
    AnalyticsProjectionRegistryService,
    AnalyticsProjectionJob,
  ],
  exports: [
    AnalyticsEventPublisherService,
    AnalyticsDirtyPeriodService,
    AnalyticsRollupService,
    AnalyticsProjectionJob,
  ],
})
export class AnalyticsCoreModule {}
