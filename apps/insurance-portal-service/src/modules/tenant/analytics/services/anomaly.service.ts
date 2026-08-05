import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnomalyService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async listFindings(
    companyId: string,
    query: { branchId?: string | null; from?: string; to?: string },
  ) {
    return this.analyticsService.listAnomalyFindings(
      companyId,
      query.branchId ?? null,
      query.from,
      query.to,
    );
  }

  async runDetection(
    user: { companyId: string; id: string },
    params: {
      ruleId: string;
      branchId?: string | null;
      from: string;
      to: string;
    },
  ) {
    const rule = await this.analyticsService
      .listAnomalyRules(user.companyId)
      .then((rules) => rules.find((entry: any) => entry.id === params.ruleId));

    if (!rule) {
      throw new NotFoundException('Anomaly rule not found');
    }

    const metricCode = rule.metric_code;
    const metrics = await this.analyticsService.getDailyMetrics({
      companyId: user.companyId,
      branchId: params.branchId ?? null,
      metricCode,
      from: params.from,
      to: params.to,
    });

    if (!metrics.length) {
      throw new NotFoundException(
        `No metrics available for anomaly detection on metric ${metricCode}`,
      );
    }

    const latest = metrics[metrics.length - 1];
    const average =
      metrics.reduce((sum, row) => sum + Number(row.metricValue ?? 0), 0) /
      metrics.length;
    const observed = Number(latest.metricValue ?? 0);
    const deviation = observed - average;
    const deviationPercent = average ? (deviation / average) * 100 : 0;
    const severity =
      Math.abs(deviationPercent) > 50
        ? 'HIGH'
        : Math.abs(deviationPercent) > 20
          ? 'MEDIUM'
          : 'LOW';

    const existingFinding = await this.analyticsService
      .listAnomalyFindings(user.companyId, params.branchId ?? null)
      .then((existing) =>
        existing.find(
          (entry: any) =>
            entry.rule_id === params.ruleId &&
            entry.metric_date === latest?.metricDate,
        ),
      );

    if (existingFinding) {
      return existingFinding;
    }

    const [existingByRule] =
      await this.analyticsService.listAnomalyFindingsByRuleAndDate(
        params.ruleId,
        user.companyId,
        latest.metricDate,
      );

    if (existingByRule) {
      return existingByRule;
    }

    return this.analyticsService.insertAnomalyFinding({
      companyId: user.companyId,
      branchId: params.branchId ?? null,
      ruleId: params.ruleId,
      metricCode,
      metricDate: latest?.metricDate ?? params.from,
      dimensionKey: 'default',
      dimensions: {},
      observedValue: observed,
      expectedValue: average,
      deviationValue: deviation,
      deviationPercent,
      severity,
      status: 'OPEN',
      explanation: `Computed anomaly for metric ${metricCode}`,
      evidence: { metricHistory: metrics },
    });
  }
}
