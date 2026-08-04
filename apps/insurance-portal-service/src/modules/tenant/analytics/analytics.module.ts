import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AnalyticsController } from './analytics.controller';
import { KPI_CALCULATORS } from './interfaces/kpi-calculator.interface';
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
    // No KpiCalculator implementations exist yet; bind an empty array so
    // KpiService's DI graph resolves. Replace with a real provider (or a
    // multi-provider array) once calculators are implemented.
    { provide: KPI_CALCULATORS, useValue: [] },
  ],
  exports: [AnalyticsService, KpiService],
})
export class AnalyticsModule {}
