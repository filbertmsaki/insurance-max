import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { FinanceOutboxClaimFencing1798700000000 } from '../../src/database/migrations/1798700000000-FinanceOutboxClaimFencing';
import { FinanceEventOutcomes1798800000000 } from '../../src/database/migrations/1798800000000-FinanceEventOutcomes';
import { FinancePostingPolicyService } from '../../src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service';
import { FinanceEventContractRegistry } from '../../src/modules/tenant/finance/integrations/finance-events/finance-event-contracts';
import { FinanceEventOperationsService } from '../../src/modules/tenant/finance/integrations/finance-events/finance-event-operations.service';
import { FinanceOutboxProcessor } from '../../src/modules/tenant/finance/integrations/finance-events/finance-outbox.processor';
import { FinanceOutboxEvent } from '../../src/modules/tenant/finance/integrations/finance-events/entities/finance-outbox-event.entity';
import { FinanceOutboxService } from '../../src/modules/tenant/finance/integrations/finance-events/finance-outbox.service';
import { withFinanceTestDatabase } from '../support/finance-test-database';

/**
 * Sprint 2 acceptance on PostgreSQL: versioned contracts, consumer
 * idempotency, durable outcomes, retry/dead letter, policy-blocked handling,
 * maker/checker replay and monitoring totals.
 *
 * Real: outbox producer (FinanceOutboxService.add), processor, contract
 * registry, posting-policy gate (undeployed governance => FINANCE_POSTING_HELD),
 * operations service, both migrations, finance_journal_entries schema.
 * Synthetic: minimal invoices / commission_transactions source rows and the
 * journals the source commands would have posted (the real issue/accrual
 * commands are exercised in Sprint 3). All data is disposable test data.
 */

const BASELINE_OUTBOX_DDL = `CREATE TABLE finance_outbox_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  created_at timestamptz NOT NULL DEFAULT now())`;

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    get: (key: string, fallback: unknown) => overrides[key] ?? fallback,
  }) as unknown as ConfigService;

/** Records projection side effects through the consuming transaction. */
const quotationProjection = {
  apply: async (
    event: { eventId: string; workflowRevision?: number },
    manager: EntityManager,
  ) => {
    if (event.workflowRevision !== undefined && event.workflowRevision < 0) {
      return null; // stale revision: the real service skips and returns null
    }
    await manager.query(
      `INSERT INTO test_side_effects (event_id) VALUES ($1)`,
      [event.eventId],
    );
    return { applied: true };
  },
};

const sql = async (ds: DataSource, text: string, params: unknown[] = []) =>
  ds.query(text, params);

const one = async (ds: DataSource, text: string, params: unknown[] = []) =>
  (await ds.query(text, params))[0];

