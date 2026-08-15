import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from '../../shared/shared.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsProjectionCheckpoint } from '../../shared/analytics/entities/analytics-projection-checkpoint.entity';
import { KPI_CALCULATORS } from './interfaces/kpi-calculator.interface';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsMetricDefinitionEntity } from './entities/analytics-metric-definition.entity';
import { AnalyticsMetricValueEntity } from './entities/analytics-metric-value.entity';
import { AnalyticsMetricService } from './services/analytics-metric.service';
import { ExecutiveMetricsSourceService } from './services/executive-metrics-source.service';
import { KpiService } from './services/kpi.service';
import { ScorecardService } from './services/scorecard.service';
import { AnomalyService } from './services/anomaly.service';
import { ForecastService } from './services/forecast.service';
import { BenchmarkService } from './services/benchmark.service';
import { TiramisSuccessRateKpiCalculator } from './calculators/tiramis-success-rate.calculator';
import { Policy } from '../policies/entities/policy.entity';
import { PremiumLedgerEntry } from '../regulatory-compliance/entities/premium-ledger-entry.entity';
import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([
      AnalyticsMetricDefinitionEntity,
      AnalyticsMetricValueEntity,
      AnalyticsProjectionCheckpoint,
      Policy,
      PremiumLedgerEntry,
      TiramisSubmissionTrackingEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsMetricService,
    ExecutiveMetricsSourceService,
    KpiService,
    ScorecardService,
    AnomalyService,
    ForecastService,
    BenchmarkService,
    TiramisSuccessRateKpiCalculator,
    {
      provide: KPI_CALCULATORS,
      useFactory: (tiramisSuccessRate: TiramisSuccessRateKpiCalculator) => [
        tiramisSuccessRate,
      ],
      inject: [TiramisSuccessRateKpiCalculator],
    },
  ],
  exports: [AnalyticsService, AnalyticsMetricService, KpiService],
})
export class AnalyticsModule {}
