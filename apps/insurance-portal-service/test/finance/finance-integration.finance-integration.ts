import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FinanceOutboxEvent } from '../../src/modules/tenant/billing-commission/entities/finance-outbox-event.entity';
import { FinanceOutboxProcessor } from '../../src/modules/tenant/billing-commission/outbox/finance-outbox.processor';
import { FinanceLegalEntity } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-accounting-book.entity';
import { FinanceReferenceDeliveryService } from '../../src/modules/tenant/billing-commission/foundation/finance-reference-delivery.service';
import { financeConfigurationHash } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import { sourceByteHash } from '../../src/modules/tenant/billing-commission/foundation/finance-event.types';
import {
  createIntegrationFixture,
  requireLease,
} from '../support/finance-integration-fixture';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';
const configured = <T>(work: (f: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(work, process.env, 'integration-reliability');
async function counts(s: DataSource) {
  const [r] = await s.query(
    `SELECT (SELECT count(*)::integer FROM finance_integration_intakes) AS intakes,(SELECT count(*)::integer FROM finance_source_event_previews) AS previews,(SELECT count(*)::integer FROM finance_integration_inboxes) AS inboxes,(SELECT count(*)::integer FROM finance_reference_dispositions) AS dispositions,(SELECT count(*)::integer FROM finance_reference_outbox) AS outbox,(SELECT count(*)::integer FROM finance_reference_receipts) AS receipts`,
  );
  return r;
}
async function state(s: DataSource, id: string) {
  return (
    await s.query(
      'SELECT state,reason_code,attempt_count,version FROM finance_integration_intakes WHERE id=$1',
      [id],
    )
  )[0];
}
async function outboxState(s: DataSource, id: string) {
  return (
    await s.query(
      'SELECT state,reason_code,attempt_count,version FROM finance_reference_outbox WHERE id=$1',
      [id],
    )
  )[0];
}

describe('Durable inactive intake, canonical inbox and fenced reference delivery (B11)', () => {
  it('IR01 retains actual reception before processing and does not infer financial scope', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        p = f.envelope(),
        s = f.signed(p),
        r = await f.intake.capture(
          f.ingress,
          f.channel.id,
          randomUUID(),
          s.body,
          s.signature,
        );
      expect(r.state).toBe('PENDING');
      expect(await counts(dataSource)).toEqual({
        intakes: 1,
        previews: 0,
        inboxes: 0,
        dispositions: 0,
        outbox: 0,
        receipts: 0,
      });
      const [row] = await dataSource.query(
        'SELECT tenant_id,raw_body,raw_hash,channel_snapshot FROM finance_integration_intakes',
      );
      expect(row.tenant_id).toBe(f.tenantId);
      expect(row.raw_body.equals(s.body)).toBe(true);
      expect(row.raw_hash).toBe(sourceByteHash(s.body));
      expect(row.channel_snapshot.producer_subject_id).toBe(
        f.principal.subjectId,
      );
    });
  });
  it('IR02 records unassigned-channel evidence without trusting a claimed tenant or book', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      const [c] = await dataSource.query(
        "INSERT INTO finance_integration_channels(ingress_subject_id,owner_reference,version,state,valid_from) VALUES($1,'SYNTHETIC-QUARANTINE-OWNER',1,'ENABLED','2020-01-01') RETURNING id",
        [f.ingress.subjectId],
      );
      const signed = f.signed();
      const r = await f.intake.capture(
        f.ingress,
        c.id,
        randomUUID(),
        signed.body,
        signed.signature,
      );
      expect(r.state).toBe('QUARANTINED');
      expect(
        (
          await dataSource.query(
            'SELECT tenant_id FROM finance_integration_intakes WHERE id=$1',
            [r.intakeId],
          )
        )[0].tenant_id,
      ).toBeNull();
      expect(await f.intake.claim(f.worker, r.intakeId)).toBeNull();
    });
  });
  it('IR03 retains malformed and invalid-signature receipts through rejected processing', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      for (const signed of [
        { body: Buffer.from('{bad-json'), signature: 'not-a-signature' },
        { ...f.signed(), signature: 'A'.repeat(86) + '==' },
      ]) {
        const r = await f.intake.capture(
            f.ingress,
            f.channel.id,
            randomUUID(),
            signed.body,
            signed.signature,
          ),
          claim = requireLease(await f.intake.claim(f.worker, r.intakeId));
        const processed = await f.intake.process(f.worker, claim);
        expect(processed.state).toBe('HELD');
        expect(
          (
            await dataSource.query(
              'SELECT raw_body FROM finance_integration_intakes WHERE id=$1',
              [r.intakeId],
            )
          )[0].raw_body.equals(signed.body),
        ).toBe(true);
      }
      expect((await counts(dataSource)).previews).toBe(0);
      expect((await counts(dataSource)).outbox).toBe(0);
    });
  });
  it('IR04 records oversized redacted receipts with hashes and owner rather than transforming invalid input', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        raw = Buffer.alloc(262145, 120);
      const r = await f.intake.capture(
        f.ingress,
        f.channel.id,
        randomUUID(),
        raw,
        'x',
      );
      expect(r.state).toBe('HELD');
      const [record] = await dataSource.query(
        'SELECT raw_body,raw_hash,byte_length,reason_code FROM finance_integration_intakes WHERE id=$1',
        [r.intakeId],
      );
      expect(record.raw_body).toBeNull();
      expect(record.raw_hash).toBe(sourceByteHash(raw));
      expect(Number(record.byte_length)).toBe(raw.length);
      expect(record.reason_code).toBe('RAW_BODY_REDACTED_TOO_LARGE');
    });
  });
  it('IR05 coalesces exact receipt retries and durably records changed-content conflicts', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        p = f.envelope(),
        key = randomUUID();
      const first = await f.capture(p, key),
        second = await f.capture(p, key);
      expect(second.intakeId).toBe(first.intakeId);
      expect(second.reused).toBe(true);
      p.delivery_id = randomUUID();
      const conflict = await f.capture(p, key);
      expect(conflict.state).toBe('CONFLICT_CAPTURED');
      expect((await counts(dataSource)).intakes).toBe(1);
      expect(
        (
          await dataSource.query(
            'SELECT count(*)::integer AS count FROM finance_integration_conflicts',
          )
        )[0].count,
      ).toBe(1);
    });
  });
  it('IR06 commits complete fanout, canonical inbox, owned disposition and outcome together while accounting stays held', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        result = await f.process();
      expect(result.state).toBe('DISPOSITION_RECORDED');
      expect(result.financialEffects).toBe(0);
      expect(await counts(dataSource)).toEqual({
        intakes: 1,
        previews: 1,
        inboxes: 2,
        dispositions: 2,
        outbox: 2,
        receipts: 0,
      });
      expect(
        (
          await dataSource.query(
            'SELECT financial_effects,accounting_state FROM finance_reference_dispositions',
          )
        ).every(
          (r: { financial_effects: number; accounting_state: string }) =>
            r.financial_effects === 0 && r.accounting_state === 'HELD_INACTIVE',
        ),
      ).toBe(true);
      expect(
        (
          await dataSource.query(
            'SELECT count(*)::integer AS count FROM finance_journal_candidates',
          )
        )[0].count,
      ).toBe(0);
    });
  });
  it('IR07 new event/delivery aliases reuse every canonical inbox and stable outcome message', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        p = f.envelope();
      const first = await f.capture(p),
        c1 = requireLease(await f.intake.claim(f.worker, first.intakeId));
      const one = await f.intake.process(f.worker, c1);
      p.event_id = randomUUID();
      p.delivery_id = randomUUID();
      const next = await f.capture(p),
        c2 = requireLease(await f.intake.claim(f.worker, next.intakeId));
      const two = await f.intake.process(f.worker, c2);
      expect(one.state).toBe('DISPOSITION_RECORDED');
      expect(two.state).toBe('DISPOSITION_RECORDED');
      expect(await counts(dataSource)).toEqual({
        intakes: 2,
        previews: 1,
        inboxes: 2,
        dispositions: 2,
        outbox: 2,
        receipts: 0,
      });
    });
  });
  it('IR08 blocks partial fanout when one book lacks processing authority', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await dataSource.query(
        "UPDATE finance_integration_authorities SET state='REVOKED' WHERE permission='PROCESS_INBOX' AND book_id=$1",
        [f.books[1].id],
      );
      const r = await f.process();
      expect(r.state).toBe('HELD');
      expect(await counts(dataSource)).toEqual({
        intakes: 1,
        previews: 0,
        inboxes: 0,
        dispositions: 0,
        outbox: 0,
        receipts: 0,
      });
    });
  });
  it('IR09 rejects cross-tenant processing, wrong ingress identity and cross-book delivery', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        s = f.signed();
      await expect(
        f.intake.capture(
          { ...f.ingress, subjectId: randomUUID() },
          f.channel.id,
          randomUUID(),
          s.body,
          s.signature,
        ),
      ).rejects.toMatchObject({ status: 403 });
      const captured = await f.capture();
      await expect(
        f.intake.claim(
          { ...f.worker, tenantId: randomUUID() },
          captured.intakeId,
        ),
      ).rejects.toMatchObject({ status: 403 });
      const claim = requireLease(
        await f.intake.claim(f.worker, captured.intakeId),
      );
      await f.intake.process(f.worker, claim);
      const out = requireLease(await f.delivery.claim(f.worker, f.scope()));
      await expect(
        f.delivery.deliver(f.worker, f.scope(1), out),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.calls).toHaveLength(0);
    });
  });
  it('IR10 processing-audit failure rolls back local effects while the durable receipt remains retryable', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await dataSource.query(
        `CREATE FUNCTION fail_inbox_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='REFERENCE_HELD' THEN RAISE EXCEPTION 'controlled inbox audit failure';END IF;RETURN NEW;END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_inbox_audit BEFORE INSERT ON finance_integration_audits FOR EACH ROW EXECUTE FUNCTION fail_inbox_audit()',
      );
      const result = await f.process();
      expect(result.state).toBe('RETRY_WAIT');
      expect(await counts(dataSource)).toEqual({
        intakes: 1,
        previews: 0,
        inboxes: 0,
        dispositions: 0,
        outbox: 0,
        receipts: 0,
      });
      expect(
        (
          await dataSource.query(
            'SELECT raw_body FROM finance_integration_intakes',
          )
        )[0].raw_body,
      ).toBeInstanceOf(Buffer);
    });
  });
  it('IR11 failure-record audit failure leaves the committed lease and never fabricates a FAILED outcome', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        r = await f.capture(),
        claim = requireLease(await f.intake.claim(f.worker, r.intakeId));
      await dataSource.query(
        `CREATE FUNCTION fail_all_audits() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit sink unavailable';END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_all_audits BEFORE INSERT ON finance_integration_audits FOR EACH ROW EXECUTE FUNCTION fail_all_audits()',
      );
      await expect(f.intake.process(f.worker, claim)).rejects.toThrow(
        'controlled audit sink unavailable',
      );
      expect((await state(dataSource, r.intakeId)).state).toBe('LEASED');
      expect((await counts(dataSource)).inboxes).toBe(0);
    });
  });
  it('IR12 reclaims an expired intake lease and fences the stale original worker', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource, { leaseSeconds: 1 }),
        r = await f.capture(),
        old = requireLease(await f.intake.claim(f.worker, r.intakeId));
      await dataSource.query('SELECT pg_sleep(1.1)');
      const fresh = requireLease(await f.intake.claim(f.worker, r.intakeId));
      expect(fresh.token).not.toBe(old.token);
      await expect(f.intake.process(f.worker, old)).rejects.toMatchObject({
        status: 409,
      });
      expect((await f.intake.process(f.worker, fresh)).state).toBe(
        'DISPOSITION_RECORDED',
      );
      expect((await counts(dataSource)).inboxes).toBe(2);
    });
  });
  it('IR13 repeated transient processing failures reach an owned dead letter without an inbox effect', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource, { maxAttempts: 2 }),
        r = await f.capture();
      await dataSource.query(
        `CREATE FUNCTION fail_reference_creation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled processing failure';END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_reference_creation BEFORE INSERT ON finance_integration_inboxes FOR EACH ROW EXECUTE FUNCTION fail_reference_creation()',
      );
      for (const expected of ['RETRY_WAIT', 'DEAD_LETTER']) {
        const claim = requireLease(await f.intake.claim(f.worker, r.intakeId));
        expect((await f.intake.process(f.worker, claim)).state).toBe(expected);
      }
      expect(await f.intake.claim(f.worker, r.intakeId)).toBeNull();
      expect((await counts(dataSource)).outbox).toBe(0);
    });
  });
  it('IR14 requires an explicit transport registration and never acknowledges unsupported delivery', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      const unregistered = new FinanceReferenceDeliveryService(dataSource);
      const result = await unregistered.claim(f.worker, f.scope());
      expect(result).toMatchObject({ state: 'HELD_UNSUPPORTED' });
      expect(
        (
          await dataSource.query(
            'SELECT reason_code FROM finance_reference_outbox WHERE book_id=$1',
            [f.books[0].id],
          )
        )[0].reason_code,
      ).toBe('UNSUPPORTED_TRANSPORT_CONTRACT');
      expect(f.calls).toHaveLength(0);
    });
  });
  it('IR15 acknowledges only a durable exact consumer receipt while accounting stays held', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      const result = await f.deliver();
      expect(result.state).toBe('ACKNOWLEDGED');
      expect(result.financialEffects).toBe(0);
      expect((await counts(dataSource)).receipts).toBe(1);
      const r = await f.delivery.reconcile(f.worker, f.scope());
      expect(r).toMatchObject({
        inboxes: 1,
        held_dispositions: 1,
        outbox_messages: 1,
        acknowledged: 1,
        unresolved_delivery: 0,
        local_consumer_receipts: 1,
        financialEffects: 0,
      });
    });
  });
  it('IR16 lost ACK retries the same message and preserves one independently committed consumer effect', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      f.setSend(async (m) => {
        await f.accept(m);
        throw new Error('controlled lost acknowledgement');
      });
      expect((await f.deliver()).state).toBe('RETRY_WAIT');
      expect((await counts(dataSource)).receipts).toBe(1);
      f.setSend(f.accept);
      expect((await f.deliver()).state).toBe('ACKNOWLEDGED');
      expect(f.calls).toHaveLength(2);
      expect(f.calls[0].messageId).toBe(f.calls[1].messageId);
      expect((await counts(dataSource)).receipts).toBe(1);
    });
  });
  it('IR17 producer ACK-audit failure preserves the consumer receipt and retries without a second consumer effect', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      await dataSource.query(
        `CREATE FUNCTION fail_delivery_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='ACKNOWLEDGED' THEN RAISE EXCEPTION 'controlled producer ACK audit failure';END IF;RETURN NEW;END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_delivery_ack BEFORE INSERT ON finance_integration_audits FOR EACH ROW EXECUTE FUNCTION fail_delivery_ack()',
      );
      expect((await f.deliver()).state).toBe('RETRY_WAIT');
      expect((await counts(dataSource)).receipts).toBe(1);
      await dataSource.query(
        'DROP TRIGGER fail_delivery_ack ON finance_integration_audits',
      );
      expect((await f.deliver()).state).toBe('ACKNOWLEDGED');
      expect((await counts(dataSource)).receipts).toBe(1);
    });
  });
  it('IR18 rejects void and mismatched ACKs and reaches an owned delivery dead letter', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource, { maxAttempts: 2 });
      await f.process();
      f.setSend(async () => undefined as never);
      expect((await f.deliver()).state).toBe('RETRY_WAIT');
      f.setSend(async (m) => ({
        messageId: m.messageId,
        payloadHash: 'a'.repeat(64),
        consumerId: 'SYNTHETIC_REFERENCE_CONSUMER',
        receiptId: randomUUID(),
      }));
      expect((await f.deliver()).state).toBe('DEAD_LETTER');
      expect(await f.delivery.claim(f.worker, f.scope())).toBeNull();
      expect((await counts(dataSource)).receipts).toBe(0);
    });
  });
  it('IR19 expiry during external delivery fences stale acknowledgement and reclaim uses the same message ID', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource, { leaseSeconds: 1 });
      await f.process();
      const old = requireLease(await f.delivery.claim(f.worker, f.scope()));
      f.setSend(async (m) => {
        const receipt = await f.accept(m);
        await dataSource.query('SELECT pg_sleep(1.1)');
        return receipt;
      });
      await expect(
        f.delivery.deliver(f.worker, f.scope(), old),
      ).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).receipts).toBe(1);
      const fresh = requireLease(await f.delivery.claim(f.worker, f.scope()));
      await expect(
        f.delivery.deliver(f.worker, f.scope(), old),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.calls).toHaveLength(1);
      f.setSend(f.accept);
      expect((await f.delivery.deliver(f.worker, f.scope(), fresh)).state).toBe(
        'ACKNOWLEDGED',
      );
      expect(f.calls[0].messageId).toBe(f.calls[1].messageId);
      expect((await counts(dataSource)).receipts).toBe(1);
    });
  });
  it('IR20 durable dispatch intent blocks repeat sends with the same live lease', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      const claim = requireLease(await f.delivery.claim(f.worker, f.scope()));
      let release!: () => void;
      const barrier = new Promise<void>((r) => {
        release = r;
      });
      let entered!: () => void;
      const called = new Promise<void>((r) => {
        entered = r;
      });
      f.setSend(async (m) => {
        entered();
        await barrier;
        return f.accept(m);
      });
      const first = f.delivery.deliver(f.worker, f.scope(), claim);
      try {
        await called;
        await expect(
          f.delivery.deliver(f.worker, f.scope(), claim),
        ).rejects.toMatchObject({ status: 409 });
        expect(f.calls).toHaveLength(1);
      } finally {
        release();
      }
      expect((await first).state).toBe('ACKNOWLEDGED');
    });
  });
  it('IR21 consumer identity/hash conflicts cannot create another receipt or cross-book effect', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      await f.deliver();
      const [row] = await dataSource.query(
        'SELECT * FROM finance_reference_receipts',
      );
      const changed = { ...row.payload, semanticHash: 'b'.repeat(64) };
      await expect(
        f.receiver.receiveInactive(
          f.worker,
          f.scope(),
          'SYNTHETIC_REFERENCE_CONSUMER',
          row.message_id,
          financeConfigurationHash(changed),
          changed,
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        f.receiver.receiveInactive(
          f.worker,
          f.scope(),
          'OTHER_CONSUMER',
          row.message_id,
          row.payload_hash,
          row.payload,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.receiver.receiveInactive(
          f.worker,
          f.scope(1),
          'SYNTHETIC_REFERENCE_CONSUMER',
          row.message_id,
          row.payload_hash,
          row.payload,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).receipts).toBe(1);
    });
  });
  it('IR22 readonly reconciliation has no hidden writes and denies missing exact scope authority', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      const before = await counts(dataSource);
      await f.delivery.reconcile(f.worker, f.scope());
      expect(await counts(dataSource)).toEqual(before);
      await dataSource.query(
        "UPDATE finance_integration_authorities SET state='REVOKED' WHERE permission='READ_RECONCILIATION' AND book_id=$1",
        [f.books[0].id],
      );
      await expect(
        f.delivery.reconcile(f.worker, f.scope()),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.delivery.reconcile(
          { ...f.worker, tenantId: randomUUID() },
          f.scope(),
        ),
      ).rejects.toMatchObject({ status: 403 });
    });
  });
  it('IR23 raw history edits and unaudited checkpoints are denied at the commit boundary', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      for (const sql of [
        "UPDATE finance_integration_intakes SET raw_hash=repeat('a',64),version=version+1",
        'DELETE FROM finance_reference_dispositions',
        'TRUNCATE finance_integration_audits',
        "UPDATE finance_reference_outbox SET payload='{}'::jsonb,version=version+1",
      ])
        await expect(dataSource.query(sql)).rejects.toThrow();
      await expect(
        dataSource.query(
          "UPDATE finance_reference_outbox SET state='HELD_UNSUPPORTED',version=version+1 WHERE book_id=$1",
          [f.books[0].id],
        ),
      ).rejects.toThrow('atomic version audit');
      expect((await counts(dataSource)).outbox).toBe(2);
    });
  });
  it('IR24 concurrent source processors retain one complete canonical outcome per book', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        r = await f.capture(),
        claim = requireLease(await f.intake.claim(f.worker, r.intakeId)),
        blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      let jobs: Promise<unknown>[] = [];
      try {
        await blocker.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['finance-inactive-config:' + f.tenantId],
        );
        jobs = [
          f.intake.process(f.worker, claim),
          f.intake.process(f.worker, claim),
        ];
        const done = Promise.allSettled(jobs);
        const end = Date.now() + 10000;
        let count = 0;
        while (Date.now() < end) {
          const [v] = await dataSource.query(
            "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",
          );
          count = v.count;
          if (count >= 2) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(count).toBeGreaterThanOrEqual(2);
        await blocker.commitTransaction();
        const results = await done;
        expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await Promise.allSettled(jobs);
        await blocker.release();
      }
      expect((await counts(dataSource)).inboxes).toBe(2);
      expect((await counts(dataSource)).outbox).toBe(2);
    });
  });
  it('IR25 key revocation after capture leaves an owned held receipt without inventing source acceptance', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource),
        r = await f.capture();
      await dataSource.query(
        "UPDATE finance_event_producer_keys SET state='REVOKED' WHERE id=$1",
        [f.keyId],
      );
      const c = requireLease(await f.intake.claim(f.worker, r.intakeId));
      expect((await f.intake.process(f.worker, c)).state).toBe('HELD');
      expect((await counts(dataSource)).previews).toBe(0);
      expect((await state(dataSource, r.intakeId)).reason_code).toBe(
        'AUTHORITY_OR_SIGNATURE_REJECTED',
      );
    });
  });
  it('IR26 missing capture audit never returns a persisted receipt acknowledgement', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await dataSource.query(
        `CREATE FUNCTION fail_capture_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='CAPTURED' THEN RAISE EXCEPTION 'controlled reception audit failure';END IF;RETURN NEW;END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_capture_audit BEFORE INSERT ON finance_integration_audits FOR EACH ROW EXECUTE FUNCTION fail_capture_audit()',
      );
      await expect(f.capture()).rejects.toThrow(
        'controlled reception audit failure',
      );
      expect((await counts(dataSource)).intakes).toBe(0);
    });
  });
  it('IR27 creates empty registries and protects rollback without seeding integration authorities', async () => {
    await configured(async ({ dataSource }) => {
      expect(
        (
          await dataSource.query(
            'SELECT count(*)::integer AS count FROM finance_integration_authorities',
          )
        )[0].count,
      ).toBe(0);
      await dataSource.undoLastMigration({ transaction: 'all' });
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_integration_intakes') AS name",
          )
        )[0].name,
      ).toBeNull();
      await dataSource.runMigrations({ transaction: 'all' });
      await createIntegrationFixture(dataSource);
      await dataSource.undoLastMigration({ transaction: 'all' });
      await expect(
        dataSource.undoLastMigration({ transaction: 'all' }),
      ).rejects.toThrow('requires empty');
    });
  });
  it('IR29 retries one destination independently without repeating the other book outcome', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      f.setSend(async (message) => {
        if (message.payload.bookId === f.books[1].id)
          throw new Error('controlled second-destination failure');
        return f.accept(message);
      });
      expect((await f.deliver(0)).state).toBe('ACKNOWLEDGED');
      expect((await f.deliver(1)).state).toBe('RETRY_WAIT');
      f.setSend(f.accept);
      expect((await f.deliver(1)).state).toBe('ACKNOWLEDGED');
      expect(f.calls).toHaveLength(3);
      expect(
        f.calls.filter((c) => c.messageId === f.calls[0].messageId),
      ).toHaveLength(1);
      expect((await counts(dataSource)).receipts).toBe(2);
      expect((await counts(dataSource)).outbox).toBe(2);
    });
  });
  it('IR30 a consumer commit in another owned database survives lost producer ACK and deduplicates retry', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createIntegrationFixture(dataSource);
      await f.process();
      await configured(async ({ dataSource: remote }) => {
        await remote.getRepository(FinanceLegalEntity).save({
          id: f.entity.id,
          tenant_id: f.tenantId,
          entity_code: 'SYNTHETIC-REMOTE',
          legal_name: 'Independent synthetic consumer',
          business_profile: 'GENERAL_INSURER',
        });
        await remote.getRepository(FinanceAccountingBook).save(
          f.books.map((b) => ({
            id: b.id,
            tenant_id: f.tenantId,
            legal_entity_id: f.entity.id,
            book_code: b.book_code,
          })),
        );
        for (const b of f.books)
          await remote.query(
            "INSERT INTO finance_integration_authorities(tenant_id,legal_entity_id,book_id,subject_id,permission,consumer_id,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,'RECEIVE_OUTCOME','SYNTHETIC_REFERENCE_CONSUMER','ENABLED','SYNTHETIC-REMOTE-ONLY','2020-01-01')",
            [f.tenantId, f.entity.id, b.id, f.worker.subjectId],
          );
        const consumer = new FinanceReferenceDeliveryService(remote);
        let loseAck = true;
        f.setSend(async (message) => {
          const ack = await consumer.receiveInactive(
            f.worker,
            {
              legalEntityId: message.payload.legalEntityId,
              bookId: message.payload.bookId,
            },
            'SYNTHETIC_REFERENCE_CONSUMER',
            message.messageId,
            message.payloadHash,
            message.payload,
          );
          if (loseAck) {
            loseAck = false;
            throw new Error('controlled cross-database lost ACK');
          }
          return ack;
        });
        expect((await f.deliver()).state).toBe('RETRY_WAIT');
        expect((await counts(remote)).receipts).toBe(1);
        expect((await counts(dataSource)).receipts).toBe(0);
        expect((await f.deliver()).state).toBe('ACKNOWLEDGED');
        expect((await counts(remote)).receipts).toBe(1);
        expect(f.calls[0].messageId).toBe(f.calls[1].messageId);
        expect((await counts(remote)).inboxes).toBe(0);
      });
    });
  });
});

describe('Existing outbox compatibility on owned PostgreSQL (B11)', () => {
  it.each(['UNKNOWN_LEGACY_CONTRACT', 'QUOTATION_PAYMENT_EVENT'])(
    'IR28 preserves the supported projection and never marks unsupported transport as published (%s)',
    async (eventType) => {
      await configured(async ({ dataSource }) => {
        const metadata = new DataSource({
          ...dataSource.options,
          entities: [FinanceOutboxEvent],
          migrations: [],
          migrationsRun: false,
          synchronize: false,
        });
        try {
          await metadata.initialize();
          await metadata.synchronize();
          const row = await metadata.getRepository(FinanceOutboxEvent).save({
            company_id: randomUUID(),
            aggregate_type: 'SYNTHETIC',
            aggregate_id: randomUUID(),
            event_type: eventType,
            event_key: 'synthetic-key',
            payload: { eventId: 'synthetic-quote-event' },
          });
          const projection = { apply: jest.fn().mockResolvedValue(undefined) },
            config = {
              get: jest
                .fn()
                .mockImplementation((_k: string, def: unknown) => def),
            };
          const processor = new FinanceOutboxProcessor(
            metadata,
            config as unknown as ConfigService,
            projection as never,
          );
          await processor.processPending();
          const saved = await metadata
            .getRepository(FinanceOutboxEvent)
            .findOneByOrFail({ id: row.id });
          expect(saved.status).toBe(
            eventType === 'QUOTATION_PAYMENT_EVENT'
              ? 'PUBLISHED'
              : 'DEAD_LETTER',
          );
          expect(projection.apply).toHaveBeenCalledTimes(
            eventType === 'QUOTATION_PAYMENT_EVENT' ? 1 : 0,
          );
          if (eventType !== 'QUOTATION_PAYMENT_EVENT') {
            expect(saved.last_error).toBe(
              'UNSUPPORTED_FINANCE_OUTBOX_CONTRACT',
            );
            expect(saved.published_at).toBeNull();
          }
        } finally {
          if (metadata.isInitialized) await metadata.destroy();
        }
      });
    },
  );
});
