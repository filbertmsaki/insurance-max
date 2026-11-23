import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { FinanceOutboxClaimFencing1798700000000 } from '../../src/database/migrations/1798700000000-FinanceOutboxClaimFencing';
import { FinanceEventOutcomes1798800000000 } from '../../src/database/migrations/1798800000000-FinanceEventOutcomes';
import { FinanceEventContractRegistry } from '../../src/modules/tenant/finance/integrations/finance-events/finance-event-contracts';
import { FinanceOutboxProcessor } from '../../src/modules/tenant/finance/integrations/finance-events/finance-outbox.processor';
import { withFinanceTestDatabase } from '../support/finance-test-database';

/**
 * Sprint 1 evidence: outbox claim fencing on real PostgreSQL.
 *
 * The pre-fencing table is created from the baseline DDL, the fencing migration
 * is applied (and rolled back / reapplied), then real FinanceOutboxProcessor
 * instances run against it. The consumer records one side-effect row per
 * application through the transaction manager it is given, so the test can
 * count exactly how many times a projection committed.
 */

const BASELINE_DDL = `CREATE TABLE finance_outbox_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  aggregate_type varchar(80) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  event_key varchar(180) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id))`;

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    get: (key: string, fallback: unknown) => overrides[key] ?? fallback,
  }) as unknown as ConfigService;

/** Records each committed application; optional hook runs mid-transaction. */
function recordingConsumer(
  hook?: (event: { eventId: string }) => Promise<void>,
) {
  return {
    apply: async (event: { eventId: string }, manager: EntityManager) => {
      await manager.query(
        `INSERT INTO outbox_side_effects (event_id) VALUES ($1)`,
        [event.eventId],
      );
      if (hook) await hook(event);
    },
  };
}

