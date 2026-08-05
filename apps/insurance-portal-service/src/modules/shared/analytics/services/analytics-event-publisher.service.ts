import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  AnalyticsAggregateType,
  AnalyticsEventType,
  AnalyticsProjectionStatus,
} from '../enums/analytics.enums';

@Injectable()
export class AnalyticsEventPublisherService {
  async publish(
    manager: EntityManager,
    params: {
      companyId?: string | null;
      branchId?: string | null;

      sourceModule: string;

      aggregateType: AnalyticsAggregateType;

      aggregateId: string;

      eventType: AnalyticsEventType;

      eventVersion: string;

      occurredAt?: Date;

      payload?: Record<string, unknown>;
    },
  ): Promise<void> {
    const eventKey = [
      params.sourceModule,
      params.aggregateType,
      params.aggregateId,
      params.eventType,
      params.eventVersion,
    ].join(':');

    await manager
      .createQueryBuilder()
      .insert()
      .into('analytics_projection_events')
      .values({
        event_key: eventKey.slice(0, 220),

        company_id: params.companyId ?? null,

        branch_id: params.branchId ?? null,

        source_module: params.sourceModule,

        aggregate_type: params.aggregateType,

        aggregate_id: params.aggregateId,

        event_type: params.eventType,

        event_version: params.eventVersion,

        occurred_at: params.occurredAt ?? new Date(),

        payload: params.payload ?? {},

        status: AnalyticsProjectionStatus.PENDING,

        attempt_count: 0,

        next_attempt_at: new Date(),
      })
      .orIgnore()
      .execute();
  }
}
