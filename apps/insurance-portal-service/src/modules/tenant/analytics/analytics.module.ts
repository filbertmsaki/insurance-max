import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { KpiService } from './services/kpi.service';
import { ScorecardService } from './services/scorecard.service';
import { AnomalyService } from './services/anomaly.service';
import { ForecastService } from './services/forecast.service';
import { BenchmarkService } from './services/benchmark.service';

@Module({
  imports: [SharedModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    KpiService,
    ScorecardService,
    AnomalyService,
    ForecastService,
    BenchmarkService,
  ],
  exports: [AnalyticsService, KpiService],
})
export class AnalyticsModule {}
