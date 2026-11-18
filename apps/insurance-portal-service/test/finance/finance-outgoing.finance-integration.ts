import { randomUUID } from 'node:crypto';
import { withOutgoingDatabase } from '../support/finance-outgoing-fixture';
import { FinanceOutgoingCashControls1797500000000 } from '../../src/database/migrations/1797500000000-FinanceOutgoingCashControls';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import { FinanceReceivableControls1797000000000 } from '../../src/database/migrations/1797000000000-FinanceReceivableControls';
import { FinanceOutgoingService } from '../../src/modules/tenant/finance/payables/outgoing-payments/finance-outgoing.service';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
} from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
const db = withOutgoingDatabase;
async function copyEvent(
  m: any,
  old: any,
  changes: Record<string, unknown>,
  audit = true,
) {
  const row = { ...old, ...changes, id: randomUUID() };
  row.subject = {
    ...row.subject,
    intentId: row.intent_id,
    action: row.action,
    commandKey: row.command_key,
  };
  row.subject_hash = hash(row.subject);
  row.canonical_subject = canonicalFinanceJson(row.subject);
  await m.query(
    'INSERT INTO finance_outgoing_events SELECT (jsonb_populate_record(NULL::finance_outgoing_events,$1::jsonb)).*',
    [JSON.stringify(row)],
  );
  if (audit)
    await m.query(
      "INSERT INTO finance_outgoing_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,'finance_outgoing_events',$4,$5,$6,$7,$8,'synthetic database bypass probe')",
      [
        row.tenant_id,
        row.legal_entity_id,
        row.book_id,
        row.id,
        row.action,
        row.subject_hash,
        row.actor_subject_id,
        row.actor_natural_person_id,
      ],
    );
}

