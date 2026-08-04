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
export class ClaimProjectionHandler
  implements AnalyticsProjectionHandler
{
  readonly aggregateType =
    AnalyticsAggregateType.CLAIM;

  constructor(
    private readonly dirtyPeriodService: AnalyticsDirtyPeriodService,
  ) {}

  async project(
    manager: EntityManager,
    event: AnalyticsProjectionEvent,
  ): Promise<void> {
    const payload = event.payload as Record<
      string,
      unknown
    >;
    const metricDate = String(
      payload.report_date ?? payload.loss_date ?? new Date().toISOString().slice(0, 10),
    );
    const lossDate = String(
      payload.loss_date ?? metricDate,
    );
    const reportDate = String(
      payload.report_date ?? lossDate,
    );
    const claimNo = String(
      payload.claim_no ?? event.aggregate_id,
    );
    const claimStatus = String(
      payload.claim_status ?? 'UNKNOWN',
    );
    const currency = String(
      payload.currency ?? 'UNKNOWN',
    );

    if (!payload.policy_id) {
      throw new Error('Analytics claim projection requires policy_id');
    }

    if (
      event.event_type ===
        AnalyticsEventType.DELETED ||
      event.event_type ===
        AnalyticsEventType.REVERSED
    ) {
      await manager.query(
        `
        DELETE FROM analytics_claim_facts
        WHERE claim_id = $1
        `,
        [event.aggregate_id],
      );
    } else {
      await manager.query(
        `
        INSERT INTO analytics_claim_facts (
          claim_id,
          company_id,
          branch_id,
          policy_id,
          product_id,
          category_id,
          claim_no,
          claim_status,
          priority,
          liability_status,
          loss_date,
          report_date,
          approved_at,
          closed_at,
          currency,
          estimated_amount,
          approved_amount,
          paid_amount,
          outstanding_reserve,
          recovery_expected,
          recovery_received,
          days_to_approval,
          days_to_close,
          fraud_indicator,
          litigation_indicator,
          source_updated_at,
          projected_at,
          projection_version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
        )
        ON CONFLICT (claim_id)
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          branch_id = EXCLUDED.branch_id,
          policy_id = EXCLUDED.policy_id,
          product_id = EXCLUDED.product_id,
          category_id = EXCLUDED.category_id,
          claim_no = EXCLUDED.claim_no,
          claim_status = EXCLUDED.claim_status,
          priority = EXCLUDED.priority,
          liability_status = EXCLUDED.liability_status,
          loss_date = EXCLUDED.loss_date,
          report_date = EXCLUDED.report_date,
          approved_at = EXCLUDED.approved_at,
          closed_at = EXCLUDED.closed_at,
          currency = EXCLUDED.currency,
          estimated_amount = EXCLUDED.estimated_amount,
          approved_amount = EXCLUDED.approved_amount,
          paid_amount = EXCLUDED.paid_amount,
          outstanding_reserve = EXCLUDED.outstanding_reserve,
          recovery_expected = EXCLUDED.recovery_expected,
          recovery_received = EXCLUDED.recovery_received,
          days_to_approval = EXCLUDED.days_to_approval,
          days_to_close = EXCLUDED.days_to_close,
          fraud_indicator = EXCLUDED.fraud_indicator,
          litigation_indicator = EXCLUDED.litigation_indicator,
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
          claimNo,
          claimStatus,
          payload.priority ?? null,
          payload.liability_status ?? null,
          lossDate,
          reportDate,
          payload.approved_at ?? null,
          payload.closed_at ?? null,
          currency,
          payload.estimated_amount ?? 0,
          payload.approved_amount ?? 0,
          payload.paid_amount ?? 0,
          payload.outstanding_reserve ?? 0,
          payload.recovery_expected ?? 0,
          payload.recovery_received ?? 0,
          payload.days_to_approval ?? null,
          payload.days_to_close ?? null,
          payload.fraud_indicator ?? false,
          payload.litigation_indicator ?? false,
          payload.source_updated_at ?? new Date().toISOString(),
          payload.projected_at ?? new Date().toISOString(),
          event.event_version,
        ],
      );
    }

    await this.dirtyPeriodService.mark(manager, {
      companyId: event.company_id,
      branchId: event.branch_id,
      domain: 'CLAIM',
      metricDate,
    });
  }
}