async function insertEvent(
  ds: DataSource,
  companyId: string,
  overrides: { eventType?: string; payloadCompany?: string } = {},
) {
  const eventId = randomUUID();
  const [row] = await ds.query(
    `INSERT INTO finance_outbox_events
       (company_id, aggregate_type, aggregate_id, event_type, event_key, payload)
     VALUES ($1, 'INVOICE', $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [
      companyId,
      randomUUID(),
      overrides.eventType ?? 'QUOTATION_PAYMENT_EVENT',
      `fixture:${eventId}`,
      JSON.stringify({
        eventId,
        companyId: overrides.payloadCompany ?? companyId,
      }),
    ],
  );
  return { id: row.id as string, eventId };
}

const sideEffects = async (ds: DataSource, eventId?: string) =>
  Number(
    (
      await ds.query(
        `SELECT count(*)::int AS n FROM outbox_side_effects
          WHERE ($1::text IS NULL OR event_id = $1)`,
        [eventId ?? null],
      )
    )[0].n,
  );

const row = async (ds: DataSource, id: string) =>
  (
    await ds.query(
      `SELECT status, attempt_count, claim_generation::text AS generation,
              claimed_by, last_error
         FROM finance_outbox_events WHERE id = $1`,
      [id],
    )
  )[0];

const expireLease = (ds: DataSource, id: string) =>
  ds.query(
    `UPDATE finance_outbox_events
        SET next_attempt_at = now() - interval '1 second' WHERE id = $1`,
    [id],
  );

const processor = (
  ds: DataSource,
  consumer: unknown,
  overrides: Record<string, unknown> = {},
) =>
  new FinanceOutboxProcessor(
    ds,
    config(overrides),
    // The recording consumer stands in for the quotation projection.
    new FinanceEventContractRegistry(consumer as never, {
      requireEligible: async () => undefined,
    }),
  ) as any;

describe('Finance outbox claim fencing on PostgreSQL', () => {
  it('migrates, recovers, fences stale workers and applies side effects once', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      const ds = dataSource;
      const companyId = randomUUID();

      // ---- Migration compatibility: legacy row survives up/down/up ----
      await ds.query(BASELINE_DDL);
      await ds.query(
        `CREATE UNIQUE INDEX "UQ_finance_outbox_event_key_entity"
           ON finance_outbox_events (company_id, event_key)`,
      );
      await ds.query(
        `CREATE TABLE outbox_side_effects (
           id bigserial PRIMARY KEY, event_id text NOT NULL)`,
      );
      const legacy = await insertEvent(ds, companyId);
      const migration = new FinanceOutboxClaimFencing1798700000000();
      const runner = ds.createQueryRunner();
      try {
        await migration.up(runner);
        await migration.down(runner);
        expect(
          await ds.query(
            `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'finance_outbox_events'
                AND column_name LIKE 'claim%'`,
          ),
        ).toEqual([]);
        await migration.up(runner);
        // Sprint 2 schema (attempt history) is required by the processor.
        await new FinanceEventOutcomes1798800000000().up(runner);
      } finally {
        await runner.release();
      }
      expect(await row(ds, legacy.id)).toMatchObject({
        status: 'PENDING',
        generation: '0',
        claimed_by: null,
      });

      // ---- Legacy row is processed normally after migration ----
      await processor(ds, recordingConsumer()).processPending();
      expect(await row(ds, legacy.id)).toMatchObject({
        status: 'PUBLISHED',
        generation: '1',
        claimed_by: null,
      });
      expect(await sideEffects(ds, legacy.eventId)).toBe(1);

      // ---- Concurrent workers: every event applied exactly once ----
      const batch = await Promise.all(
        Array.from({ length: 30 }, () => insertEvent(ds, companyId)),
      );
      const workers = Array.from({ length: 4 }, () =>
        processor(ds, recordingConsumer(), { FINANCE_OUTBOX_BATCH_SIZE: 5 }),
      );
      for (let round = 0; round < 3; round += 1) {
        await Promise.all(workers.map((w) => w.processPending()));
      }
      const statuses = await ds.query(
        `SELECT status, count(*)::int AS n, max(claim_generation)::int AS g
           FROM finance_outbox_events WHERE id = ANY($1) GROUP BY status`,
        [batch.map((e) => e.id)],
      );
      expect(statuses).toEqual([{ status: 'PUBLISHED', n: 30, g: 1 }]);
      for (const e of batch) {
        expect(await sideEffects(ds, e.eventId)).toBe(1);
      }

      // ---- Crash recovery: claimed, never finished, lease expires ----
      const crashed = await insertEvent(ds, companyId);
      const deadWorker = processor(ds, recordingConsumer());
      const [deadClaim] = await deadWorker.claimBatch(10);
      expect(deadClaim).toMatchObject({ id: crashed.id, generation: '1' });
      // A live worker cannot take it while the lease is valid.
      expect(await processor(ds, recordingConsumer()).claimBatch(10)).toEqual(
        [],
      );
      await expireLease(ds, crashed.id);
      await processor(ds, recordingConsumer()).processPending();
      expect(await row(ds, crashed.id)).toMatchObject({
        status: 'PUBLISHED',
        generation: '2',
      });
      expect(await sideEffects(ds, crashed.eventId)).toBe(1);

      // ---- Stale worker resumes after a newer worker finished ----
      // The dead worker comes back and tries to publish generation 1.
      await deadWorker.publishOne(crashed.id, '1');
      expect(await row(ds, crashed.id)).toMatchObject({
        status: 'PUBLISHED',
        generation: '2',
      });
      expect(await sideEffects(ds, crashed.eventId)).toBe(1);

      // ---- Stale failure cannot overwrite a newer claim in progress ----
      const contested = await insertEvent(ds, companyId);
      const slow = processor(ds, recordingConsumer());
      const [slowClaim] = await slow.claimBatch(10);
      await expireLease(ds, contested.id);
      const fresh = processor(ds, recordingConsumer());
      const [freshClaim] = await fresh.claimBatch(10);
      expect(freshClaim.generation).toBe('2');
      // The stale worker's attempt (gen 1) neither acts nor writes FAILED.
      await slow.publishOne(contested.id, slowClaim.generation);
      expect(await row(ds, contested.id)).toMatchObject({
        status: 'PROCESSING',
        generation: '2',
        attempt_count: 0,
      });
      expect(await sideEffects(ds, contested.eventId)).toBe(0);
      await fresh.publishOne(contested.id, freshClaim.generation);
      expect(await row(ds, contested.id)).toMatchObject({
        status: 'PUBLISHED',
      });
      expect(await sideEffects(ds, contested.eventId)).toBe(1);

      // ---- Lease expires while a worker is mid-consume ----
      // The row lock held during consumption makes the reclaim skip it, so
      // no second worker can start the same side effect concurrently.
      const midFlight = await insertEvent(ds, companyId);
      let reclaimedDuringConsume: unknown[] | undefined;
      const holder = processor(ds, recordingConsumer());
      const [holderClaim] = await holder.claimBatch(10);
      await ds.query(
        `UPDATE finance_outbox_events
            SET next_attempt_at = now() - interval '1 second' WHERE id = $1`,
        [midFlight.id],
      );
      const holderWithoutBlockingHook = processor(
        ds,
        recordingConsumer(async (event) => {
          if (event.eventId !== midFlight.eventId) return;
          reclaimedDuringConsume = await processor(
            ds,
            recordingConsumer(),
          ).claimBatch(10);
        }),
      );
      await holderWithoutBlockingHook.publishOne(
        midFlight.id,
        holderClaim.generation,
      );
      expect(reclaimedDuringConsume).toEqual([]);
      expect(await row(ds, midFlight.id)).toMatchObject({
        status: 'PUBLISHED',
        generation: '1',
      });
      expect(await sideEffects(ds, midFlight.eventId)).toBe(1);

      // ---- Retry with rollback, then dead letter at the limit ----
      const flaky = await insertEvent(ds, companyId);
      const failing = {
        apply: async (event: { eventId: string }, manager: EntityManager) => {
          await manager.query(
            `INSERT INTO outbox_side_effects (event_id) VALUES ($1)`,
            [event.eventId],
          );
          throw new Error('DOWNSTREAM_UNAVAILABLE');
        },
      };
      const retrying = processor(ds, failing, {
        FINANCE_OUTBOX_MAX_ATTEMPTS: 2,
      });
      await retrying.processPending();
      expect(await row(ds, flaky.id)).toMatchObject({
        status: 'FAILED',
        attempt_count: 1,
        last_error: 'DOWNSTREAM_UNAVAILABLE',
      });
      // The failed attempt's side effect rolled back with its transaction.
      expect(await sideEffects(ds, flaky.eventId)).toBe(0);
      await expireLease(ds, flaky.id);
      await retrying.processPending();
      expect(await row(ds, flaky.id)).toMatchObject({
        status: 'DEAD_LETTER',
        attempt_count: 2,
      });
      expect(await sideEffects(ds, flaky.eventId)).toBe(0);

      // ---- Unsupported and cross-company events dead-letter at once ----
      const unknown = await insertEvent(ds, companyId, {
        eventType: 'UNKNOWN_CONTRACT',
      });
      const foreign = await insertEvent(ds, companyId, {
        payloadCompany: randomUUID(),
      });
      await processor(ds, recordingConsumer()).processPending();
      expect(await row(ds, unknown.id)).toMatchObject({
        status: 'DEAD_LETTER',
        last_error: 'UNSUPPORTED_FINANCE_OUTBOX_CONTRACT',
      });
      expect(await row(ds, foreign.id)).toMatchObject({
        status: 'DEAD_LETTER',
        last_error: 'FINANCE_OUTBOX_COMPANY_SCOPE_MISMATCH',
      });
      expect(await sideEffects(ds, foreign.eventId)).toBe(0);
    });
  }, 120_000);
});
