import {
  Inject,
  Injectable,
} from '@nestjs/common';

import { AnalyticsAggregateType } from '../enums/analytics.enums';

import {
  ANALYTICS_PROJECTION_HANDLERS,
  AnalyticsProjectionHandler,
} from '../interfaces/analytics-projection-handler.interface';

@Injectable()
export class AnalyticsProjectionRegistryService {
  private readonly handlers =
    new Map<
      AnalyticsAggregateType,
      AnalyticsProjectionHandler
    >();

  constructor(
    @Inject(
      ANALYTICS_PROJECTION_HANDLERS,
    )
    handlers:
      AnalyticsProjectionHandler[],
  ) {
    for (const handler of handlers) {
      if (
        this.handlers.has(
          handler.aggregateType,
        )
      ) {
        throw new Error(
          `Duplicate analytics handler: ${handler.aggregateType}`,
        );
      }

      this.handlers.set(
        handler.aggregateType,
        handler,
      );
    }
  }

  get(
    aggregateType:
      AnalyticsAggregateType,
  ): AnalyticsProjectionHandler {
    const handler =
      this.handlers.get(
        aggregateType,
      );

    if (!handler) {
      throw new Error(
        `No analytics handler registered for ${aggregateType}`,
      );
    }

    return handler;
  }
}
