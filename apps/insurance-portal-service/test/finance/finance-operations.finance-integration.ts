import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createOperationsFixture } from '../support/finance-operations-fixture';
import { requireLease } from '../support/finance-integration-fixture';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';
const configured = <T>(run: (db: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(run, process.env, 'integration-reliability');
async function row(s: DataSource, table: string, id: string) {
  return (await s.query(`SELECT * FROM ${table} WHERE id=$1`, [id]))[0];
}
describe('Owned reference exceptions, controlled replay and redacted telemetry (B12)', () => {
  it('OP01 installs empty controls and supports empty rollback without enabling authority', async () => {
    await configured(async ({ dataSource: s }) => {
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_operations_authorities',
          )
        )[0].n,
      ).toBe(0);
      await s.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await s.query(
            "SELECT to_regclass('finance_owned_exceptions') AS name",
          )
        )[0].name,
      ).toBeNull();
      await s.runMigrations({ transaction: 'all' });
      await createOperationsFixture(s);
      await expect(s.undoLastMigration({ transaction: 'all' })).rejects.toThrow(
        'requires empty',
      );
    });
  });
  it('OP02 reads unregistered failures without creating owners or changing history', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        item = await f.deadOutbox(),
        before = await row(s, 'finance_reference_outbox', item.id);
      const view = await f.ops.telemetry(f.maker, f.bookScope());
      expect(view.counts).toMatchObject({ unregisteredFailures: 1, cases: 0 });
      expect(view).toMatchObject({
        slaStatus: 'PENDING_APPROVAL',
        financialRecoveryCertified: false,
        accountingState: 'HELD_INACTIVE',
      });
      expect(await row(s, 'finance_reference_outbox', item.id)).toEqual(before);
      expect(JSON.stringify(view)).not.toMatch(
        /snapshot_hash|signature_input|raw_body|payload_hash/,
      );
    });
  });
  it('OP03 assigns an exact human owner and keeps unset due dates null', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        item = await f.deadOutbox(),
        ref = await f.register(item.id);
      expect((await f.ops.list(f.maker, f.bookScope())).counts.unassigned).toBe(
        1,
      );
      const assigned = await f.ops.assign(
        f.maker,
        f.bookScope(),
        ref,
        f.maker,
        'assign owner',
      );
      expect(assigned.version).toBe(ref.version + 1);
      const c = await row(s, 'finance_owned_exceptions', ref.id);
      expect(c.proposed_due_at).toBeNull();
      expect(c.owner_subject_id).toBe(f.maker.subjectId);
      expect((await f.ops.list(f.maker, f.bookScope())).counts.unassigned).toBe(
        0,
      );
      await expect(
        f.ops.assign(
          f.maker,
          f.bookScope(),
          ref,
          f.checker,
          'stale assignment',
        ),
      ).rejects.toThrow('stale');
    });
  });
  it('OP04 denies workers, other tenants, book leakage and unassigned quarantine', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        item = await f.deadOutbox();
      await expect(
        f.ops.register(
          f.maker,
          f.bookScope(1),
          item.id,
          f.profileRef,
          'wrong book',
        ),
      ).rejects.toThrow('unavailable');
      await expect(
        f.ops.telemetry(f.worker as never, f.bookScope()),
      ).rejects.toThrow('human');
      await expect(
        f.ops.telemetry({ ...f.maker, tenantId: randomUUID() }, f.bookScope()),
      ).rejects.toThrow();
      const [ch] = await s.query(
        "INSERT INTO finance_integration_channels(ingress_subject_id,owner_reference,version,state,valid_from) VALUES($1,'UNSCOPED-CHANNEL',1,'ENABLED','2020-01-01') RETURNING *",
        [f.ingress.subjectId],
      );
      const intake = await f.intake.capture(
        f.ingress,
        ch.id,
        randomUUID(),
        Buffer.from('{}'),
        'x',
      );
      await expect(
        f.ops.register(
          f.maker,
          f.sourceScope,
          intake.intakeId,
          f.profileRef,
          'assign quarantine',
        ),
      ).rejects.toThrow('unavailable');
      expect(
        (await f.ops.telemetry(f.maker, f.sourceScope)).items,
      ).toHaveLength(1);
    });
  });
  it('OP05 denies unassigned or stale owners and reports stale ownership without writes', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        item = await f.deadOutbox(),
        ref = await f.register(item.id);
      await expect(
        f.ops.prepareReplay(
          f.maker,
          f.bookScope(),
          ref,
          f.evidence(),
          'no owner',
        ),
      ).rejects.toThrow('assigned');
      const assigned = await f.ops.assign(
        f.maker,
        f.bookScope(),
        ref,
        f.maker,
        'assign',
      );
      await s.query(
        "UPDATE finance_operations_authorities SET state='REVOKED' WHERE tenant_id=$1 AND subject_id=$2 AND permission='OWN_EXCEPTION'",
        [f.tenantId, f.maker.subjectId],
      );
      expect(
        (await f.ops.telemetry(f.checker, f.bookScope())).counts.staleOwners,
      ).toBe(1);
      await expect(
        f.ops.prepareReplay(
          f.maker,
          f.bookScope(),
          assigned,
          f.evidence(),
          'revoked owner',
        ),
      ).rejects.toThrow('authority');
      const escalated = await f.ops.escalate(
        f.checker,
        f.bookScope(),
        assigned,
        'stale owner escalation',
      );
      expect(
        (await row(s, 'finance_owned_exceptions', escalated.id)).state,
      ).toBe('ESCALATED');
    });
  });
  it('OP06 requires independent people, including aliases, for replay approval', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { ref } = await f.owned(),
        replay = await f.ops.prepareReplay(
          f.maker,
          f.bookScope(),
          ref,
          f.evidence(),
          'prepare',
        );
      await expect(
        f.ops.reviewReplay(
          f.maker,
          f.bookScope(),
          replay,
          'APPROVED',
          'self review',
        ),
      ).rejects.toThrow('independent');
      const alias = { ...f.maker, subjectId: randomUUID() };
      await f.opsGrant(alias, 'REVIEW_REPLAY');
      await expect(
        f.ops.reviewReplay(
          alias,
          f.bookScope(),
          replay,
          'APPROVED',
          'alias review',
        ),
      ).rejects.toThrow('independent');
      await f.ops.reviewReplay(
        f.checker,
        f.bookScope(),
        replay,
        'REJECTED',
        'reject',
      );
      await expect(
        f.ops.executeReplay(
          f.checker,
          f.bookScope(),
          replay,
          'rejected replay',
        ),
      ).rejects.toThrow('approved');
    });
  });
  it('OP07 replays the original outbox with a bounded extra attempt and one consumer effect', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { item, replay } = await f.approved();
      const result = await f.ops.executeReplay(
        f.checker,
        f.bookScope(),
        replay,
        'execute approved reference replay',
      );
      expect(result.reused).toBe(false);
      const queued = await row(s, 'finance_reference_outbox', item.id);
      expect(queued).toMatchObject({
        id: item.id,
        payload: item.payload,
        payload_hash: item.payload_hash,
        attempt_count: 1,
        state: 'RETRY_WAIT',
      });
      const again = await f.ops.executeReplay(
        f.checker,
        f.bookScope(),
        replay,
        'exact retry',
      );
      expect(again).toMatchObject({
        executionId: result.executionId,
        reused: true,
      });
      f.setSend(f.accept);
      const delivered = await f.deliver();
      expect(delivered.state).toBe('ACKNOWLEDGED');
      expect(
        (await row(s, 'finance_reference_outbox', item.id)).attempt_count,
      ).toBe(2);
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_reference_receipts WHERE message_id=$1',
            [item.id],
          )
        )[0].n,
      ).toBe(1);
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_replay_executions',
          )
        )[0].n,
      ).toBe(1);
    });
  });
  it('OP08 retains a consumer receipt across lost acknowledgement and controlled replay', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s);
      await f.process();
      f.setSend(async (m) => {
        await f.accept(m);
        throw new Error('lost acknowledgement');
      });
      await f.deliver();
      const [item] = await s.query(
        'SELECT * FROM finance_reference_outbox WHERE tenant_id=$1 AND book_id=$2',
        [f.tenantId, f.books[0].id],
      );
      const c = await f.register(item.id),
        ref = await f.ops.assign(f.maker, f.bookScope(), c, f.maker, 'assign');
      const replay = await f.ops.prepareReplay(
        f.maker,
        f.bookScope(),
        ref,
        f.evidence(),
        'lost acknowledgement evidence',
      );
      await f.ops.reviewReplay(
        f.checker,
        f.bookScope(),
        replay,
        'APPROVED',
        'review',
      );
      await f.ops.executeReplay(f.checker, f.bookScope(), replay, 'replay');
      f.setSend(f.accept);
      expect((await f.deliver()).state).toBe('ACKNOWLEDGED');
      expect(f.calls[0]).toEqual(f.calls[1]);
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_reference_receipts WHERE message_id=$1',
            [item.id],
          )
        )[0].n,
      ).toBe(1);
    });
  });
  it('OP09 stops at the approved extra-attempt ceiling and preserves all attempts', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s, { maxReplaysPerItem: 1 }),
        { item, ref, replay } = await f.approved();
      await f.ops.executeReplay(f.checker, f.bookScope(), replay, 'execute');
      expect((await f.deliver()).state).toBe('DEAD_LETTER');
      expect(
        (await row(s, 'finance_reference_outbox', item.id)).attempt_count,
      ).toBe(2);
      let current = await row(s, 'finance_owned_exceptions', ref.id);
      const refreshed = await f.ops.refresh(
        f.maker,
        f.bookScope(),
        { id: current.id, version: current.version, hash: current.case_hash },
        'observe failure',
      );
      await expect(
        f.ops.prepareReplay(
          f.maker,
          f.bookScope(),
          refreshed,
          f.evidence(),
          'exhausted',
        ),
      ).rejects.toThrow('limit');
    });
  });
  it('OP10 invalidates approvals on owner reassignment', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { ref, replay, item } = await f.approved();
      await f.ops.assign(
        f.checker,
        f.bookScope(),
        ref,
        f.checker,
        'handover ownership',
      );
      await expect(
        f.ops.executeReplay(
          f.checker,
          f.bookScope(),
          replay,
          'stale ownership',
        ),
      ).rejects.toThrow('stale');
      expect((await row(s, 'finance_reference_outbox', item.id)).state).toBe(
        'DEAD_LETTER',
      );
    });
  });
  it('OP11 invalidates replay when maker or reviewer authority changes', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { replay, item } = await f.approved();
      await s.query(
        "UPDATE finance_operations_authorities SET authority_reference='CHANGED' WHERE tenant_id=$1 AND subject_id=$2 AND permission='PREPARE_REPLAY'",
        [f.tenantId, f.maker.subjectId],
      );
      await expect(
        f.ops.executeReplay(f.checker, f.bookScope(), replay, 'changed maker'),
      ).rejects.toThrow('changed');
      expect((await row(s, 'finance_reference_outbox', item.id)).state).toBe(
        'DEAD_LETTER',
      );
      await s.query(
        "UPDATE finance_operations_authorities SET state='REVOKED' WHERE tenant_id=$1 AND subject_id=$2 AND permission='REVIEW_REPLAY'",
        [f.tenantId, f.checker.subjectId],
      );
      await expect(
        f.ops.executeReplay(
          f.checker,
          f.bookScope(),
          replay,
          'revoked reviewer',
        ),
      ).rejects.toThrow('authority');
    });
  });
  it('OP12 requires the recorded reviewer and explicit execution authority', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { replay } = await f.approved();
      await expect(
        f.ops.executeReplay(f.maker, f.bookScope(), replay, 'maker execute'),
      ).rejects.toThrow('recorded');
      await s.query(
        "UPDATE finance_operations_authorities SET state='REVOKED' WHERE tenant_id=$1 AND subject_id=$2 AND permission='EXECUTE_REPLAY'",
        [f.tenantId, f.checker.subjectId],
      );
      await expect(
        f.ops.executeReplay(
          f.checker,
          f.bookScope(),
          replay,
          'no execution grant',
        ),
      ).rejects.toThrow('authority');
    });
  });
  it('OP13 expires approval before execution without reopening the item', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s, { replayTtlSeconds: 1 }),
        { item, replay } = await f.approved();
      await s.query('SELECT pg_sleep(1.1)');
      await expect(
        f.ops.executeReplay(
          f.checker,
          f.bookScope(),
          replay,
          'expired request',
        ),
      ).rejects.toThrow('expired');
      expect((await row(s, 'finance_reference_outbox', item.id)).state).toBe(
        'DEAD_LETTER',
      );
    });
  });
  it('OP14 rolls back target, case and approval when replay audit fails', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { ref, item, replay } = await f.approved();
      await s.query(
        "CREATE FUNCTION fail_ops_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='REPLAY_EXECUTED' THEN RAISE EXCEPTION 'synthetic operations audit failure';END IF;RETURN NEW;END $$",
      );
      await s.query(
        'CREATE TRIGGER fail_ops_audit BEFORE INSERT ON finance_operations_audits FOR EACH ROW EXECUTE FUNCTION fail_ops_audit()',
      );
      await expect(
        f.ops.executeReplay(f.checker, f.bookScope(), replay, 'audit failure'),
      ).rejects.toThrow('audit failure');
      expect((await row(s, 'finance_reference_outbox', item.id)).state).toBe(
        'DEAD_LETTER',
      );
      expect((await row(s, 'finance_owned_exceptions', ref.id)).version).toBe(
        ref.version,
      );
      expect((await row(s, 'finance_replay_requests', replay.id)).state).toBe(
        'APPROVED',
      );
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_replay_executions',
          )
        )[0].n,
      ).toBe(0);
    });
  });
  it('OP15 refuses raw terminal reopening, evidence mutation and unaudited case changes', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { ref, item, replay } = await f.approved();
      await expect(
        s.query(
          "UPDATE finance_reference_outbox SET state='RETRY_WAIT',version=version+1,reason_code='CONTROLLED_REFERENCE_REPLAY' WHERE id=$1",
          [item.id],
        ),
      ).rejects.toThrow('controlled replay');
      await expect(
        s.query(
          'UPDATE finance_owned_exceptions SET version=version+1 WHERE id=$1',
          [ref.id],
        ),
      ).rejects.toThrow('atomic audit');
      await expect(
        s.query("UPDATE finance_replay_requests SET subject='{}' WHERE id=$1", [
          replay.id,
        ]),
      ).rejects.toThrow('immutable');
      await expect(
        s.query('TRUNCATE finance_operations_audits'),
      ).rejects.toThrow('immutable');
    });
  });
  it('OP16 serializes concurrent execution into one replay', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { replay } = await f.approved();
      const results = await Promise.all([
        f.ops.executeReplay(f.checker, f.bookScope(), replay, 'execute a'),
        f.ops.executeReplay(f.checker, f.bookScope(), replay, 'execute b'),
      ]);
      expect(results.map((r) => r.executionId)).toEqual([
        results[0].executionId,
        results[0].executionId,
      ]);
      expect(results.filter((r) => r.reused)).toHaveLength(1);
    });
  });
  it('OP17 verifies only positive operational handoff, independently, with accounting still held', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { ref, item, replay } = await f.approved();
      await f.ops.executeReplay(f.checker, f.bookScope(), replay, 'execute');
      const c = await row(s, 'finance_owned_exceptions', ref.id),
        current = { id: c.id, version: c.version, hash: c.case_hash };
      await expect(
        f.ops.verifyHandoff(
          f.checker,
          f.bookScope(),
          current,
          f.evidence(),
          'premature',
        ),
      ).rejects.toThrow('positive');
      f.setSend(f.accept);
      await f.deliver();
      await expect(
        f.ops.verifyHandoff(
          f.maker,
          f.bookScope(),
          current,
          f.evidence(),
          'self verification',
        ),
      ).rejects.toThrow('independent');
      const result = await f.ops.verifyHandoff(
        f.checker,
        f.bookScope(),
        current,
        f.evidence(),
        'verify durable consumer acknowledgement',
      );
      expect(result).toMatchObject({
        state: 'CLOSED_OPERATIONAL',
        financialRecoveryCertified: false,
        accountingState: 'HELD_INACTIVE',
      });
      await expect(
        f.ops.refresh(
          f.checker,
          f.bookScope(),
          { id: result.id, version: result.version, hash: result.hash },
          'closed edit',
        ),
      ).rejects.toThrow('immutable');
      expect((await row(s, 'finance_reference_outbox', item.id)).state).toBe(
        'ACKNOWLEDGED',
      );
    });
  });
  it('OP18 replays a failed intake using the same signed bytes and records every inactive destination', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s);
      await s.query(
        "CREATE FUNCTION fail_intake_reference() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic temporary fault';END $$",
      );
      await s.query(
        'CREATE TRIGGER fail_intake_reference BEFORE INSERT ON finance_integration_inboxes FOR EACH ROW EXECUTE FUNCTION fail_intake_reference()',
      );
      const captured = await f.capture(),
        lease = requireLease(await f.intake.claim(f.worker, captured.intakeId));
      expect((await f.intake.process(f.worker, lease)).state).toBe(
        'DEAD_LETTER',
      );
      const before = await row(
        s,
        'finance_integration_intakes',
        captured.intakeId,
      );
      await s.query(
        'DROP TRIGGER fail_intake_reference ON finance_integration_inboxes',
      );
      const c = await f.register(captured.intakeId, f.sourceScope),
        ref = await f.ops.assign(
          f.maker,
          f.sourceScope,
          c,
          f.maker,
          'source owner',
        ),
        replay = await f.ops.prepareReplay(
          f.maker,
          f.sourceScope,
          ref,
          f.evidence(),
          'temporary fault remedied',
        );
      await f.ops.reviewReplay(
        f.checker,
        f.sourceScope,
        replay,
        'APPROVED',
        'review source replay',
      );
      await f.ops.executeReplay(
        f.checker,
        f.sourceScope,
        replay,
        'execute source replay',
      );
      const again = requireLease(
        await f.intake.claim(f.worker, captured.intakeId),
      );
      expect((await f.intake.process(f.worker, again)).state).toBe(
        'DISPOSITION_RECORDED',
      );
      const after = await row(
        s,
        'finance_integration_intakes',
        captured.intakeId,
      );
      expect(after.raw_body).toEqual(before.raw_body);
      expect(after.signature_input).toBe(before.signature_input);
      expect(after.attempt_count).toBe(2);
      const current = await row(s, 'finance_owned_exceptions', ref.id);
      expect(
        await f.ops.verifyHandoff(
          f.checker,
          f.sourceScope,
          { id: current.id, version: current.version, hash: current.case_hash },
          f.evidence(),
          'verify complete reference handoff',
        ),
      ).toMatchObject({ financialRecoveryCertified: false });
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_reference_dispositions',
          )
        )[0].n,
      ).toBe(2);
    });
  });
  it('OP19 blocks replay after a captured channel binding changes', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        signed = f.signed(f.envelope()),
        captured = await f.intake.capture(
          f.ingress,
          f.channel.id,
          randomUUID(),
          signed.body,
          'x',
        );
      const lease = requireLease(
        await f.intake.claim(f.worker, captured.intakeId),
      );
      expect((await f.intake.process(f.worker, lease)).state).toBe('HELD');
      const c = await f.register(captured.intakeId, f.sourceScope),
        ref = await f.ops.assign(
          f.maker,
          f.sourceScope,
          c,
          f.maker,
          'assign source',
        );
      await s.query(
        'UPDATE finance_integration_channels SET version=version+1 WHERE id=$1',
        [f.channel.id],
      );
      await expect(
        f.ops.prepareReplay(
          f.maker,
          f.sourceScope,
          ref,
          f.evidence(),
          'changed channel',
        ),
      ).rejects.toThrow('channel');
    });
  });
  it('OP20 leaves a current owner un-escalated when no proposed window exists', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { ref } = await f.owned();
      await expect(
        f.ops.escalate(f.checker, f.bookScope(), ref, 'no elapsed window'),
      ).rejects.toThrow('no stale');
      expect(
        (await f.ops.telemetry(f.checker, f.bookScope())).cases[0]
          .proposed_overdue,
      ).toBeNull();
    });
  });
  it('OP21 rolls back replay when execution authority expires during the atomic audit', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { item, replay } = await f.approved();
      await s.query(
        "UPDATE finance_operations_authorities SET valid_to=statement_timestamp()+interval '1 second' WHERE tenant_id=$1 AND subject_id=$2 AND permission='EXECUTE_REPLAY'",
        [f.tenantId, f.checker.subjectId],
      );
      await s.query(
        "CREATE FUNCTION delay_ops_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='REPLAY_EXECUTED' THEN PERFORM pg_sleep(1.2);END IF;RETURN NEW;END $$",
      );
      await s.query(
        'CREATE TRIGGER delay_ops_commit BEFORE INSERT ON finance_operations_audits FOR EACH ROW EXECUTE FUNCTION delay_ops_commit()',
      );
      await expect(
        f.ops.executeReplay(
          f.checker,
          f.bookScope(),
          replay,
          'expiry during audit',
        ),
      ).rejects.toThrow(/expired|authorit/);
      expect((await row(s, 'finance_reference_outbox', item.id)).state).toBe(
        'DEAD_LETTER',
      );
      expect((await row(s, 'finance_replay_requests', replay.id)).state).toBe(
        'APPROVED',
      );
    });
  });
  it('OP22 records a proposed due window explicitly without calling it an approved SLA', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s, {
          proposedOwnerDueSeconds: 1,
          proposedEscalationSeconds: 1,
        }),
        { ref } = await f.owned();
      await s.query('SELECT pg_sleep(1.1)');
      const view = await f.ops.telemetry(f.checker, f.bookScope());
      expect(view.counts.proposedOverdue).toBe(1);
      expect(view.slaStatus).toBe('PENDING_APPROVAL');
      await f.ops.escalate(
        f.checker,
        f.bookScope(),
        ref,
        'elapsed proposed window',
      );
      expect((await row(s, 'finance_owned_exceptions', ref.id)).state).toBe(
        'ESCALATED',
      );
    });
  });
  it('OP23 rejects a claimed execution without its atomic execution record even when matching audits are supplied', async () => {
    await configured(async ({ dataSource: s }) => {
      const f = await createOperationsFixture(s),
        { ref, item, replay } = await f.approved();
      await expect(
        s.transaction(async (m) => {
          await m.query(
            "UPDATE finance_owned_exceptions SET state='MONITORING_REPLAY',version=version+1,case_hash=$2 WHERE id=$1",
            [ref.id, 'f'.repeat(64)],
          );
          await m.query(
            "INSERT INTO finance_operations_audits(tenant_id,case_id,action,case_version,subject_hash,actor_subject_id,actor_natural_person_id,reason,evidence) VALUES($1,$2,'REPLAY_QUEUED',$3,$4,$5,$6,'synthetic claimed completion','{}')",
            [
              f.tenantId,
              ref.id,
              ref.version + 1,
              'f'.repeat(64),
              f.checker.subjectId,
              f.checker.naturalPersonId,
            ],
          );
          await m.query(
            "UPDATE finance_replay_requests SET state='EXECUTED' WHERE id=$1",
            [replay.id],
          );
          await m.query(
            "INSERT INTO finance_operations_audits(tenant_id,case_id,request_id,action,case_version,subject_hash,actor_subject_id,actor_natural_person_id,reason,evidence) VALUES($1,$2,$3,'REPLAY_EXECUTED',$4,$5,$6,$7,'synthetic claimed completion','{}')",
            [
              f.tenantId,
              ref.id,
              replay.id,
              ref.version + 1,
              replay.hash,
              f.checker.subjectId,
              f.checker.naturalPersonId,
            ],
          );
        }),
      ).rejects.toThrow('atomic execution record');
      expect((await row(s, 'finance_replay_requests', replay.id)).state).toBe(
        'APPROVED',
      );
      expect((await row(s, 'finance_owned_exceptions', ref.id)).version).toBe(
        ref.version,
      );
      expect((await row(s, 'finance_reference_outbox', item.id)).state).toBe(
        'DEAD_LETTER',
      );
    });
  });
});
