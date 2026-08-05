import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  AnalyticsAggregateType,
  AnalyticsEventType,
} from '../enums/analytics.enums';
import { AnalyticsProjectionEvent } from '../entities/analytics-projection-event.entity';
import { AnalyticsDirtyPeriodService } from '../services/analytics-dirty-period.service';
import { AnalyticsProjectionHandler } from '../interfaces/analytics-projection-handler.interface';

@Injectable()
export class ReinsuranceProjectionHandler implements AnalyticsProjectionHandler {
  readonly aggregateType = AnalyticsAggregateType.REINSURANCE_CESSION;

  constructor(
    private readonly dirtyPeriodService: AnalyticsDirtyPeriodService,
  ) {}

  async project(
    manager: EntityManager,
    event: AnalyticsProjectionEvent,
  ): Promise<void> {
    const payload = event.payload;
    const metricDate = String(
      payload.effective_from ??
        payload.source_updated_at ??
        new Date().toISOString().slice(0, 10),
    );
    const effectiveFrom = String(payload.effective_from ?? metricDate);
    const effectiveTo = String(payload.effective_to ?? effectiveFrom);
    const cessionType = String(payload.cession_type ?? 'UNKNOWN');
    const cessionStatus = String(payload.cession_status ?? 'UNKNOWN');
    const currency = String(payload.currency ?? 'UNKNOWN');

    if (!payload.policy_id) {
      throw new Error('Analytics reinsurance projection requires policy_id');
    }

    if (
      event.event_type === AnalyticsEventType.DELETED ||
      event.event_type === AnalyticsEventType.REVERSED
    ) {
      await manager.query(
        `
        DELETE FROM analytics_reinsurance_facts
        WHERE cession_id = $1
        `,
        [event.aggregate_id],
      );
    } else {
      await manager.query(
        `
        INSERT INTO analytics_reinsurance_facts (
          cession_id,
          company_id,
          branch_id,
          policy_id,
          product_id,
          category_id,
          treaty_id,
          facultative_placement_id,
          cession_type,
          cession_status,
          effective_from,
          effective_to,
          currency,
          gross_sum_insured,
          gross_premium,
          retention_amount,
          retained_premium,
          ceded_sum_insured,
          ceded_premium,
          ceded_share_percent,
          source_updated_at,
          projected_at,
          projection_version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
        )
        ON CONFLICT (cession_id)
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          branch_id = EXCLUDED.branch_id,
          policy_id = EXCLUDED.policy_id,
          product_id = EXCLUDED.product_id,
          category_id = EXCLUDED.category_id,
          treaty_id = EXCLUDED.treaty_id,
          facultative_placement_id = EXCLUDED.facultative_placement_id,
          cession_type = EXCLUDED.cession_type,
          cession_status = EXCLUDED.cession_status,
          effective_from = EXCLUDED.effective_from,
          effective_to = EXCLUDED.effective_to,
          currency = EXCLUDED.currency,
          gross_sum_insured = EXCLUDED.gross_sum_insured,
          gross_premium = EXCLUDED.gross_premium,
          retention_amount = EXCLUDED.retention_amount,
          retained_premium = EXCLUDED.retained_premium,
          ceded_sum_insured = EXCLUDED.ceded_sum_insured,
          ceded_premium = EXCLUDED.ceded_premium,
          ceded_share_percent = EXCLUDED.ceded_share_percent,
          source_updated_at = EXCLUDED.source_updated_at,
          projected_at = EXCLUDED.projected_at,
          projection_version = EXCLUDED.projection_version
        `,
        [
          event.aggregate_id,
          event.company_id,
          event.branch_id,
          payload.policy_id ?? null,
          payload.product_id ?? null,
          payload.category_id ?? null,
          payload.treaty_id ?? null,
          payload.facultative_placement_id ?? null,
          cessionType,
          cessionStatus,
          effectiveFrom,
          effectiveTo,
          currency,
          payload.gross_sum_insured ?? 0,
          payload.gross_premium ?? 0,
          payload.retention_amount ?? 0,
          payload.retained_premium ?? 0,
          payload.ceded_sum_insured ?? 0,
          payload.ceded_premium ?? 0,
          payload.ceded_share_percent ?? 0,
          payload.source_updated_at ?? new Date().toISOString(),
          payload.projected_at ?? new Date().toISOString(),
          event.event_version,
        ],
      );
    }

    await this.dirtyPeriodService.mark(manager, {
      companyId: event.company_id,
      branchId: event.branch_id,
      domain: 'REINSURANCE',
      metricDate,
    });
  }
}
