import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { AnalyticsProjectionEvent } from '../entities/analytics-projection-event.entity';

import { AnalyticsProjectionStatus } from '../enums/analytics.enums';

import { AnalyticsProjectionRegistryService } from '../services/analytics-projection-registry.service';

@Injectable()
export class AnalyticsProjectionJob {
  private readonly logger = new Logger(AnalyticsProjectionJob.name);

  constructor(
    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,

    private readonly registry: AnalyticsProjectionRegistryService,
  ) {}

  @Cron('*/10 * * * * *')
  async process(): Promise<void> {
    const enabled = this.configService.get<boolean>('ANALYTICS_ENABLED', true);

    if (!enabled) {
      return;
    }

    const batchSize = this.configService.get<number>(
      'ANALYTICS_PROJECTION_BATCH_SIZE',
      100,
    );

    const events = await this.claimBatch(batchSize);

    for (const event of events) {
      await this.processOne(event);
    }
  }

  private async claimBatch(
    batchSize: number,
  ): Promise<AnalyticsProjectionEvent[]> {
    const rows = await this.dataSource.transaction(async (manager) => {
      return manager.query(
        `
            WITH picked AS (
              SELECT id
              FROM analytics_projection_events
              WHERE
                status IN (
                  'PENDING',
                  'FAILED'
                )
                AND next_attempt_at <= now()
              ORDER BY sequence_no ASC
              FOR UPDATE SKIP LOCKED
              LIMIT $1
            )
            UPDATE analytics_projection_events event
            SET
              status = 'PROCESSING',
              locked_at = now(),
              attempt_count =
                event.attempt_count + 1
            FROM picked
            WHERE event.id = picked.id
            RETURNING event.*
            `,
        [batchSize],
      );
    });

    return rows.filter(
      (
        row: Partial<AnalyticsProjectionEvent> | null | undefined,
      ): row is AnalyticsProjectionEvent => !!row?.id && !!row.aggregate_type,
    );
  }

  private async processOne(event: AnalyticsProjectionEvent): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const handler = this.registry.get(event.aggregate_type);

        await handler.project(manager, event);

        await manager.query(
          `
            UPDATE analytics_projection_events
            SET
              status = 'PROCESSED',
              processed_at = now(),
              locked_at = NULL,
              last_error = NULL
            WHERE id = $1
            `,
          [event.id],
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const maxAttempts = this.configService.get<number>(
        'ANALYTICS_PROJECTION_MAX_ATTEMPTS',
        8,
      );

      const deadLetter = event.attempt_count >= maxAttempts;

      const delaySeconds = Math.min(
        3600,
        15 * 2 ** Math.max(event.attempt_count - 1, 0),
      );

      await this.dataSource.query(
        `
        UPDATE analytics_projection_events
        SET
          status = $2,
          locked_at = NULL,
          last_error = $3,
          next_attempt_at =
            now() +
            ($4::text || ' seconds')::interval
        WHERE id = $1
        `,
        [
          event.id,

          deadLetter
            ? AnalyticsProjectionStatus.DEAD_LETTER
            : AnalyticsProjectionStatus.FAILED,

          message.slice(0, 5000),

          delaySeconds,
        ],
      );

      this.logger.error(`Analytics projection failed: ${event.id}`, message);
    }
  }
}
