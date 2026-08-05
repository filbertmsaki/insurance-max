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
export class PremiumProjectionHandler implements AnalyticsProjectionHandler {
  readonly aggregateType = AnalyticsAggregateType.PREMIUM_LEDGER;

  constructor(
    private readonly dirtyPeriodService: AnalyticsDirtyPeriodService,
  ) {}

  async project(
    manager: EntityManager,
    event: AnalyticsProjectionEvent,
  ): Promise<void> {
    const payload = event.payload;
    const metricDate = String(
      payload.effective_date ??
        payload.source_updated_at ??
        new Date().toISOString().slice(0, 10),
    );
    const effectiveDate = String(
      payload.effective_date ?? payload.source_updated_at ?? metricDate,
    );
    const entryType = String(payload.entry_type ?? 'UNKNOWN');
    const status = String(payload.status ?? 'UNKNOWN');
    const currency = String(payload.currency ?? 'UNKNOWN');

    if (!payload.policy_id) {
      throw new Error('Analytics premium projection requires policy_id');
    }

    if (
      event.event_type === AnalyticsEventType.DELETED ||
      event.event_type === AnalyticsEventType.REVERSED
    ) {
      await manager.query(
        `
        DELETE FROM analytics_premium_facts
        WHERE ledger_entry_id = $1
        `,
        [event.aggregate_id],
      );
    } else {
      await manager.query(
        `
        INSERT INTO analytics_premium_facts (
          ledger_entry_id,
          company_id,
          branch_id,
          policy_id,
          product_id,
          category_id,
          entry_type,
          status,
          effective_date,
          currency,
          gross_premium,
          tax_amount,
          commission_amount,
          levy_eligible_amount,
          source_updated_at,
          projected_at,
          projection_version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )
        ON CONFLICT (ledger_entry_id)
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          branch_id = EXCLUDED.branch_id,
          policy_id = EXCLUDED.policy_id,
          product_id = EXCLUDED.product_id,
          category_id = EXCLUDED.category_id,
          entry_type = EXCLUDED.entry_type,
          status = EXCLUDED.status,
          effective_date = EXCLUDED.effective_date,
          currency = EXCLUDED.currency,
          gross_premium = EXCLUDED.gross_premium,
          tax_amount = EXCLUDED.tax_amount,
          commission_amount = EXCLUDED.commission_amount,
          levy_eligible_amount = EXCLUDED.levy_eligible_amount,
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
          entryType,
          status,
          effectiveDate,
          currency,
          payload.gross_premium ?? 0,
          payload.tax_amount ?? 0,
          payload.commission_amount ?? 0,
          payload.levy_eligible_amount ?? 0,
          payload.source_updated_at ?? new Date().toISOString(),
          payload.projected_at ?? new Date().toISOString(),
          event.event_version,
        ],
      );
    }

    await this.dirtyPeriodService.mark(manager, {
      companyId: event.company_id,
      branchId: event.branch_id,
      domain: 'PREMIUM',
      metricDate,
    });
  }
}
