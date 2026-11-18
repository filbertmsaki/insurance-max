import { randomUUID } from 'node:crypto';
import { withCommissionDatabase as db } from '../support/finance-commission-fixture';
import { withPolicyChangeDatabase } from '../support/finance-policy-change-fixture';
import { FinanceCommissionControls1797700000000 } from '../../src/database/migrations/1797700000000-FinanceCommissionControls';
import { FinanceCommissionControlHardening1797800000000 } from '../../src/database/migrations/1797800000000-FinanceCommissionControlHardening';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
} from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';

describe('B17 inactive commission/acquisition controls on disposable PostgreSQL', () => {
  it('CM25 party roll-forward combines separate contracts without netting books or currencies', async () =>
    db(async (f) => {
      const a = await f.readyCommission(),
        b = await f.readyCommission({
          partyId: a.commissionSnapshot.partyId,
          beneficiary: a.commissionSnapshot.beneficiary,
        });
      await f.commissionSettlement(a, '5');
      const party = await f.commissions.readParty(
        f.checker,
        f.scope(),
        a.commissionSnapshot.partyId,
        'USD',
      );
      expect(party.totals).toMatchObject({
        commission: '40.000000000000',
        payable: '40.000000000000',
        reserved: '5.000000000000',
        available: '35.000000000000',
      });
      expect(party.commissions).toHaveLength(2);
      expect(
        (
          await f.commissions.readParty(
            f.checker,
            f.scope(1),
            a.commissionSnapshot.partyId,
            'USD',
          )
        ).commissions,
      ).toHaveLength(0);
      expect(
        (
          await f.commissions.readParty(
            f.checker,
            f.scope(),
            b.commissionSnapshot.partyId,
            'USD',
          )
        ).financialEffects,
      ).toBe(0);
    }));
  it('CM24 review authority covers the largest commission, tax, withholding or payable component', async () =>
    db(async (f) => {
      const c = await f.preparedCommission({
        taxDelta: '2',
        withholdingDelta: '1',
        payableDelta: '21',
      });
      await f.source.query(
        "UPDATE finance_commission_authorities SET max_amount=20 WHERE subject_id=$1 AND permission='REVIEW_COMMISSION'",
        [f.checker.subjectId],
      );
      await expect(f.reviewCommission(c.movement)).rejects.toThrow('authority');
    }));
  it('CM23 explicit forward hardening replaces an early guard without changing commission evidence', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      const q = f.source.createQueryRunner();
      try {
        await q.query(
          "CREATE OR REPLACE FUNCTION finance_commission_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'EARLY_UNCERTIFIED_GUARD'; END $$",
        );
        await new FinanceCommissionControlHardening1797800000000().up(q);
        await new FinanceCommissionControlHardening1797800000000().down();
        expect(
          (await f.commissions.read(f.checker, f.scope(), c.movement)).payable,
        ).toBe('20.000000000000');
        await f.commissionSettlement(c, '10');
      } finally {
        await q.release();
      }
    }));
  it('CM19 known applied policy changes hold cash even before a B17 adjustment arrives', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      await f.clawback(c);
      await expect(f.commissionSettlement(c)).rejects.toThrow('held');
    }));
  it('CM20 a full reversal opposes each accepted original component', async () =>
    db(async (f) => {
      const c = await f.readyCommission({
        commissionDelta: '2',
        payableDelta: '2',
      });
      const reversed = await f.observeCommission(
        await f.clawback(c, {
          effect: 'REVERSAL',
          reverses: { id: c.movement.id, hash: c.movement.hash },
        }),
      );
      await f.reviewCommission(reversed);
      expect(
        await f.commissions.read(f.checker, f.scope(), reversed),
      ).toMatchObject({
        commission: '0.000000000000',
        payable: '0.000000000000',
      });
    }));
  it('CM21 independent rejection releases an unexecuted reservation and commands stay idempotent', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        r = await f.commissionSettlement(c, '15');
      expect(
        (
          await f.commissions.prepareSettlement(
            f.maker,
            f.scope(),
            r.plan,
            'Retry unchanged command',
          )
        ).id,
      ).toBe(r.ref.id);
      await f.commissions.reviewSettlement(
        f.checker,
        f.scope(),
        r.ref,
        'REJECT',
        randomUUID(),
        'Reject synthetic settlement',
      );
      expect(
        (await f.commissions.read(f.checker, f.scope(), c.movement)).available,
      ).toBe('20.000000000000');
    }));
  it('CM22 a changed maker authority blocks approval of its prepared settlement', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        r = await f.commissionSettlement(c);
      await f.source.query(
        "UPDATE finance_commission_authorities SET max_amount=999 WHERE subject_id=$1 AND permission='PREPARE_SETTLEMENT'",
        [f.maker.subjectId],
      );
      await expect(f.approveCommission(r.ref)).rejects.toThrow(
        'authority changed',
      );
    }));
  it('CM01 empty migration is reversible and preserves B16', async () =>
    withPolicyChangeDatabase(async (f) => {
      const q = f.source.createQueryRunner();
      try {
        const m = new FinanceCommissionControls1797700000000();
        await m.up(q);
        await m.down(q);
        expect(
          (
            await q.query(
              "SELECT to_regclass('finance_commission_movements') n,to_regclass('finance_policy_changes') p",
            )
          )[0],
        ).toEqual({ n: null, p: 'finance_policy_changes' });
        await m.up(q);
      } finally {
        await q.release();
      }
    }));
  it('CM02 reviewed component and party roll-forward never creates an expense, asset or journal', async () =>
    db(async (f) => {
      const c = await f.readyCommission({
        taxDelta: '2',
        withholdingDelta: '1',
        payableDelta: '21',
      });
      expect(
        await f.commissions.read(f.checker, f.scope(), c.movement),
      ).toMatchObject({
        commission: '20.000000000000',
        tax: '2.000000000000',
        withholding: '1.000000000000',
        payable: '21.000000000000',
        available: '21.000000000000',
        expenseRecognised: '0',
        assetRecognised: '0',
        ifrs17Movements: 0,
        financialEffects: 0,
      });
      expect(
        (
          await f.source.query(
            'SELECT count(*)::int n FROM finance_journal_candidates',
          )
        )[0].n,
      ).toBe(0);
    }));
  it('CM03 missing tax/withholding remains unresolved and cannot be reviewed or settled', async () =>
    db(async (f) => {
      const c = await f.preparedCommission({
        taxDelta: null,
        withholdingDelta: null,
        payableDelta: null,
        taxEvidenceHash: null,
      });
      await expect(f.reviewCommission(c.movement)).rejects.toThrow(
        'unresolved',
      );
      await expect(f.commissionSettlement(c)).rejects.toThrow('held');
    }));
  it('CM04 same signed delivery and higher workflow alias do not duplicate entitlement', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      const same = await f.observeCommission(c.commissionSnapshot);
      expect(same.id).toBe(c.movement.id);
      const alias = await f.observeCommission({
        ...c.commissionSnapshot,
        sourceRevision: 2,
      });
      expect(alias.id).toBe(c.movement.id);
      expect(
        (await f.commissions.read(f.checker, f.scope(), c.movement)).payable,
      ).toBe('20.000000000000');
    }));
  it('CM05 changed accepted source is retained as conflict and freezes settlement', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      const conflict = await f.observeCommission({
        ...c.commissionSnapshot,
        sourceRevision: 2,
        commissionDelta: '21',
        payableDelta: '21',
      });
      expect(conflict.sourceState).toBe('CONFLICT_HELD');
      await expect(f.commissionSettlement(c)).rejects.toThrow('held');
    }));
  it('CM06 source identities cannot create the same commission in another book', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      await expect(
        f.observeCommission(c.commissionSnapshot, 1),
      ).rejects.toThrow(/another|scope|book/i);
    }));
  it('CM07 makers, natural-person aliases and revoked authorities cannot review', async () =>
    db(async (f) => {
      const c = await f.preparedCommission();
      await expect(
        f.commissions.review(
          f.maker,
          f.scope(),
          c.movement,
          'REVIEWED_INACTIVE',
          'Self approval',
        ),
      ).rejects.toThrow('Independent');
      const alias = { ...f.checker, naturalPersonId: f.maker.naturalPersonId };
      await f.commissionGrant(alias, 'REVIEW_COMMISSION');
      await expect(
        f.commissions.review(
          alias,
          f.scope(),
          c.movement,
          'REVIEWED_INACTIVE',
          'Alias approval',
        ),
      ).rejects.toThrow('Independent');
      await f.source.query(
        "UPDATE finance_commission_authorities SET state='REVOKED' WHERE subject_id=$1 AND permission='REVIEW_COMMISSION'",
        [f.checker.subjectId],
      );
      await expect(f.reviewCommission(c.movement)).rejects.toThrow('authority');
    }));
  it('CM08 cancellation clawback uses the exact reviewed B16 commission component', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      const a = await f.observeCommission(await f.clawback(c));
      await f.reviewCommission(a);
      expect(await f.commissions.read(f.checker, f.scope(), a)).toMatchObject({
        commission: '18.000000000000',
        payable: '18.000000000000',
      });
      const wrong = await f.observeCommission(
        await f.clawback(c, {
          previous: { id: a.id, hash: a.hash },
          commissionDelta: '-3',
          payableDelta: '-3',
        }),
      );
      await expect(f.reviewCommission(wrong)).rejects.toThrow('delta differs');
    }));
  it('CM09 the same policy-change commission effect cannot be applied twice', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        a = await f.observeCommission(await f.clawback(c));
      await f.reviewCommission(a);
      const duplicate = await f.observeCommission(
        await f.clawback(c, { previous: { id: a.id, hash: a.hash } }),
      );
      await expect(f.reviewCommission(duplicate)).rejects.toThrow(
        'already consumed',
      );
    }));
  it('CM10 concurrent requests cannot over-reserve commission payable', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      const results = await Promise.allSettled([
        f.commissionSettlement(c, '15'),
        f.commissionSettlement(c, '15'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (await f.commissions.read(f.checker, f.scope(), c.movement)).available,
      ).toBe('5.000000000000');
    }));
  it('CM11 legacy paid and reserved allocations consume capacity once', async () =>
    db(async (f) => {
      const c = await f.readyCommission({
        legacyPaid: '5',
        legacyReserved: '4',
      });
      expect(
        (await f.commissions.read(f.checker, f.scope(), c.movement)).available,
      ).toBe('11.000000000000');
      await expect(f.commissionSettlement(c, '12')).rejects.toThrow(
        'insufficient',
      );
      await f.commissionSettlement(c, '11');
    }));
  it('CM12 late clawback exposes overcommitment and blocks new cash without rewriting history', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        r = await f.commissionSettlement(c, '20');
      await f.approveCommission(r.ref);
      const a = await f.observeCommission(await f.clawback(c));
      await f.reviewCommission(a);
      expect(await f.commissions.read(f.checker, f.scope(), a)).toMatchObject({
        available: '-2.000000000000',
        holds: expect.arrayContaining([
          'CLAWBACK_OR_OVERCOMMITMENT_RECONCILIATION_REQUIRED',
        ]),
      });
      await expect(f.commissionExecution(r.ref, '20')).rejects.toThrow(
        /stale|entitlement/,
      );
    }));
  it('CM13 reviewed settlement candidate still requires signed B11 intake and exact B15 binding', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        r = await f.commissionSettlement(c);
      await f.approveCommission(r.ref);
      const e = await f.commissionExecution(r.ref, '10', false);
      await expect(
        f.outgoing.reserve(
          f.maker,
          f.scope(),
          e.intent,
          randomUUID(),
          'Unbound cash',
        ),
      ).rejects.toThrow(/Commission cash/);
      await f.commissions.bindExecution(
        f.maker,
        f.scope(),
        r.ref,
        e.intent,
        randomUUID(),
        'Exact cash binding',
      );
      await f.outgoing.reserve(
        f.maker,
        f.scope(),
        e.intent,
        randomUUID(),
        'Bound cash',
      );
    }));
  it('CM14 confirmed cash and bank fees reconcile separately and legal discharge stays held', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        r = await f.commissionSettlement(c);
      await f.approveCommission(r.ref);
      const e = await f.commissionExecution(r.ref);
      await f.outgoing.reserve(
        f.maker,
        f.scope(),
        e.intent,
        randomUUID(),
        'Reserve synthetic cash',
      );
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Submit synthetic commission',
      );
      expect(
        await f.commissions.reconcileSettlement(
          f.checker,
          f.scope(),
          r.ref,
          randomUUID(),
          'Reconcile actual cash',
        ),
      ).toMatchObject({
        state: 'UNRECONCILED_CASH_HELD',
        principal: '10.000000000000',
        fees: '1.000000000000',
        legalDischargeAccepted: false,
      });
      const bank = await f.bankEvidence(e);
      await f.outgoing.reconcile(
        f.checker,
        f.scope(),
        e.intent,
        bank,
        randomUUID(),
        'Match signed bank evidence',
      );
      expect(
        await f.commissions.reconcileSettlement(
          f.checker,
          f.scope(),
          r.ref,
          randomUUID(),
          'Independent cash match',
        ),
      ).toMatchObject({ state: 'CONFIRMED_CASH_HELD', financialEffects: 0 });
      await expect(
        f.commissions.reviewSettlement(
          f.checker,
          f.scope(),
          r.ref,
          'CANCEL',
          randomUUID(),
          'Cannot release paid cash',
        ),
      ).rejects.toThrow('capacity');
    }));
  it('CM15 timeout then late clawback permits original-key query recovery only', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        r = await f.commissionSettlement(c, '20');
      await f.approveCommission(r.ref);
      const e = await f.commissionExecution(r.ref, '20');
      await f.outgoing.reserve(
        f.maker,
        f.scope(),
        e.intent,
        randomUUID(),
        'Reserve',
      );
      f.provider.timeout = true;
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Lost response',
      );
      const a = await f.observeCommission(await f.clawback(c));
      await f.reviewCommission(a);
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'QUERY',
        'Recover original provider truth',
      );
      expect(f.provider.ledger.map((x) => x.operation)).toEqual([
        'SUBMIT',
        'QUERY',
      ]);
      expect(
        await f.commissions.reconcileSettlement(
          f.checker,
          f.scope(),
          r.ref,
          randomUUID(),
          'Retain actual cash',
        ),
      ).toMatchObject({
        state: 'EXCEPTION_HELD',
        principal: '20.000000000000',
      });
    }));
  it('CM16 attribution proposal cannot activate IFRS17 or create dual expense and asset', async () =>
    db(async (f) => {
      const c = await f.readyCommission({
        acquisition: {
          classification: 'PROPOSED_ATTRIBUTABLE',
          evidenceHash: 'd'.repeat(64),
          allocationReference: 'SYNTHETIC-GROUP-ALLOCATION',
        },
      });
      expect(
        await f.commissions.read(f.checker, f.scope(), c.movement),
      ).toMatchObject({
        acquisitionAccountingState: 'HELD_INACTIVE',
        expenseRecognised: '0',
        assetRecognised: '0',
        ifrs17Movements: 0,
      });
    }));
  it('CM17 populated rollback and mutation are rejected', async () =>
    db(async (f) => {
      const c = await f.readyCommission();
      await expect(
        f.source.query(
          'UPDATE finance_commission_movements SET party_id=$1 WHERE id=$2',
          [randomUUID(), c.movement.id],
        ),
      ).rejects.toThrow('append-only');
      const q = f.source.createQueryRunner();
      try {
        await expect(
          new FinanceCommissionControls1797700000000().down(q),
        ).rejects.toThrow('retained');
      } finally {
        await q.release();
      }
    }));
  it('CM18 direct insert requires audit and cannot bypass the payable capacity guard', async () =>
    db(async (f) => {
      const c = await f.readyCommission(),
        r = await f.commissionSettlement(c, '15'),
        [old] = await f.source.query(
          'SELECT * FROM finance_commission_settlements WHERE id=$1',
          [r.ref.id],
        );
      const copy = (amount: string, audit: boolean) =>
        f.source.transaction(async (m) => {
          const row = {
            ...old,
            id: randomUUID(),
            command_key: randomUUID(),
            amount,
          };
          row.subject = {
            ...row.subject,
            plan: { ...row.subject.plan, commandKey: row.command_key, amount },
          };
          row.subject_hash = hash(row.subject);
          row.canonical_subject = canonicalFinanceJson(row.subject);
          await m.query(
            'INSERT INTO finance_commission_settlements SELECT (jsonb_populate_record(NULL::finance_commission_settlements,$1::jsonb)).*',
            [JSON.stringify(row)],
          );
          if (audit)
            await m.query(
              "INSERT INTO finance_commission_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,'finance_commission_settlements',$4,'PREPARE_SETTLEMENT',$5,$6,$7,'Synthetic bypass probe')",
              [
                row.tenant_id,
                row.legal_entity_id,
                row.book_id,
                row.id,
                row.subject_hash,
                row.actor_subject_id,
                row.actor_natural_person_id,
              ],
            );
        });
      await expect(copy('1', false)).rejects.toThrow('audit');
      await expect(copy('10', true)).rejects.toThrow('entitlement');
      expect(
        (await f.commissions.read(f.checker, f.scope(), c.movement)).available,
      ).toBe('5.000000000000');
    }));
});
