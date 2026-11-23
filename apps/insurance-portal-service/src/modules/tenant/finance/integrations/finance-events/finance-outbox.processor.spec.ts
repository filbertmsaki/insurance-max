import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { FinanceOutboxProcessor } from './finance-outbox.processor';
import {
  EventOutcome,
  FinanceEventContract,
  PermanentEventError,
} from './finance-event-contracts';

type EventRow = Record<string, unknown> & { id: string };

const applied: EventOutcome = {
  sourceType: 'INVOICE',
  sourceId: '00000000-0000-4000-8000-000000000001',
  sourceRevision: null,
  operation: 'TEST',
  businessOutcome: 'APPLIED',
  businessReference: null,
  accountingOutcome: 'NOT_APPLICABLE',
  accountingReference: null,
  detail: null,
};

function contract(
  consume: FinanceEventContract['consume'] = jest
    .fn()
    .mockResolvedValue(applied),
): FinanceEventContract {
  return {
    eventType: 'QUOTATION_PAYMENT_EVENT',
    schemaVersions: [1],
    consumer: 'test-consumer',
    role: 'BUSINESS_PROJECTION',
    idempotencyKey: (event) => `key:${event.id}`,
    consume,
  };
}

/**
 * SQL-routing harness. The fenced outcome write (WITH updated …) only applies
 * when the generation and PROCESSING status still match the in-memory row.
 */
function harness(
  event: EventRow | null,
  options: {
    claimRows?: unknown[];
    contract?: FinanceEventContract;
    config?: Record<string, unknown>;
    existingOutcome?: Record<string, unknown>;
  } = {},
) {
  const claimRows =
    options.claimRows ?? (event ? [{ id: event.id, generation: '1' }] : []);
  const writes: Array<Record<string, unknown>> = [];
  const outcomes: unknown[][] = [];
  const fenced = jest
    .fn()
    .mockImplementation(async (_sql: string, p: any[]) => {
      const [
        id,
        generation,
        status,
        attemptCount,
        ,
        lastError,
        failureClass,
        ,
        attemptResult,
      ] = p;
      const current =
        event &&
        event.id === id &&
        String(event.claim_generation) === generation &&
        event.status === 'PROCESSING';
      if (!current) return [];
      event.status = status;
      if (attemptCount !== null) event.attempt_count = attemptCount;
      event.last_error = lastError;
      event.failure_class = failureClass;
      writes.push({
        status,
        attemptCount,
        lastError,
        failureClass,
        attemptResult,
      });
      return [{ id }];
    });
  const sqlLog: string[] = [];
  const query = jest.fn().mockImplementation(async (sql: string, p: any[]) => {
    sqlLog.push(sql);
    if (sql.includes('WITH picked')) return [claimRows, claimRows.length];
    if (sql.includes('WITH updated')) return fenced(sql, p);
    if (sql.includes('FOR UPDATE'))
      return event && event.id === p[0] ? [{ ...event }] : [];
    if (sql.includes('pg_advisory_xact_lock')) return [];
    if (sql.includes('INSERT INTO finance_event_outcomes')) {
      outcomes.push(p);
      return [];
    }
    if (sql.includes('FROM finance_event_outcomes'))
      return options.existingOutcome ? [options.existingOutcome] : [];
    throw new Error(`Unexpected SQL: ${sql.slice(0, 60)}`);
  });
  const manager = { query };
  const dataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => cb(manager)),
    query,
  };
  const config = {
    get: jest
      .fn()
      .mockImplementation(
        (key: string, fallback: unknown) => options.config?.[key] ?? fallback,
      ),
  };
  const used = options.contract ?? contract();
  const registry = {
    get: (type: string) => (type === used.eventType ? used : undefined),
  };
  const processor = new FinanceOutboxProcessor(
    dataSource as unknown as DataSource,
    config as unknown as ConfigService,
    registry as never,
  );
  return {
    processor,
    manager,
    fenced,
    writes,
    outcomes,
    sqlLog,
    contract: used,
  };
}

const processing = (overrides: Record<string, unknown> = {}): EventRow => ({
  id: 'event-1',
  company_id: 'company-1',
  aggregate_id: 'agg-1',
  status: 'PROCESSING',
  claim_generation: '1',
  event_type: 'QUOTATION_PAYMENT_EVENT',
  schema_version: 1,
  payload: { eventId: 'e', companyId: 'company-1' },
  attempt_count: 0,
  last_error: null,
  ...overrides,
});

