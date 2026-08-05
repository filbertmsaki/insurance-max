import { EntityManager } from 'typeorm';

import { AnalyticsProjectionEvent } from '../entities/analytics-projection-event.entity';
import { AnalyticsAggregateType } from '../enums/analytics.enums';

export interface AnalyticsProjectionHandler {
  readonly aggregateType: AnalyticsAggregateType;

  project(
    manager: EntityManager,
    event: AnalyticsProjectionEvent,
  ): Promise<void>;
}

export const ANALYTICS_PROJECTION_HANDLERS = Symbol(
  'ANALYTICS_PROJECTION_HANDLERS',
);
