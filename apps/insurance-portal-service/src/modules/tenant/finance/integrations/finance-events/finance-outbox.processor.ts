import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';

import { returningRows } from '../../../../../database/returning-rows.util';
import {
  EventOutcome,
  FailureClass,
  FinanceEventContractRegistry,
  OutboxEventRow,
  PermanentEventError,
} from './finance-event-contracts';

type Runner = Pick<EntityManager, 'query'>;
type FinalStatus = 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER' | 'BLOCKED';
type AttemptResult = FinalStatus | 'DUPLICATE_SUPPRESSED';

/**
 * Finance outbox worker.
 *
 * Claim: FOR UPDATE SKIP LOCKED, lease in next_attempt_at, claim_generation
 * incremented per claim (fencing token).
 *
 * Consume: one transaction that locks the event row, re-checks the claim,
 * takes an advisory lock on the consumer idempotency key, and then either
 * suppresses a duplicate (a final outcome for the key already exists) or runs
 * the consumer and records its durable outcome with the fenced status. No
 * external network call happens inside this transaction.
 *
 * Statuses: PUBLISHED (consumer finished; finance_event_outcomes says what
 * that means), FAILED (transient, will retry), BLOCKED (no accounting
 * outcome; needs investigation and replay), DEAD_LETTER (permanent or
 * exhausted). PUBLISHED alone never implies a journal exists.
 */