describe('B15 inactive outgoing cash on disposable PostgreSQL', () => {
  it('OC23 conflicting obligation evidence is retained and freezes the approved intent', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      const changed = await f.observeCash({
        ...c.obligationSnapshot,
        id: randomUUID(),
        amount: '1',
      });
      expect(changed).toMatchObject({
        id: c.owed.id,
        sourceState: 'CONFLICT_HELD',
      });
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'EXCEPTION_HELD',
        accountFrozen: true,
        encumbered: '52.000000000000',
      });
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'held intent never submitted',
      );
      expect(f.provider.ledger).toHaveLength(0);
    });
  });
  it('OC19 concurrent submission can produce only one durable provider submit', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      let finish!: () => void;
      const barrier = new Promise<void>((resolve) => {
        finish = resolve;
      });
      f.provider.beforeReturn = () => barrier;
      const first = f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'first concurrent submit',
      );
      try {
        for (let n = 0; n < 100 && f.provider.ledger.length === 0; n++)
          await new Promise((resolve) => setTimeout(resolve, 10));
        expect(f.provider.ledger).toHaveLength(1);
        await expect(
          f.outgoing.dispatch(
            f.maker,
            f.scope(),
            c.intent,
            'SUBMIT',
            'second concurrent submit',
          ),
        ).rejects.toThrow('single-use');
      } finally {
        finish();
        await first;
      }
      expect(f.provider.ledger).toHaveLength(1);
    });
  });
  it('OC20 direct SQL cannot bypass shared funding capacity even with a matching audit', async () => {
    await db(async (f) => {
      const c = await f.readyCash('60'),
        d = await f.prepared('60');
      await f.approveCash(d);
      const [event] = await f.source.query(
        "SELECT * FROM finance_outgoing_events WHERE intent_id=$1 AND action='RESERVE'",
        [c.intent.id],
      );
      await expect(
        f.source.transaction(async (m) => {
          await copyEvent(m, event, {
            intent_id: d.intent.id,
            command_key: randomUUID(),
            subject: { ...event.subject, intentHash: d.intent.hash },
          });
        }),
      ).rejects.toThrow('capacity');
      expect(
        (await f.outgoing.read(f.checker, f.scope(), d.intent)).cashState,
      ).toBe('APPROVED');
    });
  });
  it('OC21 direct SQL cannot manufacture a maker approval or omit transaction-bound audit', async () => {
    await db(async (f) => {
      const c = await f.prepared();
      await f.approveCash(c);
      const d = await f.prepared();
      const [event] = await f.source.query(
        "SELECT * FROM finance_outgoing_events WHERE intent_id=$1 AND action='APPROVE'",
        [c.intent.id],
      );
      const [maker] = await f.source.query(
        "SELECT id FROM finance_outgoing_authorities WHERE book_id=$1 AND subject_id=$2 AND permission='REVIEW_PAYMENT'",
        [f.books[0].id, f.maker.subjectId],
      );
      await expect(
        f.source.transaction((m) =>
          copyEvent(m, event, {
            intent_id: d.intent.id,
            command_key: randomUUID(),
            actor_subject_id: f.maker.subjectId,
            actor_natural_person_id: f.maker.naturalPersonId,
            authority_id: maker.id,
            subject: { ...event.subject, intentHash: d.intent.hash },
          }),
        ),
      ).rejects.toThrow('Independent');
      await expect(
        f.source.transaction((m) =>
          copyEvent(
            m,
            event,
            {
              intent_id: d.intent.id,
              command_key: randomUUID(),
              subject: { ...event.subject, intentHash: d.intent.hash },
            },
            false,
          ),
        ),
      ).rejects.toThrow('transaction-bound audit');
    });
  });
  it('OC22 immutable bank evidence must match the provider cash fee and currency', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'confirmed synthetic cash',
      );
      const bank = await f.bankEvidence(c, '2');
      await expect(
        f.outgoing.reconcile(
          f.checker,
          f.scope(),
          c.intent,
          bank,
          randomUUID(),
          'wrong bank fee',
        ),
      ).rejects.toThrow('does not match');
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent))
          .dischargeReviewRecorded,
      ).toBe(false);
    });
  });
  it('OC01 creates empty registries and rolls an unused migration back', async () => {
    await withFinanceTestDatabase(
      async ({ dataSource: s }) => {
        const q = s.createQueryRunner();
        try {
          await new FinanceReceivableControls1797000000000().up(q);
          const migration = new FinanceOutgoingCashControls1797500000000();
          await migration.up(q);
          expect(
            (
              await s.query(
                'SELECT count(*)::int n FROM finance_outgoing_intents',
              )
            )[0].n,
          ).toBe(0);
          await migration.down(q);
          expect(
            (
              await s.query("SELECT to_regclass('finance_outgoing_intents') t")
            )[0].t,
          ).toBeNull();
        } finally {
          await q.release();
        }
      },
      process.env,
      'quotation-billing',
    );
  });
  it('OC02 pins signed B11 evidence and preserves exact frozen amounts, payee and no journals', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      const p = await f.outgoing.read(f.checker, f.scope(), c.intent);
      expect(p).toMatchObject({
        cashState: 'RESERVED',
        amount: '50.000000000000',
        encumbered: '52.000000000000',
        available: '48.000000000000',
        accountingState: 'HELD_INACTIVE',
        financialEffects: 0,
        dischargeState: 'LEGAL_DISCHARGE_HELD',
      });
      expect(
        (
          await f.source.query(
            "SELECT to_regclass('finance_journal_entries') t",
          )
        )[0].t,
      ).toBeNull();
    });
  });
  it('OC03 aliases cannot recreate capacity or reset a funding snapshot', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      expect(
        (await f.observeCash({ ...c.fundingSnapshot, id: randomUUID() })).id,
      ).toBe(c.fund.id);
      await expect(
        f.observeCash({
          ...c.fundingSnapshot,
          id: randomUUID(),
          available: '200',
          clearedBalance: '230',
        }),
      ).resolves.toMatchObject({ sourceState: 'CONFLICT_HELD' });
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent)).available,
      ).toBe('48.000000000000');
    });
  });
  it('OC04 rejects same-person aliases, changed payee and changed command content', async () => {
    await db(async (f) => {
      const c = await f.prepared(),
        alias = {
          ...f.checker,
          subjectId: randomUUID(),
          naturalPersonId: f.maker.naturalPersonId,
        };
      await f.cashGrant(alias, 'REVIEW_PAYMENT');
      await expect(
        f.outgoing.review(
          alias,
          f.scope(),
          c.intent,
          'APPROVE',
          randomUUID(),
          'alias denial',
        ),
      ).rejects.toThrow('Independent');
      await expect(
        f.outgoing.prepare(
          f.maker,
          f.scope(),
          { ...c.plan, beneficiaryHash: 'e'.repeat(64) },
          'changed payee',
        ),
      ).rejects.toThrow('beneficiary');
      await expect(
        f.outgoing.prepare(
          f.maker,
          f.scope(),
          { ...c.plan, amount: '49' },
          'changed command',
        ),
      ).rejects.toThrow('command key');
    });
  });
  it('OC05 serializes concurrent reservations against one cash capacity', async () => {
    await db(async (f) => {
      const c = await f.prepared('60'),
        d = await f.prepared('60');
      await f.approveCash(c);
      await f.approveCash(d);
      const attempts = await Promise.allSettled([
        f.reserveCash(c),
        f.reserveCash(d),
      ]);
      expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
      expect(
        (
          await f.source.query(
            "SELECT count(*)::int n FROM finance_outgoing_events WHERE action='RESERVE'",
          )
        )[0].n,
      ).toBe(1);
    });
  });
  it('OC06 confirms cash once, releases unused fee allowance and holds accounting', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'synthetic single payment',
      );
      const second = await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'idempotent confirmed retry',
      );
      expect(second.providerCalled).toBe(false);
      expect(f.provider.ledger).toHaveLength(1);
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'CONFIRMED',
        confirmedCash: '51.000000000000',
        encumbered: '51.000000000000',
        available: '49.000000000000',
        dischargeState: 'LEGAL_DISCHARGE_HELD',
        financialEffects: 0,
      });
    });
  });
  it('OC07 timeout retains reservation, prohibits blind submission and queries the original key', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      f.provider.timeout = true;
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'lost provider response',
      );
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent)).cashState,
      ).toBe('UNKNOWN');
      await expect(
        f.outgoing.dispatch(
          f.maker,
          f.scope(),
          c.intent,
          'SUBMIT',
          'blind retry denied',
        ),
      ).rejects.toThrow('single-use');
      await expect(
        f.outgoing.cancel(
          f.checker,
          f.scope(),
          c.intent,
          randomUUID(),
          'cannot undo uncertain cash',
        ),
      ).rejects.toThrow('cannot release');
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'QUERY',
        'recover original execution',
      );
      expect(f.provider.ledger.map((c) => c.operation)).toEqual([
        'SUBMIT',
        'QUERY',
      ]);
      expect(f.provider.ledger[0].request.executionKey).toBe(
        f.provider.ledger[1].request.executionKey,
      );
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent)).cashState,
      ).toBe('CONFIRMED');
    });
  });
  it('OC08 a failed local result transaction cannot undo confirmed provider cash', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      await f.source.query(
        "CREATE FUNCTION b15_result_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic result commit failed'; END $$",
      );
      await f.source.query(
        'CREATE TRIGGER b15_result_failure BEFORE INSERT ON finance_outgoing_observations FOR EACH ROW EXECUTE FUNCTION b15_result_failure()',
      );
      try {
        await expect(
          f.outgoing.dispatch(
            f.maker,
            f.scope(),
            c.intent,
            'SUBMIT',
            'provider confirmed before local failure',
          ),
        ).rejects.toThrow('synthetic result');
      } finally {
        await f.source.query(
          'DROP TRIGGER b15_result_failure ON finance_outgoing_observations',
        );
        await f.source.query('DROP FUNCTION b15_result_failure()');
      }
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent)).cashState,
      ).toBe('UNKNOWN');
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'QUERY',
        'recover durable provider call',
      );
      expect(
        f.provider.ledger.filter((c) => c.operation === 'SUBMIT'),
      ).toHaveLength(1);
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent)).confirmedCash,
      ).toBe('51.000000000000');
    });
  });
  it('OC09 definitive no-cash failure releases capacity without reusing the execution key', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      f.provider.outcome = 'FAILED_FINAL';
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'definitive provider failure',
      );
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'FAILED_FINAL',
        available: '100.000000000000',
        obligationRemaining: '100.000000000000',
      });
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'terminal retry',
      );
      expect(f.provider.ledger).toHaveLength(1);
    });
  });
  it('OC10 NOT_FOUND is uncertain and never frees reserved cash', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      f.provider.outcome = 'NOT_FOUND';
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'uncertain provider lookup',
      );
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'QUERY',
        'provider not yet found',
      );
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'UNKNOWN',
        encumbered: '52.000000000000',
        available: '48.000000000000',
      });
    });
  });
  it('OC11 a confirmed fee overrun is preserved and freezes the cash account', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      f.provider.fee = '60';
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'preserve unexpected confirmed fee',
      );
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'EXCEPTION_HELD',
        confirmedCash: '110.000000000000',
        available: '-10.000000000000',
        accountFrozen: true,
      });
    });
  });
  it('OC12 mismatched provider beneficiary remains a held conflict with reservation intact', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      f.provider.beneficiaryHash = 'e'.repeat(64);
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'conflicting provider response',
      );
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'EXCEPTION_HELD',
        encumbered: '52.000000000000',
        accountFrozen: true,
      });
      expect(
        (
          await f.source.query(
            'SELECT subject FROM finance_outgoing_observations',
          )
        )[0].subject.rawOutcome.state,
      ).toBe('CONFIRMED');
    });
  });
  it('OC13 cancellation is independently audited before any provider attempt', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      await f.outgoing.cancel(
        f.checker,
        f.scope(),
        c.intent,
        randomUUID(),
        'cancel before any provider call',
      );
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'CANCELLED',
        available: '100.000000000000',
      });
      await expect(
        f.outgoing.dispatch(
          f.maker,
          f.scope(),
          c.intent,
          'SUBMIT',
          'cancelled payment denied',
        ),
      ).rejects.toThrow('uncancelled');
      expect(f.provider.ledger).toHaveLength(0);
    });
  });
  it('OC14 bank match and separate discharge review preserve accounting/legal holds', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'synthetic confirmed payment',
      );
      const bank = await f.bankEvidence(c);
      await f.outgoing.reconcile(
        f.checker,
        f.scope(),
        c.intent,
        bank,
        randomUUID(),
        'signed bank reconciliation',
      );
      await f.outgoing.reconcile(
        f.checker,
        f.scope(),
        c.intent,
        bank,
        randomUUID(),
        'separate discharge evidence review',
        true,
      );
      expect(
        await f.outgoing.read(f.checker, f.scope(), c.intent),
      ).toMatchObject({
        cashState: 'CONFIRMED',
        dischargeReviewRecorded: true,
        dischargeState: 'LEGAL_DISCHARGE_HELD',
        financialEffects: 0,
      });
    });
  });
  it('OC15 revocation after the provider call cannot erase a confirmed cash observation', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      f.provider.beforeReturn = async () => {
        await f.source.query(
          "UPDATE finance_outgoing_authorities SET revoked_at=statement_timestamp() WHERE subject_id=$1 AND permission='EXECUTE_SIMULATION'",
          [f.maker.subjectId],
        );
      };
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        c.intent,
        'SUBMIT',
        'record fact despite intervening revocation',
      );
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent)).cashState,
      ).toBe('CONFIRMED');
    });
  });
  it('OC16 cross-book access and revoked approval deny provider calls', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      await expect(
        f.outgoing.read(f.checker, f.scope(1), c.intent),
      ).rejects.toThrow('unavailable');
      await f.source.query(
        "UPDATE finance_outgoing_authorities SET revoked_at=statement_timestamp() WHERE subject_id=$1 AND permission='REVIEW_PAYMENT'",
        [f.checker.subjectId],
      );
      await expect(
        f.outgoing.dispatch(
          f.maker,
          f.scope(),
          c.intent,
          'SUBMIT',
          'revoked review denied',
        ),
      ).rejects.toThrow('expired or changed');
      expect(f.provider.ledger).toHaveLength(0);
    });
  });
  it('OC17 production mode or absent simulator fails closed before recording a provider call', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      const disabled = new FinanceOutgoingService(f.source, []);
      await expect(
        disabled.dispatch(
          f.maker,
          f.scope(),
          c.intent,
          'SUBMIT',
          'no transport configured',
        ),
      ).rejects.toThrow('simulator');
      const prior = process.env.APP_ENV;
      try {
        process.env.APP_ENV = 'development';
        await expect(
          f.outgoing.dispatch(
            f.maker,
            f.scope(),
            c.intent,
            'SUBMIT',
            'development cannot simulate payout',
          ),
        ).rejects.toThrow('restricted');
      } finally {
        process.env.APP_ENV = prior;
      }
      expect(
        (
          await f.source.query(
            'SELECT count(*)::int n FROM finance_outgoing_calls',
          )
        )[0].n,
      ).toBe(0);
    });
  });
  it('OC18 immutable evidence and mandatory audits survive rollback attempts', async () => {
    await db(async (f) => {
      const c = await f.readyCash();
      await expect(
        f.source.query(
          'UPDATE finance_outgoing_intents SET amount=1 WHERE id=$1',
          [c.intent.id],
        ),
      ).rejects.toThrow('append-only');
      await expect(
        f.source.query('TRUNCATE finance_outgoing_events'),
      ).rejects.toThrow('append-only');
      const q = f.source.createQueryRunner();
      try {
        await expect(
          new FinanceOutgoingCashControls1797500000000().down(q),
        ).rejects.toThrow('retain');
      } finally {
        await q.release();
      }
      expect(
        (await f.outgoing.read(f.checker, f.scope(), c.intent)).available,
      ).toBe('48.000000000000');
    });
  });
});