describe('FinanceOutboxProcessor', () => {
  it('publishes and records a durable outcome in the consuming transaction', async () => {
    const event = processing();
    const {
      processor,
      writes,
      outcomes,
      sqlLog,
      manager,
      contract: c,
    } = harness(event);
    await processor.processPending();
    expect(c.consume).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event-1' }),
      manager,
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].slice(4, 6)).toEqual(['test-consumer', 'key:event-1']);
    expect(writes).toEqual([
      expect.objectContaining({
        status: 'PUBLISHED',
        attemptResult: 'PUBLISHED',
      }),
    ]);
    expect(sqlLog[0]).toContain(
      'claim_generation = event.claim_generation + 1',
    );
    expect(sqlLog.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(
      true,
    );
  });

  it('suppresses a duplicate when a final outcome already exists', async () => {
    const event = processing();
    const {
      processor,
      writes,
      outcomes,
      contract: c,
    } = harness(event, {
      existingOutcome: {
        id: 'outcome-0',
        outbox_event_id: 'event-0',
        business_outcome: 'APPLIED',
      },
    });
    await processor.processPending();
    expect(c.consume).not.toHaveBeenCalled();
    expect(outcomes).toHaveLength(0);
    expect(writes).toEqual([
      expect.objectContaining({
        status: 'PUBLISHED',
        attemptResult: 'DUPLICATE_SUPPRESSED',
      }),
    ]);
  });

  it('re-runs the consumer when the existing outcome is BLOCKED', async () => {
    const event = processing();
    const { processor, contract: c } = harness(event, {
      existingOutcome: {
        id: 'o',
        outbox_event_id: 'event-1',
        business_outcome: 'BLOCKED',
      },
    });
    await processor.processPending();
    expect(c.consume).toHaveBeenCalledTimes(1);
  });

  it('marks BLOCKED (not PUBLISHED) when no accounting outcome exists', async () => {
    const event = processing();
    const { processor, writes } = harness(event, {
      contract: contract(
        jest.fn().mockResolvedValue({
          ...applied,
          businessOutcome: 'BLOCKED',
          accountingOutcome: 'POLICY_BLOCKED',
          detail: 'held',
        }),
      ),
    });
    await processor.processPending();
    expect(writes).toEqual([
      expect.objectContaining({
        status: 'BLOCKED',
        failureClass: 'POLICY_BLOCKED',
        attemptCount: 1,
      }),
    ]);
  });

  it.each([
    ['UNKNOWN_CONTRACT', 1, 'UNSUPPORTED'],
    ['QUOTATION_PAYMENT_EVENT', 2, 'UNSUPPORTED'],
  ])(
    'dead-letters unsupported contracts and schema versions (%s v%s)',
    async (eventType, version, failureClass) => {
      const event = processing({
        event_type: eventType,
        schema_version: version,
      });
      const { processor, writes, contract: c } = harness(event);
      await processor.processPending();
      expect(c.consume).not.toHaveBeenCalled();
      expect(writes).toEqual([
        expect.objectContaining({ status: 'DEAD_LETTER', failureClass }),
      ]);
    },
  );

  it('dead-letters a permanent failure on the first attempt', async () => {
    const event = processing();
    const { processor, writes } = harness(event, {
      contract: contract(
        jest
          .fn()
          .mockRejectedValue(
            new PermanentEventError(
              'SCOPE_MISMATCH',
              'FINANCE_OUTBOX_COMPANY_SCOPE_MISMATCH',
            ),
          ),
      ),
    });
    await processor.processPending();
    expect(writes).toEqual([
      expect.objectContaining({
        status: 'DEAD_LETTER',
        failureClass: 'SCOPE_MISMATCH',
        attemptCount: 1,
        lastError: 'FINANCE_OUTBOX_COMPANY_SCOPE_MISMATCH',
      }),
    ]);
  });

  it('retries a transient failure, then dead-letters at the retry limit', async () => {
    const event = processing({ attempt_count: 1 });
    const failing = contract(jest.fn().mockRejectedValue(new Error('timeout')));
    const first = harness(event, {
      contract: failing,
      config: { FINANCE_OUTBOX_MAX_ATTEMPTS: 3 },
    });
    await first.processor.processPending();
    expect(first.writes[0]).toMatchObject({
      status: 'FAILED',
      failureClass: 'TRANSIENT',
      attemptCount: 2,
    });

    const again = processing({ attempt_count: 2 });
    const second = harness(again, {
      contract: failing,
      config: { FINANCE_OUTBOX_MAX_ATTEMPTS: 3 },
    });
    await second.processor.processPending();
    expect(second.writes[0]).toMatchObject({
      status: 'DEAD_LETTER',
      failureClass: 'RETRY_EXHAUSTED',
      attemptCount: 3,
    });
  });

  it('skips malformed claimed rows before publish', async () => {
    const {
      processor,
      fenced,
      contract: c,
    } = harness(null, {
      claimRows: [{ id: null }, {}],
    });
    await processor.processPending();
    expect(fenced).not.toHaveBeenCalled();
    expect(c.consume).not.toHaveBeenCalled();
  });

  it('does not start work on a row already reclaimed by a newer worker', async () => {
    const event = processing({ claim_generation: '2' });
    const { processor, fenced, contract: c } = harness(event);
    await processor.processPending();
    expect(c.consume).not.toHaveBeenCalled();
    expect(fenced).not.toHaveBeenCalled();
    expect(event.status).toBe('PROCESSING');
  });

  it('a stale worker cannot overwrite the outcome of a newer claim', async () => {
    const event = processing();
    const { processor, writes } = harness(event, {
      contract: contract(
        jest.fn().mockImplementation(async () => {
          // Lease expires mid-consume; a newer worker reclaims and publishes.
          event.claim_generation = '2';
          event.status = 'PUBLISHED';
          throw new Error('slow downstream failure');
        }),
      ),
    });
    await processor.processPending();
    expect(writes).toEqual([]);
    expect(event.status).toBe('PUBLISHED');
    expect(event.attempt_count).toBe(0);
  });
});
