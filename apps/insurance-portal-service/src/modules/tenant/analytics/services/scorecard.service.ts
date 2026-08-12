import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { KpiService } from './kpi.service';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class ScorecardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly analyticsService: AnalyticsService,
    private readonly kpiService: KpiService,
  ) {}

  async listTemplates(companyId: string) {
    return this.analyticsService.listScorecardTemplates(companyId);
  }

  async generateScorecard(
    user: AuthenticatedUser,
    params: {
      templateId: string;
      periodStart: string;
      periodEnd: string;
      branchId?: string | null;
    },
  ) {
    const items = await this.analyticsService.getScorecardTemplateItems(
      params.templateId,
    );

    if (!items.length) {
      throw new NotFoundException(
        'Scorecard template not found or has no items',
      );
    }

    const values = [] as Array<Record<string, unknown>>;
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const item of items) {
      const kpiResult = await this.kpiService.calculateKpi(user, item.code, {
        branchId: params.branchId ?? null,
        from: params.periodStart,
        to: params.periodEnd,
      });

      const actual = Number(kpiResult.value ?? 0);
      const target = Number(item.targetValue ?? item.defaultTarget ?? 0);
      const warning = Number(
        item.warningThreshold ?? item.defaultWarningThreshold ?? 0,
      );
      const critical = Number(
        item.criticalThreshold ?? item.defaultCriticalThreshold ?? 0,
      );

      const score = this.calculateScore(actual, target, warning, critical);
      const status = this.resolveStatus(actual, target, warning, critical);

      totalWeightedScore += score * Number(item.weight ?? 1);
      totalWeight += Number(item.weight ?? 1);

      values.push({
        kpi_definition_id: item.kpiDefinitionId,
        value: actual,
        numerator: kpiResult.numerator ? Number(kpiResult.numerator) : null,
        denominator: kpiResult.denominator
          ? Number(kpiResult.denominator)
          : null,
        target_value: target || null,
        score,
        status,
        explanation: kpiResult.explanation,
        calculation_metadata: kpiResult.metadata ?? {},
      });
    }

    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const overallStatus =
      overallScore >= 75 ? 'GOOD' : overallScore >= 50 ? 'WARNING' : 'CRITICAL';

    const snapshot = await this.dataSource.query(
      `
      INSERT INTO analytics_scorecard_snapshots (
        company_id,
        branch_id,
        template_id,
        period_start,
        period_end,
        overall_score,
        overall_status,
        status,
        generated_by,
        generated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
      RETURNING *
      `,
      [
        user.companyId,
        params.branchId ?? null,
        params.templateId,
        params.periodStart,
        params.periodEnd,
        overallScore,
        overallStatus,
        'GENERATED',
        user.id,
      ],
    );

    const snapshotId = snapshot[0]?.id;

    if (snapshotId) {
      await Promise.all(
        values.map((entry) =>
          this.dataSource.query(
            `
            INSERT INTO analytics_scorecard_values (
              scorecard_snapshot_id,
              kpi_definition_id,
              value,
              numerator,
              denominator,
              target_value,
              score,
              status,
              explanation,
              calculation_metadata
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            `,
            [
              snapshotId,
              entry.kpi_definition_id,
              entry.value,
              entry.numerator,
              entry.denominator,
              entry.target_value,
              entry.score,
              entry.status,
              entry.explanation,
              entry.calculation_metadata,
            ],
          ),
        ),
      );
    }

    return snapshot[0];
  }

  async publishScorecard(user: AuthenticatedUser, snapshotId: string) {
    const result = await this.dataSource.query(
      `
      UPDATE analytics_scorecard_snapshots
      SET status = 'PUBLISHED',
          published_by = $2,
          published_at = now(),
          updated_at = now()
      WHERE id = $1
        AND company_id = $3
      RETURNING *
      `,
      [snapshotId, user.id, user.companyId],
    );

    if (!result.length) {
      throw new NotFoundException('Scorecard snapshot not found');
    }

    return result[0];
  }

  private calculateScore(
    actual: number,
    target: number,
    warning: number,
    critical: number,
  ): number {
    if (target === 0) {
      return actual === 0 ? 100 : 0;
    }

    const ratio = (actual / target) * 100;
    if (ratio >= 100) {
      return 100;
    }

    if (ratio >= warning) {
      return 75;
    }

    if (ratio >= critical) {
      return 50;
    }

    return 25;
  }

  private resolveStatus(
    actual: number,
    target: number,
    warning: number,
    critical: number,
  ) {
    if (target === 0) {
      return actual === 0 ? 'ON_TARGET' : 'OFF_TARGET';
    }

    const ratio = (actual / target) * 100;
    if (ratio >= 100) {
      return 'EXCEEDED';
    }

    if (ratio >= warning) {
      return 'ON_TRACK';
    }

    if (ratio >= critical) {
      return 'AT_RISK';
    }

    return 'OFF_TRACK';
  }
}
