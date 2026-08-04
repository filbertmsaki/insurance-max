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
export class TiramisProjectionHandler
  implements AnalyticsProjectionHandler
{
  readonly aggregateType =
    AnalyticsAggregateType.TIRAMIS_SUBMISSION;

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
      payload.submitted_at ?? payload.source_updated_at ?? new Date().toISOString().slice(0, 10),
    );
    const requestType = String(
      payload.request_type ?? event.source_module ?? 'UNKNOWN',
    );
    const status = String(
      payload.status ?? 'UNKNOWN',
    );
    const sourceUpdatedAt = String(
      payload.source_updated_at ?? new Date().toISOString(),
    );

    if (
      event.event_type ===
        AnalyticsEventType.DELETED ||
      event.event_type ===
        AnalyticsEventType.REVERSED
    ) {
      await manager.query(
        `
        DELETE FROM analytics_tiramis_facts
        WHERE tracking_id = $1
        `,
        [event.aggregate_id],
      );
    } else {
      await manager.query(
        `
        INSERT INTO analytics_tiramis_facts (
          tracking_id,
          company_id,
          branch_id,
          request_type,
          service_type,
          source_module,
          source_record_id,
          status,
          submitted_at,
          acknowledged_at,
          finalized_at,
          processing_duration_ms,
          retry_count,
          successful,
          source_updated_at,
          projected_at,
          projection_version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )
        ON CONFLICT (tracking_id)
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          branch_id = EXCLUDED.branch_id,
          request_type = EXCLUDED.request_type,
          service_type = EXCLUDED.service_type,
          source_module = EXCLUDED.source_module,
          source_record_id = EXCLUDED.source_record_id,
          status = EXCLUDED.status,
          submitted_at = EXCLUDED.submitted_at,
          acknowledged_at = EXCLUDED.acknowledged_at,
          finalized_at = EXCLUDED.finalized_at,
          processing_duration_ms = EXCLUDED.processing_duration_ms,
          retry_count = EXCLUDED.retry_count,
          successful = EXCLUDED.successful,
          source_updated_at = EXCLUDED.source_updated_at,
          projected_at = EXCLUDED.projected_at,
          projection_version = EXCLUDED.projection_version
        `,
        [
          event.aggregate_id,
          event.company_id ?? null,
          event.branch_id ?? null,
          requestType,
          payload.service_type ?? null,
          payload.source_module ?? null,
          payload.source_record_id ?? null,
          status,
          payload.submitted_at ?? null,
          payload.acknowledged_at ?? null,
          payload.finalized_at ?? null,
          payload.processing_duration_ms ?? null,
          payload.retry_count ?? 0,
          payload.successful ?? false,
          sourceUpdatedAt,
          payload.projected_at ?? new Date().toISOString(),
          event.event_version,
        ],
      );
    }

    await this.dirtyPeriodService.mark(manager, {
      companyId: event.company_id,
      branchId: event.branch_id,
      domain: 'TIRAMIS',
      metricDate,
    });
  }
}