@Injectable()
export class FinanceOutboxProcessor {
  private readonly logger = new Logger(FinanceOutboxProcessor.name);
  private isRunning = false;
  /** Identifies this process in claimed_by; diagnostic only, not the fence. */
  private readonly workerId = `outbox-${process.pid}-${randomUUID()}`;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly contracts: FinanceEventContractRegistry,
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
        try {
          await this.publishOne(event.id, event.generation);
        } catch {
          // Already recorded as FAILED/DEAD_LETTER; keep draining the batch
          // so one bad event cannot strand the rest in PROCESSING.
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async claimBatch(
    batchSize: number,
  ): Promise<Array<{ id: string; generation: string }>> {
    const leaseMinutes = this.configService.get<number>(
      'FINANCE_OUTBOX_LEASE_MINUTES',
      10,
    );
    const result = await this.dataSource.transaction(async (manager) => {
      // next_attempt_at doubles as a lease while PROCESSING: a worker that
      // dies mid-publish leaves the row reclaimable once the lease passes.
      return manager.query(
        `
          WITH picked AS (
            SELECT id
            FROM finance_outbox_events
            WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
              AND next_attempt_at <= now()
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
          )
          UPDATE finance_outbox_events event
          SET status = 'PROCESSING',
              next_attempt_at = now() + make_interval(mins => $2),
              claim_generation = event.claim_generation + 1,
              claimed_by = $3,
              claimed_at = now(),
              processing_started_at = now()
          FROM picked
          WHERE event.id = picked.id
          RETURNING event.id, event.claim_generation::text AS generation
        `,
        [batchSize, leaseMinutes, this.workerId],
      );
    });

    type ClaimRow = { id?: string | null; generation?: unknown } | null;
    return returningRows<ClaimRow>(result)
      .filter(
        (row): row is { id: string; generation: unknown } =>
          typeof row?.id === 'string' && row.id.length > 0,
      )
      .map((row) => ({ id: row.id, generation: String(row.generation) }));
  }

  /**
   * Writes a status only if this worker still holds the claim, and appends
   * the attempt to the immutable history in the same statement. Returns false
   * when a newer claim (after lease expiry) superseded it.
   */
  private async writeFencedOutcome(
    runner: Runner,
    eventId: string,
    generation: string,
    outcome: {
      status: FinalStatus;
      attemptResult?: AttemptResult;
      attemptCount?: number;
      nextAttemptAt?: Date;
      failureClass: FailureClass | null;
      lastError: string | null;
    },
  ): Promise<boolean> {
    const result = await runner.query(
      `WITH updated AS (
         UPDATE finance_outbox_events event
            SET status = $3::varchar,
                published_at = CASE WHEN $3::varchar = 'PUBLISHED' THEN now() ELSE event.published_at END,
                attempt_count = COALESCE($4::int, event.attempt_count),
                next_attempt_at = COALESCE($5::timestamptz, event.next_attempt_at),
                last_error = $6::text,
                failure_class = $7::varchar,
                last_processed_at = now(),
                claimed_by = NULL,
                replay_request_id = NULL
           FROM (SELECT id, replay_request_id AS prior_replay
                   FROM finance_outbox_events WHERE id = $1) prior
          WHERE event.id = prior.id
            AND event.claim_generation = $2::bigint
            AND event.status = 'PROCESSING'
          RETURNING event.id, event.company_id, event.claim_generation,
                    prior.prior_replay, event.processing_started_at
       ), history AS (
         INSERT INTO finance_event_attempts
           (outbox_event_id, company_id, claim_generation, worker, trigger,
            replay_request_id, result, failure_class, error, started_at)
         SELECT id, company_id, claim_generation, $8,
                CASE WHEN prior_replay IS NULL THEN 'WORKER' ELSE 'REPLAY' END,
                prior_replay, $9, $7, $6, COALESCE(processing_started_at, now())
           FROM updated
       )
       SELECT id FROM updated`,
      [
        eventId,
        generation,
        outcome.status,
        outcome.attemptCount ?? null,
        outcome.nextAttemptAt ?? null,
        outcome.lastError,
        outcome.failureClass,
        this.workerId,
        outcome.attemptResult ?? outcome.status,
      ],
    );
    const written = returningRows<{ id?: string } | null>(result).length > 0;
    if (!written) {
      this.logger.warn(
        `Stale finance outbox claim ignored for ${eventId} (generation ${generation}).`,
      );
    }
    return written;
  }

  /**
   * Consumer effects, the durable outcome and the fenced status commit in one
   * transaction that holds the event row lock. A newer claim cannot be taken
   * while the lock is held (claims use SKIP LOCKED); a stale worker that gets
   * the lock afterwards sees a different generation and does nothing.
   */
  private async publishOne(eventId: string, generation: string): Promise<void> {
    if (!eventId) {
      return;
    }

    let attemptCount = 0;
    try {
      await this.dataSource.transaction(async (manager) => {
        const [event] = await manager.query(
          `SELECT id, company_id, aggregate_type, aggregate_id, event_type,
                  event_key, schema_version, payload, status, attempt_count,
                  claim_generation::text AS claim_generation
             FROM finance_outbox_events
            WHERE id = $1
            FOR UPDATE`,
          [eventId],
        );

        if (
          !event ||
          event.status !== 'PROCESSING' ||
          String(event.claim_generation) !== generation
        ) {
          // Missing or superseded; never act on another worker's claim.
          attemptCount = -1;
          return;
        }
        attemptCount = Number(event.attempt_count ?? 0) + 1;

        const contract = this.contracts.get(event.event_type);
        if (!contract) {
          throw new PermanentEventError(
            'UNSUPPORTED',
            'UNSUPPORTED_FINANCE_OUTBOX_CONTRACT',
          );
        }
        if (!contract.schemaVersions.includes(Number(event.schema_version))) {
          throw new PermanentEventError(
            'UNSUPPORTED',
            `UNSUPPORTED_FINANCE_OUTBOX_SCHEMA_VERSION: ${event.event_type} v${event.schema_version}`,
          );
        }

        const key = contract.idempotencyKey(event);
        // Serialize every delivery of the same intended operation.
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`finance-event:${event.company_id}:${contract.consumer}:${key}`],
        );
        const [existing] = await manager.query(
          `SELECT id, outbox_event_id, business_outcome
             FROM finance_event_outcomes
            WHERE company_id = $1 AND consumer = $2 AND idempotency_key = $3`,
          [event.company_id, contract.consumer, key],
        );
        if (existing && existing.business_outcome !== 'BLOCKED') {
          // The operation already has a final outcome: never apply it twice.
          await this.writeFencedOutcome(manager, event.id, generation, {
            status: 'PUBLISHED',
            attemptResult: 'DUPLICATE_SUPPRESSED',
            failureClass: null,
            lastError:
              existing.outbox_event_id === event.id
                ? null
                : `Duplicate of outcome ${existing.id} (event ${existing.outbox_event_id}).`,
          });
          return;
        }

        const outcome = await contract.consume(event, manager);
        await this.recordOutcome(
          manager,
          event,
          contract.consumer,
          key,
          outcome,
        );

        const blocked = outcome.businessOutcome === 'BLOCKED';
        await this.writeFencedOutcome(manager, event.id, generation, {
          status: blocked ? 'BLOCKED' : 'PUBLISHED',
          attemptCount: blocked ? attemptCount : undefined,
          failureClass: blocked
            ? (outcome.accountingOutcome as
                | 'POLICY_BLOCKED'
                | 'MISSING_JOURNAL')
            : null,
          lastError: blocked ? outcome.detail : null,
        });
        if (blocked) {
          this.logger.error(
            `[ALERT] Finance event ${event.id} (${event.event_type}) BLOCKED: ${outcome.accountingOutcome}`,
          );
        }
      });
    } catch (error) {
      if (attemptCount <= 0) {
        // Failed before the claim was confirmed (e.g. lock/connection error):
        // the lease will expire and the row will be reclaimed.
        throw error;
      }
      const maxAttempts = this.configService.get<number>(
        'FINANCE_OUTBOX_MAX_ATTEMPTS',
        10,
      );
      const delaySeconds = Math.min(
        3600,
        30 * 2 ** Math.max(attemptCount - 1, 0),
      );

      const permanent = error instanceof PermanentEventError;
      const exhausted = !permanent && attemptCount >= maxAttempts;
      const failureClass: FailureClass = permanent
        ? error.failureClass
        : exhausted
          ? 'RETRY_EXHAUSTED'
          : 'TRANSIENT';
      const lastError =
        error instanceof Error ? error.message : 'Outbox publication failed.';
      const status = permanent || exhausted ? 'DEAD_LETTER' : 'FAILED';
      await this.writeFencedOutcome(this.dataSource, eventId, generation, {
        status,
        attemptCount,
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
        failureClass,
        lastError,
      });

      this.logger.error(
        `${status === 'DEAD_LETTER' ? '[ALERT] ' : ''}Finance outbox publication failed for ${eventId} (${failureClass})`,
        lastError,
      );

      throw error;
    }
  }

  private async recordOutcome(
    manager: EntityManager,
    event: OutboxEventRow,
    consumer: string,
    key: string,
    outcome: EventOutcome,
  ) {
    // A BLOCKED outcome may be superseded by a later replay; a final one may
    // not (the duplicate check above already returned for final outcomes).
    await manager.query(
      `INSERT INTO finance_event_outcomes
         (company_id, outbox_event_id, event_type, schema_version, consumer,
          idempotency_key, source_type, source_id, source_revision, operation,
          business_outcome, business_reference, accounting_outcome,
          accounting_reference, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (company_id, consumer, idempotency_key) DO UPDATE
         SET outbox_event_id = EXCLUDED.outbox_event_id,
             source_revision = EXCLUDED.source_revision,
             business_outcome = EXCLUDED.business_outcome,
             business_reference = EXCLUDED.business_reference,
             accounting_outcome = EXCLUDED.accounting_outcome,
             accounting_reference = EXCLUDED.accounting_reference,
             detail = EXCLUDED.detail,
             processed_at = now()
         WHERE finance_event_outcomes.business_outcome = 'BLOCKED'`,
      [
        event.company_id,
        event.id,
        event.event_type,
        Number(event.schema_version),
        consumer,
        key,
        outcome.sourceType,
        outcome.sourceId,
        outcome.sourceRevision,
        outcome.operation,
        outcome.businessOutcome,
        outcome.businessReference,
        outcome.accountingOutcome,
        outcome.accountingReference,
        outcome.detail,
      ],
    );
  }
}
