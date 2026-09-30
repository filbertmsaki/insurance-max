import { Injectable } from '@nestjs/common';

import {
  KpiCalculationContext,
  KpiCalculationResult,
  KpiCalculator,
} from '../interfaces/kpi-calculator.interface';
import { AnalyticsService } from '../services/analytics.service';

/**
 * `tiramis.success_rate` is stored in `analytics_daily_metrics` as a
 * per-day *percentage* (see `AnalyticsRollupService.refreshTiramisMetrics`),
 * with `observation_count` holding that day's total submission count. The
 * generic KpiService fallback (used for plain-count KPIs like
 * `policy.issued_count`) sums the raw metric values across the period —
 * correct for counts, but summing daily percentages produces a nonsensical
 * >100% figure. This reconstructs the true period success rate as a
 * submission-weighted average instead of a sum of averages.
 */
@Injectable()
export class TiramisSuccessRateKpiCalculator implements KpiCalculator {
  readonly key = 'tiramis.success_rate';

  constructor(private readonly analyticsService: AnalyticsService) {}

  async calculate(
    context: KpiCalculationContext,
  ): Promise<KpiCalculationResult> {
    const rows = await this.analyticsService.getDailyMetrics({
      companyId: context.companyId,
      branchId: context.branchId ?? null,
      branchIds: context.branchIds ?? null,
      metricCode: this.key,
      from: context.periodStart,
      to: context.periodEnd,
    });

    let totalSubmissions = 0;
    let totalSuccesses = 0;

    for (const row of rows) {
      const dailyTotal = Number(
        (row as { observationCount?: unknown }).observationCount ?? 0,
      );
      const dailyRate = Number(
        (row as { metricValue?: unknown }).metricValue ?? 0,
      );

      totalSubmissions += dailyTotal;
      totalSuccesses += (dailyRate / 100) * dailyTotal;
    }

    if (totalSubmissions === 0) {
      return {
        value: null,
        numerator: '0',
        denominator: '0',
        explanation:
          'No TIRAMIS submissions were recorded for the requested period.',
        metadata: {
          from: context.periodStart,
          to: context.periodEnd,
          days: rows.length,
        },
      };
    }

    const successRate = (totalSuccesses / totalSubmissions) * 100;
    const roundedSuccesses = Math.round(totalSuccesses);

    return {
      value: successRate.toFixed(2),
      numerator: String(roundedSuccesses),
      denominator: String(totalSubmissions),
      explanation: `${roundedSuccesses} of ${totalSubmissions} TIRAMIS submissions succeeded (${successRate.toFixed(2)}%) between ${context.periodStart} and ${context.periodEnd}.`,
      metadata: {
        from: context.periodStart,
        to: context.periodEnd,
        days: rows.length,
      },
    };
  }
}