describe('Finance event outcomes, idempotency and replay on PostgreSQL', () => {
  it('meets the Sprint 2 acceptance scenarios', async () => {
    await withFinanceTestDatabase(async ({ dataSource: ds }) => {
      // ---------------------------------------------------------------- schema
      await sql(ds, BASELINE_OUTBOX_DDL);
      await sql(
        ds,
        `CREATE UNIQUE INDEX "UQ_finance_outbox_event_key_entity"
           ON finance_outbox_events (company_id, event_key)`,
      );
      await sql(
        ds,
        `CREATE TABLE invoices (id uuid PRIMARY KEY, company_id uuid NOT NULL,
           invoice_no text, status varchar(30) NOT NULL,
           total_amount numeric(20,4) NOT NULL, currency varchar(3) NOT NULL,
           issued_at timestamptz)`,
      );
      await sql(
        ds,
        `CREATE TABLE commission_transactions (id uuid PRIMARY KEY,
           company_id uuid NOT NULL, accrual_no text,
           commission_amount numeric(20,4) NOT NULL)`,
      );
      await sql(ds, `CREATE TABLE test_side_effects (event_id text NOT NULL)`);

      const companyA = randomUUID();
      const companyB = randomUUID();
      const outbox = new FinanceOutboxService();
      // The producer reads back through the entity; register it without sync.
      const producerDs = new DataSource({
        ...ds.options,
        entities: [FinanceOutboxEvent],
        migrations: [],
        migrationsRun: false,
        synchronize: false,
      });
      await producerDs.initialize();
      const produce = (
        companyId: string,
        params: {
          aggregateType: string;
          aggregateId: string;
          eventType: string;
          eventKey: string;
          payload: Record<string, unknown>;
        },
      ) =>
        producerDs.transaction((manager) =>
          outbox.add(manager, { companyId, ...params }),
        );

      // Legacy row produced before the Sprint 2 migration.
      const legacyQuote = await ds.query(
        `INSERT INTO finance_outbox_events
           (company_id, aggregate_type, aggregate_id, event_type, event_key, payload)
         VALUES ($1, 'INVOICE', $2, 'QUOTATION_PAYMENT_EVENT', 'legacy:1', $3::jsonb)
         RETURNING id`,
        [
          companyA,
          randomUUID(),
          JSON.stringify({ eventId: 'legacy-1', companyId: companyA }),
        ],
      );

      // ---------------------------------------------- migrations up/down/up
      const runner = ds.createQueryRunner();
      try {
        await new FinanceOutboxClaimFencing1798700000000().up(runner);
        const outcomes = new FinanceEventOutcomes1798800000000();
        await outcomes.up(runner);
        await outcomes.down(runner);
        expect(
          await one(
            ds,
            `SELECT to_regclass('public.finance_event_outcomes') AS t`,
          ),
        ).toEqual({ t: null });
        await outcomes.up(runner);
      } finally {
        await runner.release();
      }
      expect(
        await one(
          ds,
          `SELECT status, schema_version, failure_class FROM finance_outbox_events WHERE id = $1`,
          [legacyQuote[0].id],
        ),
      ).toEqual({ status: 'PENDING', schema_version: 1, failure_class: null });

      // ------------------------------------------------------- fixtures
      const journal = async (
        companyId: string,
        sourceType: string,
        sourceId: string,
      ) =>
        (
          await ds.query(
            `INSERT INTO finance_journal_entries
               (company_id, journal_no, journal_date, source_type, source_id,
                source_event_id, description, currency_code, entry_hash)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, 'UAT synthetic', 'TZS', 'uat')
             RETURNING id`,
            [
              companyId,
              `UAT-${randomUUID().slice(0, 8)}`,
              sourceType,
              sourceId,
              randomUUID(),
            ],
          )
        )[0].id as string;
      const invoice = async (
        companyId: string,
        status = 'ISSUED',
        issued = true,
        amount = '1180000.0000',
      ) => {
        const id = randomUUID();
        await sql(ds, `INSERT INTO invoices VALUES ($1,$2,$3,$4,$5,'TZS',$6)`, [
          id,
          companyId,
          `UAT-INV-${id.slice(0, 6)}`,
          status,
          amount,
          issued ? new Date() : null,
        ]);
        return id;
      };
      const issuedEvent = (
        companyId: string,
        id: string,
        amount = '1180000.0000',
        key?: string,
      ) =>
        produce(companyId, {
          aggregateType: 'INVOICE',
          aggregateId: id,
          eventType: 'INVOICE_ISSUED',
          eventKey: key ?? `invoice:${id}:issued`,
          payload: {
            invoiceId: id,
            invoiceNumber: 'UAT',
            sourceType: 'MANUAL',
            sourceRecordId: null,
            sourceRevision: 1,
            amount,
            currencyCode: 'TZS',
          },
        });

      // Real posting-policy gate: governance tables are not deployed here, so
      // it holds every source (FINANCE_POSTING_HELD) => POLICY_BLOCKED.
      const realRegistry = new FinanceEventContractRegistry(
        quotationProjection as never,
        new FinancePostingPolicyService(),
      );
      // An eligible gate distinguishes a genuinely missing journal.
      const eligibleRegistry = new FinanceEventContractRegistry(
        quotationProjection as never,
        { requireEligible: async () => undefined },
      );
      const worker = (registry = realRegistry, overrides = {}) =>
        new FinanceOutboxProcessor(ds, config(overrides), registry) as any;
      const ops = new FinanceEventOperationsService(ds, realRegistry);
      const expireLeases = () =>
        sql(
          ds,
          `UPDATE finance_outbox_events SET next_attempt_at = now() - interval '1 second'
                  WHERE status IN ('PENDING','FAILED','PROCESSING')`,
        );
      const event = (id: string) =>
        one(
          ds,
          `SELECT status, attempt_count, failure_class, last_error FROM finance_outbox_events WHERE id = $1`,
          [id],
        );
      const outcomeFor = (id: string) =>
        one(
          ds,
          `SELECT * FROM finance_event_outcomes WHERE outbox_event_id = $1`,
          [id],
        );

      // Legacy row is processed under the v1 contract.
      await worker().processPending();
      expect(await event(legacyQuote[0].id)).toMatchObject({
        status: 'PUBLISHED',
      });

      // -------------------------------------- 1. invoice issued -> recognized
      const inv1 = await invoice(companyA);
      const inv1Journal = await journal(companyA, 'INVOICE', inv1);
      const inv1Event = await issuedEvent(companyA, inv1);
      // -------------------------------------- 2. commission accrued -> recognized
      const accrual = randomUUID();
      await sql(
        ds,
        `INSERT INTO commission_transactions VALUES ($1,$2,'UAT-CA-1','118000.0000')`,
        [accrual, companyA],
      );
      const accrualJournal = await journal(
        companyA,
        'COMMISSION_ACCRUAL',
        accrual,
      );
      const accrualEvent = await produce(companyA, {
        aggregateType: 'COMMISSION_ACCRUAL',
        aggregateId: accrual,
        eventType: 'COMMISSION_ACCRUED',
        eventKey: `commission-accrual:${accrual}:accrued`,
        payload: {
          commissionAmount: '118000.0000',
          currencyCode: 'TZS',
          workflowRevision: 2,
        },
      });
      // -------------------------------------- 7. out of order: void before issue
      const inv2 = await invoice(companyA, 'VOIDED');
      await journal(companyA, 'INVOICE', inv2);
      const inv2Reversal = await journal(companyA, 'WRITE_OFF', inv2);
      const inv2Void = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: inv2,
        eventType: 'INVOICE_VOIDED',
        eventKey: `invoice:${inv2}:voided`,
        payload: { invoiceId: inv2, reason: 'UAT void' },
      });
      await sql(
        ds,
        `UPDATE finance_outbox_events SET created_at = now() - interval '1 minute' WHERE id = $1`,
        [inv2Void.id],
      );
      const inv2Issue = await issuedEvent(companyA, inv2);
      const draftVoidInvoice = await invoice(companyA, 'VOIDED', false);
      const draftVoid = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: draftVoidInvoice,
        eventType: 'INVOICE_VOIDED',
        eventKey: `invoice:${draftVoidInvoice}:voided`,
        payload: { invoiceId: draftVoidInvoice, reason: 'UAT draft void' },
      });
      // -------------------------------------- 3. quotation projection + stale revision
      const quote = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: inv1,
        eventType: 'QUOTATION_PAYMENT_EVENT',
        eventKey: 'quotation-payment:q-1',
        payload: {
          eventId: 'q-1',
          companyId: companyA,
          eventType: 'PAYMENT_POSTED',
          quotationId: randomUUID(),
          invoiceId: inv1,
          workflowRevision: 3,
        },
      });
      const staleQuote = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: inv1,
        eventType: 'QUOTATION_PAYMENT_EVENT',
        eventKey: 'quotation-payment:q-stale',
        payload: {
          eventId: 'q-stale',
          companyId: companyA,
          eventType: 'PAYMENT_POSTED',
          invoiceId: inv1,
          workflowRevision: -1,
        },
      });

      const journalsBefore = await one(
        ds,
        `SELECT count(*)::int AS n FROM finance_journal_entries`,
      );
      await worker().processPending();

      expect(await event(inv1Event.id)).toMatchObject({
        status: 'PUBLISHED',
        failure_class: null,
      });
      expect(await outcomeFor(inv1Event.id)).toMatchObject({
        consumer: 'invoice-recognition-verifier',
        idempotency_key: `invoice:${inv1}:issued`,
        source_type: 'INVOICE',
        source_id: inv1,
        source_revision: '1',
        operation: 'INVOICE_ISSUE',
        business_outcome: 'APPLIED',
        accounting_outcome: 'RECOGNIZED_BY_SOURCE_COMMAND',
        accounting_reference: inv1Journal,
        schema_version: 1,
      });
      expect(await outcomeFor(accrualEvent.id)).toMatchObject({
        accounting_outcome: 'RECOGNIZED_BY_SOURCE_COMMAND',
        accounting_reference: accrualJournal,
        source_revision: '2',
      });
      expect(await outcomeFor(inv2Void.id)).toMatchObject({
        operation: 'INVOICE_VOID',
        accounting_reference: inv2Reversal,
      });
      expect(await outcomeFor(inv2Issue.id)).toMatchObject({
        accounting_outcome: 'RECOGNIZED_BY_SOURCE_COMMAND',
      });
      expect(await outcomeFor(draftVoid.id)).toMatchObject({
        accounting_outcome: 'NOT_REQUIRED',
        accounting_reference: null,
      });
      expect(await outcomeFor(quote.id)).toMatchObject({
        business_outcome: 'APPLIED',
        accounting_outcome: 'NOT_APPLICABLE',
        source_revision: '3',
      });
      expect(await outcomeFor(staleQuote.id)).toMatchObject({
        business_outcome: 'NO_CHANGE',
      });
      // Consumers never post: journal count unchanged by processing.
      expect(
        await one(ds, `SELECT count(*)::int AS n FROM finance_journal_entries`),
      ).toEqual(journalsBefore);

      // -------------------------------------- 4. duplicate delivery (different row, same operation)
      const dup = await issuedEvent(
        companyA,
        inv1,
        '1180000.0000',
        `invoice:${inv1}:issued:redelivery`,
      );
      await worker().processPending();
      expect(await event(dup.id)).toMatchObject({ status: 'PUBLISHED' });
      expect(
        await one(
          ds,
          `SELECT result FROM finance_event_attempts WHERE outbox_event_id = $1`,
          [dup.id],
        ),
      ).toEqual({
        result: 'DUPLICATE_SUPPRESSED',
      });
      expect(
        await one(
          ds,
          `SELECT count(*)::int AS n FROM finance_event_outcomes WHERE idempotency_key = $1`,
          [`invoice:${inv1}:issued`],
        ),
      ).toEqual({ n: 1 });

      // -------------------------------------- 5. concurrent delivery of one payment event
      const copies = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          produce(companyA, {
            aggregateType: 'INVOICE',
            aggregateId: inv1,
            eventType: 'QUOTATION_PAYMENT_EVENT',
            eventKey: `quotation-payment:q-conc:copy-${i}`,
            payload: {
              eventId: 'q-conc',
              companyId: companyA,
              eventType: 'PAYMENT_POSTED',
              invoiceId: inv1,
            },
          }),
        ),
      );
      const workers = Array.from({ length: 4 }, () =>
        worker(realRegistry, { FINANCE_OUTBOX_BATCH_SIZE: 2 }),
      );
      for (let round = 0; round < 3; round += 1)
        await Promise.all(workers.map((w) => w.processPending()));
      for (const copy of copies)
        expect((await event(copy.id)).status).toBe('PUBLISHED');
      expect(
        await one(
          ds,
          `SELECT count(*)::int AS n FROM test_side_effects WHERE event_id = 'q-conc'`,
        ),
      ).toEqual({ n: 1 });
      expect(
        await one(
          ds,
          `SELECT count(*) FILTER (WHERE result = 'PUBLISHED')::int AS applied,
                  count(*) FILTER (WHERE result = 'DUPLICATE_SUPPRESSED')::int AS suppressed
             FROM finance_event_attempts WHERE outbox_event_id = ANY($1)`,
          [copies.map((c) => c.id)],
        ),
      ).toEqual({ applied: 1, suppressed: 5 });

      // -------------------------------------- 6. conflicting payloads
      await expect(
        issuedEvent(companyA, inv1, '999.0000'),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_OUTBOX_EVENT_CONFLICT' },
      });
      const inv3 = await invoice(companyA);
      await journal(companyA, 'INVOICE', inv3);
      const conflicting = await issuedEvent(companyA, inv3, '1.0000');
      await worker().processPending();
      expect(await event(conflicting.id)).toMatchObject({
        status: 'DEAD_LETTER',
        failure_class: 'OUTCOME_CONFLICT',
        attempt_count: 1,
      });
      expect(await outcomeFor(conflicting.id)).toBeUndefined();

      // -------------------------------------- 18-cross. cross-company source
      const foreignInvoice = await invoice(companyB);
      const crossCompany = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: foreignInvoice,
        eventType: 'INVOICE_ISSUED',
        eventKey: `invoice:${foreignInvoice}:issued`,
        payload: {
          invoiceId: foreignInvoice,
          amount: '1180000.0000',
          currencyCode: 'TZS',
        },
      });
      const foreignQuote = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: inv1,
        eventType: 'QUOTATION_PAYMENT_EVENT',
        eventKey: 'quotation-payment:foreign',
        payload: { eventId: 'foreign', companyId: companyB },
      });
      // -------------------------------------- 13. unsupported contract / version
      const unknown = await produce(companyA, {
        aggregateType: 'RECEIPT',
        aggregateId: randomUUID(),
        eventType: 'RECEIPT_POSTED',
        eventKey: 'receipt:unsupported',
        payload: {},
      });
      const futureVersion = await issuedEvent(
        companyA,
        inv3,
        '1180000.0000',
        `invoice:${inv3}:issued:v2`,
      );
      await sql(
        ds,
        `UPDATE finance_outbox_events SET schema_version = 2 WHERE id = $1`,
        [futureVersion.id],
      );
      await worker().processPending();
      expect(await event(crossCompany.id)).toMatchObject({
        status: 'DEAD_LETTER',
        failure_class: 'SCOPE_MISMATCH',
      });
      expect(await event(foreignQuote.id)).toMatchObject({
        status: 'DEAD_LETTER',
        failure_class: 'SCOPE_MISMATCH',
      });
      expect(await event(unknown.id)).toMatchObject({
        status: 'DEAD_LETTER',
        failure_class: 'UNSUPPORTED',
      });
      expect(await event(futureVersion.id)).toMatchObject({
        status: 'DEAD_LETTER',
        failure_class: 'UNSUPPORTED',
      });
      expect(
        await one(
          ds,
          `SELECT count(*)::int AS n FROM test_side_effects WHERE event_id = 'foreign'`,
        ),
      ).toEqual({ n: 0 });

      // -------------------------------------- 11/12. transient retry, rollback, exhaustion
      let failNext = 2;
      const flakyRegistry = new FinanceEventContractRegistry(
        {
          apply: async (e: { eventId: string }, manager: EntityManager) => {
            await manager.query(
              `INSERT INTO test_side_effects (event_id) VALUES ($1)`,
              [e.eventId],
            );
            if (failNext-- > 0) throw new Error('DOWNSTREAM_TIMEOUT');
            return { ok: true };
          },
        } as never,
        new FinancePostingPolicyService(),
      );
      const flaky = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: inv1,
        eventType: 'QUOTATION_PAYMENT_EVENT',
        eventKey: 'quotation-payment:flaky',
        payload: { eventId: 'flaky', companyId: companyA },
      });
      await worker(flakyRegistry).processPending();
      expect(await event(flaky.id)).toMatchObject({
        status: 'FAILED',
        failure_class: 'TRANSIENT',
        attempt_count: 1,
      });
      const firstRetry = await one(
        ds,
        `SELECT next_attempt_at > now() + interval '20 seconds' AS later FROM finance_outbox_events WHERE id = $1`,
        [flaky.id],
      );
      expect(firstRetry).toEqual({ later: true }); // backoff scheduled, not immediate
      await expireLeases();
      await worker(flakyRegistry).processPending();
      expect(await event(flaky.id)).toMatchObject({
        status: 'FAILED',
        attempt_count: 2,
      });
      await expireLeases();
      await worker(flakyRegistry).processPending();
      expect(await event(flaky.id)).toMatchObject({ status: 'PUBLISHED' });
      // Failed attempts rolled their side effects back.
      expect(
        await one(
          ds,
          `SELECT count(*)::int AS n FROM test_side_effects WHERE event_id = 'flaky'`,
        ),
      ).toEqual({ n: 1 });

      failNext = 99;
      const doomed = await produce(companyA, {
        aggregateType: 'INVOICE',
        aggregateId: inv1,
        eventType: 'QUOTATION_PAYMENT_EVENT',
        eventKey: 'quotation-payment:doomed',
        payload: { eventId: 'doomed', companyId: companyA },
      });
      for (let i = 0; i < 3; i += 1) {
        await worker(flakyRegistry, {
          FINANCE_OUTBOX_MAX_ATTEMPTS: 3,
        }).processPending();
        await expireLeases();
      }
      expect(await event(doomed.id)).toMatchObject({
        status: 'DEAD_LETTER',
        failure_class: 'RETRY_EXHAUSTED',
        attempt_count: 3,
      });
      // Dead letters are not reclaimed.
      await worker(flakyRegistry, {
        FINANCE_OUTBOX_MAX_ATTEMPTS: 3,
      }).processPending();
      expect((await event(doomed.id)).attempt_count).toBe(3);

      // -------------------------------------- 14. policy-blocked and missing journal
      const inv4 = await invoice(companyA);
      const blockedEvent = await issuedEvent(companyA, inv4);
      await worker(realRegistry).processPending();
      expect(await event(blockedEvent.id)).toMatchObject({
        status: 'BLOCKED',
        failure_class: 'POLICY_BLOCKED',
      });
      expect(await outcomeFor(blockedEvent.id)).toMatchObject({
        business_outcome: 'BLOCKED',
        accounting_outcome: 'POLICY_BLOCKED',
        accounting_reference: null,
      });
      const inv5 = await invoice(companyA);
      const missing = await issuedEvent(companyA, inv5);
      await worker(eligibleRegistry).processPending();
      expect(await event(missing.id)).toMatchObject({
        status: 'BLOCKED',
        failure_class: 'MISSING_JOURNAL',
      });
      // BLOCKED is not retried automatically and no journal was created.
      await expireLeases();
      await worker(eligibleRegistry).processPending();
      expect((await event(missing.id)).status).toBe('BLOCKED');
      expect(
        await one(
          ds,
          `SELECT count(*)::int AS n FROM finance_journal_entries WHERE source_id = $1`,
          [inv5],
        ),
      ).toEqual({ n: 0 });

      // -------------------------------------- 15-18. replay workflow
      const maker = randomUUID();
      const checker = randomUUID();
      // Not replayable: a successful outcome.
      await expect(
        ops.requestReplay(
          companyA,
          maker,
          inv1Event.id,
          'Retry a published event',
        ),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_EVENT_NOT_REPLAYABLE' },
      });
      // Not replayable: unsupported contract.
      await expect(
        ops.requestReplay(
          companyA,
          maker,
          unknown.id,
          'Retry unsupported contract',
        ),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_EVENT_NOT_REPLAYABLE' },
      });
      // Cross-company: invisible.
      await expect(
        ops.requestReplay(
          companyB,
          maker,
          blockedEvent.id,
          'Cross company replay',
        ),
      ).rejects.toMatchObject({
        status: 404,
      });
      await expect(ops.detail(companyB, blockedEvent.id)).rejects.toMatchObject(
        { status: 404 },
      );

      // Source journal posted after the hold is resolved; replay the blocked event.
      const inv4Journal = await journal(companyA, 'INVOICE', inv4);
      const request = await ops.requestReplay(
        companyA,
        maker,
        blockedEvent.id,
        'Posting policy activated; verify journal',
      );
      await expect(
        ops.requestReplay(
          companyA,
          maker,
          blockedEvent.id,
          'Second open request',
        ),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_EVENT_REPLAY_ALREADY_OPEN' },
      });
      // Execution before approval is refused.
      await expect(
        ops.executeReplay(companyA, checker, request.id),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_EVENT_REPLAY_STATE' },
      });
      // Self-approval refused by the service ...
      await expect(
        ops.decideReplay(companyA, maker, request.id, 'APPROVE'),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_EVENT_REPLAY_SELF_APPROVAL' },
      });
      // ... and by the database.
      await expect(
        sql(
          ds,
          `UPDATE finance_event_replay_requests SET status = 'APPROVED', decided_by = requested_by, decided_at = now() WHERE id = $1`,
          [request.id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        ops.decideReplay(companyB, checker, request.id, 'APPROVE'),
      ).rejects.toMatchObject({ status: 404 });
      await ops.decideReplay(
        companyA,
        checker,
        request.id,
        'APPROVE',
        'Journal verified',
      );
      const executed = await ops.executeReplay(companyA, checker, request.id);
      expect(executed).toMatchObject({
        status: 'EXECUTED',
        execution_result: 'REQUEUED',
      });
      expect(await event(blockedEvent.id)).toMatchObject({
        status: 'PENDING',
        attempt_count: 0,
      });
      await worker(realRegistry).processPending();
      expect(await event(blockedEvent.id)).toMatchObject({
        status: 'PUBLISHED',
        failure_class: null,
      });
      expect(await outcomeFor(blockedEvent.id)).toMatchObject({
        business_outcome: 'APPLIED',
        accounting_outcome: 'RECOGNIZED_BY_SOURCE_COMMAND',
        accounting_reference: inv4Journal,
      });
      expect(
        await ds.query(
          `SELECT trigger, result, replay_request_id FROM finance_event_attempts WHERE outbox_event_id = $1 ORDER BY id`,
          [blockedEvent.id],
        ),
      ).toEqual([
        { trigger: 'WORKER', result: 'BLOCKED', replay_request_id: null },
        {
          trigger: 'REPLAY',
          result: 'PUBLISHED',
          replay_request_id: request.id,
        },
      ]);
      // The event is now final: it cannot be replayed again.
      await expect(
        ops.requestReplay(
          companyA,
          maker,
          blockedEvent.id,
          'Replay a second time',
        ),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_EVENT_NOT_REPLAYABLE' },
      });
      // A rejected replay never re-queues.
      const rejected = await ops.requestReplay(
        companyA,
        maker,
        missing.id,
        'Investigate missing journal',
      );
      await ops.decideReplay(
        companyA,
        checker,
        rejected.id,
        'REJECT',
        'Source must be corrected first',
      );
      await expect(
        ops.executeReplay(companyA, checker, rejected.id),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_EVENT_REPLAY_STATE' },
      });
      expect((await event(missing.id)).status).toBe('BLOCKED');

      // Duplicate replay of an already-final operation: replaying the
      // conflicting dead letter after correcting the source suppresses nothing
      // it should not, and replaying the duplicate-key row cannot re-apply.
      await sql(
        ds,
        `UPDATE invoices SET total_amount = '1.0000' WHERE id = $1`,
        [inv3],
      );
      const fixConflict = await ops.requestReplay(
        companyA,
        maker,
        conflicting.id,
        'Source amount corrected',
      );
      await ops.decideReplay(companyA, checker, fixConflict.id, 'APPROVE');
      await ops.executeReplay(companyA, checker, fixConflict.id);
      await worker(realRegistry).processPending();
      expect(await event(conflicting.id)).toMatchObject({
        status: 'PUBLISHED',
      });
      // futureVersion carries the same operation key (invoice inv3 issue).
      await sql(
        ds,
        `UPDATE finance_outbox_events SET schema_version = 1 WHERE id = $1`,
        [futureVersion.id],
      );
      const dupReplay = await ops.requestReplay(
        companyA,
        maker,
        futureVersion.id,
        'Replay duplicate operation',
      );
      await ops.decideReplay(companyA, checker, dupReplay.id, 'APPROVE');
      await ops.executeReplay(companyA, checker, dupReplay.id);
      await worker(realRegistry).processPending();
      expect(
        await one(
          ds,
          `SELECT result FROM finance_event_attempts WHERE outbox_event_id = $1 ORDER BY id DESC LIMIT 1`,
          [futureVersion.id],
        ),
      ).toEqual({ result: 'DUPLICATE_SUPPRESSED' });
      expect(
        await one(
          ds,
          `SELECT count(*)::int AS n FROM finance_event_outcomes WHERE idempotency_key = $1`,
          [`invoice:${inv3}:issued`],
        ),
      ).toEqual({ n: 1 });

      // Immutable history.
      await expect(
        sql(ds, `UPDATE finance_event_attempts SET result = 'PUBLISHED'`),
      ).rejects.toThrow(/FINANCE_EVENT_HISTORY_IMMUTABLE/);
      await expect(
        sql(ds, `DELETE FROM finance_event_replay_audit`),
      ).rejects.toThrow(/FINANCE_EVENT_HISTORY_IMMUTABLE/);
      const detail = await ops.detail(companyA, blockedEvent.id);
      expect(
        detail.replays[0].audit.map((a: { action: string }) => a.action),
      ).toEqual(['REQUESTED', 'APPROVED', 'EXECUTED']);
      expect(detail.outcomes[0].accounting_reference).toBe(inv4Journal);

      // -------------------------------------- 19. monitoring totals
      await produce(companyB, {
        aggregateType: 'INVOICE',
        aggregateId: foreignInvoice,
        eventType: 'INVOICE_ISSUED',
        eventKey: `invoice:${foreignInvoice}:issued`,
        payload: { invoiceId: foreignInvoice },
      });
      const expected = await ds.query(
        `SELECT status, count(*)::int AS n FROM finance_outbox_events WHERE company_id = $1 GROUP BY status`,
        [companyA],
      );
      const summary = await ops.summary(companyA);
      for (const row of expected) {
        expect(summary.counts[row.status as keyof typeof summary.counts]).toBe(
          row.n,
        );
      }
      expect(summary.total).toBe(
        expected.reduce((s: number, r: { n: number }) => s + r.n, 0),
      );
      expect(summary.counts.BLOCKED).toBe(1);
      expect(summary.alerts.map((a) => a.level)).toEqual([
        'critical',
        'critical',
      ]);
      expect(summary.latency24h.samples).toBe(summary.counts.PUBLISHED);
      const summaryB = await ops.summary(companyB);
      expect(summaryB.total).toBe(1);
      expect(summaryB.counts.PENDING).toBe(1);

      const page1 = await ops.list(companyA, {
        status: 'DEAD_LETTER',
        pageSize: 2,
        page: 1,
      });
      const page2 = await ops.list(companyA, {
        status: 'DEAD_LETTER',
        pageSize: 2,
        page: 2,
      });
      expect(page1.total).toBe(summary.counts.DEAD_LETTER);
      expect(page1.items).toHaveLength(2);
      expect(
        new Set(
          [...page1.items, ...page2.items].map((i: { id: string }) => i.id),
        ).size,
      ).toBe(Math.min(4, summary.counts.DEAD_LETTER));
      const published = await ops.list(companyA, {
        status: 'PUBLISHED',
        eventType: 'INVOICE_ISSUED',
        pageSize: 100,
      });
      const traced = published.items.find(
        (i: { id: string }) => i.id === inv1Event.id,
      );
      expect(traced).toMatchObject({
        accounting_outcome: 'RECOGNIZED_BY_SOURCE_COMMAND',
        accounting_reference: inv1Journal,
      });
      await expect(
        ops.list(companyA, { status: 'NOT_A_STATUS' }),
      ).rejects.toMatchObject({ status: 400 });
      await producerDs.destroy();
    });
  }, 180_000);
});
