import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { QuotationFinanceEvent } from '@insurance-max/contracts';
import { DataSource } from 'typeorm';

import { FinanceOutboxEvent } from '../entities/finance-outbox-event.entity';
import { QuotationPaymentEventService } from '../services/quotation-payment-event.service';

@Injectable()
export class FinanceOutboxProcessor {
  private readonly logger = new Logger(FinanceOutboxProcessor.name);
  private isRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly quotationPaymentEventService: QuotationPaymentEventService,
  ) {}

  @Cron(process.env.FINANCE_OUTBOX_CRON || '*/1 * * * *')
  async processPending() {
    const enabled = this.configService.get<boolean>(
      'FINANCE_OUTBOX_ENABLED',
      true,
    );

    if (!enabled || this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const batchSize = this.configService.get<number>(
        'FINANCE_OUTBOX_BATCH_SIZE',
        100,
      );
      const events = await this.claimBatch(batchSize);

      for (const event of events) {
        await this.publishOne(event.id);
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async claimBatch(batchSize: number): Promise<Array<{ id: string }>> {
    const rows = await this.dataSource.transaction(async (manager) => {
      return manager.query(
        `
          WITH picked AS (
            SELECT id
            FROM finance_outbox_events
            WHERE status IN ('PENDING', 'FAILED')
              AND next_attempt_at <= now()
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
          )
          UPDATE finance_outbox_events event
          SET status = 'PROCESSING'
          FROM picked
          WHERE event.id = picked.id
          RETURNING event.id
        `,
        [batchSize],
      );
    });

    return rows.filter(
      (row: { id?: string | null } | null | undefined): row is { id: string } =>
        typeof row?.id === 'string' && row.id.length > 0,
    );
  }

  private async publishOne(eventId: string): Promise<void> {
    if (!eventId) {
      return;
    }

    const repository = this.dataSource.getRepository(FinanceOutboxEvent);
    const event = await repository.findOneBy({ id: eventId });

    if (!event) {
      return;
    }

    if (event.status === 'PUBLISHED') {
      return;
    }

    try {
      switch (event.event_type) {
        case 'QUOTATION_PAYMENT_EVENT':
          await this.quotationPaymentEventService.apply(
            event.payload as unknown as QuotationFinanceEvent,
          );
          break;
        default:
          this.logger.debug(
            `Finance outbox event ${event.id} (${event.event_type}) has no explicit publisher and was marked published.`,
          );
          break;
      }

      event.status = 'PUBLISHED';
      event.published_at = new Date();
      event.last_error = null;
      await repository.save(event);
    } catch (error) {
      const attemptCount = Number(event.attempt_count ?? 0) + 1;
      const maxAttempts = this.configService.get<number>(
        'FINANCE_OUTBOX_MAX_ATTEMPTS',
        10,
      );
      const delaySeconds = Math.min(
        3600,
        30 * 2 ** Math.max(attemptCount - 1, 0),
      );

      event.status = attemptCount >= maxAttempts ? 'DEAD_LETTER' : 'FAILED';
      event.attempt_count = attemptCount;
      event.next_attempt_at = new Date(Date.now() + delaySeconds * 1000);
      event.last_error =
        error instanceof Error ? error.message : 'Outbox publication failed.';

      await repository.save(event);

      this.logger.error(
        `Finance outbox publication failed for ${event.id}`,
        event.last_error,
      );

      throw error;
    }
  }
}
