import { randomUUID } from 'node:crypto';
import { withOutgoingDatabase } from '../support/finance-outgoing-fixture';
import { withPolicyChangeDatabase as db } from '../support/finance-policy-change-fixture';
import { FinancePolicyChangeControls1797600000000 } from '../../src/database/migrations/1797600000000-FinancePolicyChangeControls';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
} from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';

describe('B16 inactive policy changes and refunds on disposable PostgreSQL', () => {
  it('PC17 empty migration rolls back without changing B15 controls', async () =>
    withOutgoingDatabase(async (f) => {
      const q = f.source.createQueryRunner();
      try {
        const migration = new FinancePolicyChangeControls1797600000000();
        await migration.up(q);
        await migration.down(q);
        expect(
          (
            await q.query(
              "SELECT to_regclass('finance_policy_changes') new_table,to_regclass('finance_outgoing_intents') previous_table",
            )
          )[0],
        ).toMatchObject({
          new_table: null,
          previous_table: 'finance_outgoing_intents',
        });
        await migration.up(q);
      } finally {
        await q.release();
      }
    }));
  it('PC18 debit and zero-value endorsements preserve actual component differences', async () =>
    db(async (f) => {
      for (const amount of ['0', '20']) {
        const c = await f.readyChange({
          kind: 'ENDORSEMENT',
          additionalPremium: amount,
          returnPremium: '0',
          taxDifference: '0',
          taxLines: [],
          feeDifference: '0',
          commissionDifference: '0',
        });
        expect(
          await f.changes.readChange(f.checker, f.scope(), c.change),
        ).toMatchObject({
          payableDifference: amount + '.000000000000',
          entitlement: '0.000000000000',
        });
        await expect(f.prepareRefund(c, '1')).rejects.toThrow('insufficient');
      }
    }));
  it('PC19 rejects out-of-order terms and ordinary changes after cancellation', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        wrong = await f.observeChange(
          f.nextChange(c, {
            kind: 'ENDORSEMENT',
            sourceVersion: {
              id: randomUUID(),
              number: 5,
              hash: '7'.repeat(64),
            },
            targetVersion: {
              id: randomUUID(),
              number: 6,
              hash: '8'.repeat(64),
            },
          }),
        );
      await expect(f.reviewChange(wrong)).rejects.toThrow('out of order');
      const ordinary = await f.observeChange(
        f.nextChange(c, { kind: 'ENDORSEMENT' }),
      );
      await expect(f.reviewChange(ordinary)).rejects.toThrow('cancelled');
    }));
  it('PC20 pending reversals reduce refund capacity before their approval', async () =>
    db(async (f) => {
      const c = await f.readyChange();
      await f.receivables.proposeAssignment(
        f.maker,
        f.scope(),
        {
          ...f.profile(),
          commandKey: randomUUID(),
          receiptId: c.observed.receiptId!,
          memoId: c.bill.memo.id,
          memoHash: c.bill.memo.hash,
          amount: '30',
          originalId: c.assignment.id,
        },
        'Pending correction',
      );
      await expect(f.prepareRefund(c, '60')).rejects.toThrow(
        'original receipt',
      );
      await f.prepareRefund(c, '50');
    }));
  it('PC21 direct inserts cannot exceed entitlement or omit a transaction-bound audit', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c, '40'),
        [original] = await f.source.query(
          'SELECT * FROM finance_policy_refund_requests WHERE id=$1',
          [r.refund.id],
        );
      const copy = async (audit: boolean) =>
        f.source.transaction(async (m) => {
          const row = {
            ...original,
            id: randomUUID(),
            command_key: randomUUID(),
          };
          row.subject = {
            ...row.subject,
            plan: { ...row.subject.plan, commandKey: row.command_key },
          };
          row.subject_hash = hash(row.subject);
          row.canonical_subject = canonicalFinanceJson(row.subject);
          await m.query(
            'INSERT INTO finance_policy_refund_requests SELECT (jsonb_populate_record(NULL::finance_policy_refund_requests,$1::jsonb)).*',
            [JSON.stringify(row)],
          );
          if (audit)
            await m.query(
              "INSERT INTO finance_policy_change_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,'finance_policy_refund_requests',$4,'PREPARE_REFUND',$5,$6,$7,'Synthetic bypass probe')",
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
      await expect(copy(true)).rejects.toThrow('entitlement');
      await f.changes.reviewRefund(
        f.checker,
        f.scope(),
        r.refund,
        'REJECT',
        randomUUID(),
        'Release draft for audit probe',
      );
      await expect(copy(false)).rejects.toThrow('audit');
    }));
  it('PC22 original execution can be queried after a late correction; confirmed cash is retained', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      const e = await f.refundExecution(r.refund);
      await f.reserveCash(e as any);
      f.provider.timeout = true;
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Lost confirmation',
      );
      const adjustment = await f.observeChange(
        f.nextChange(c, {
          effect: 'ADJUSTMENT',
          correctionOf: { id: c.change.id, hash: c.change.hash },
          additionalPremium: '30',
          returnPremium: '0',
          taxDifference: '0',
          taxLines: [],
          feeDifference: '0',
          commissionDifference: '0',
        }),
      );
      await f.reviewChange(adjustment);
      f.provider.timeout = false;
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'QUERY',
        'Recover original execution only',
      );
      expect(f.provider.ledger.map((x) => x.operation)).toEqual([
        'SUBMIT',
        'QUERY',
      ]);
      expect(
        await f.changes.reconcileRefund(
          f.checker,
          f.scope(),
          r.refund,
          randomUUID(),
          'Retain confirmed cash after late correction',
        ),
      ).toMatchObject({
        state: 'EXCEPTION_HELD',
        principal: '40.000000000000',
      });
    }));
  it('PC23 partial executions show the amount actually returned, with fees separate', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      const e = await f.refundExecution(r.refund, '20');
      await f.reserveCash(e as any);
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Partial refund execution',
      );
      const bank = await f.bankEvidence(e as any);
      await f.outgoing.reconcile(
        f.checker,
        f.scope(),
        e.intent,
        bank,
        randomUUID(),
        'Partial bank match',
      );
      expect(
        await f.changes.reconcileRefund(
          f.checker,
          f.scope(),
          r.refund,
          randomUUID(),
          'Partial confirmed refund',
        ),
      ).toMatchObject({
        state: 'PARTIALLY_CONFIRMED_CASH_HELD',
        principal: '20.000000000000',
        fees: '1.000000000000',
      });
    }));
  it('PC24 unresolved invoice reconciliation and beneficiary-related review stay blocked', async () =>
    db(async (f) => {
      const c = await f.preparedChange({ invoiceReconciliation: 'UNRESOLVED' });
      await expect(f.reviewChange(c.change)).rejects.toThrow('reconciliation');
      const good = await f.readyChange(),
        p = f.refundPlan(good);
      if (p.beneficiary.mode !== 'REFERENCED')
        throw Error('Referenced fixture required');
      p.beneficiary.naturalPersonIds = [f.checker.naturalPersonId];
      const r = await f.changes.prepareRefund(
        f.maker,
        f.scope(),
        p,
        'Related beneficiary',
      );
      await expect(f.approveRefund(r)).rejects.toThrow('beneficiary');
    }));
  it('PC01 keeps source component vectors separate and approval does not return cash', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      expect(
        await f.changes.readChange(f.checker, f.scope(), c.change),
      ).toMatchObject({
        payableDifference: '-60.000000000000',
        netPremiumDifference: '-50.000000000000',
        taxDifference: '-9.000000000000',
        feeDifference: '-1.000000000000',
        commissionDifference: '-2.000000000000',
        entitlement: '60.000000000000',
        refundReserved: '40.000000000000',
        entitlementAvailable: '20.000000000000',
        financialEffects: 0,
      });
      expect(
        await f.changes.reconcileRefund(
          f.checker,
          f.scope(),
          r.refund,
          randomUUID(),
          'No payment occurred',
        ),
      ).toMatchObject({
        state: 'NO_CONFIRMED_REFUND',
        principal: '0.000000000000',
        legalDischargeAccepted: false,
      });
      expect(f.provider.ledger).toHaveLength(0);
    }));
  it('PC02 unknown tax evidence is held and can be repaired only by a signed source revision', async () =>
    db(async (f) => {
      const c = await f.preparedChange({
        taxDifference: null,
        taxLines: null,
        taxEvidenceHash: null,
      });
      await expect(f.reviewChange(c.change)).rejects.toThrow('breakdown');
      const fixed = {
        ...c.snapshot,
        sourceRevision: 2,
        taxDifference: '-9',
        taxLines: [
          {
            code: 'SYNTHETIC-TAX',
            kind: 'TAX' as const,
            amount: '-9',
            ruleHash: '3'.repeat(64),
          },
        ],
        taxEvidenceHash: '5'.repeat(64),
      };
      const repaired = await f.observeChange(fixed);
      await f.reviewChange(repaired);
      await expect(f.reviewChange(c.change)).rejects.toThrow('latest');
      expect(
        (await f.changes.readChange(f.checker, f.scope(), repaired))
          .entitlement,
      ).toBe('60.000000000000');
    }));
  it('PC03 source delivery aliases cannot duplicate a return-premium entitlement', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        alias = await f.observeChange({ ...c.snapshot, sourceRevision: 2 });
      expect(alias.id).toBe(c.change.id);
      expect(alias.sourceState).toBe('MATCHED');
      expect(
        (await f.changes.readChange(f.checker, f.scope(), c.change))
          .entitlement,
      ).toBe('60.000000000000');
    }));
  it('PC04 changed accepted source becomes a durable conflict and blocks refunds', async () =>
    db(async (f) => {
      const c = await f.readyChange();
      expect(
        await f.observeChange({
          ...c.snapshot,
          sourceRevision: 2,
          returnPremium: '70',
        }),
      ).toMatchObject({ id: c.change.id, sourceState: 'CONFLICT_HELD' });
      await expect(f.prepareRefund(c)).rejects.toThrow('held');
    }));
  it('PC05 enforces maker-checker and tenant/book isolation', async () =>
    db(async (f) => {
      const c = await f.preparedChange();
      await expect(
        f.changes.reviewChange(
          f.maker,
          f.scope(),
          c.change,
          'REVIEWED_INACTIVE',
          'Self review',
        ),
      ).rejects.toThrow('Independent');
      await expect(
        f.changes.readChange(f.checker, f.scope(1), c.change),
      ).rejects.toThrow('unavailable');
      const alias = { ...f.checker, naturalPersonId: f.maker.naturalPersonId };
      await f.changeGrant(alias, 'REVIEW_CHANGE');
      await expect(
        f.changes.reviewChange(
          alias,
          f.scope(),
          c.change,
          'REVIEWED_INACTIVE',
          'Maker alias',
        ),
      ).rejects.toThrow('Independent');
    }));
  it('PC06 refund commands are idempotent even after consuming all entitlement', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        p = f.refundPlan(c, '60'),
        r = await f.changes.prepareRefund(
          f.maker,
          f.scope(),
          p,
          'First preparation',
        );
      expect(
        await f.changes.prepareRefund(f.maker, f.scope(), p, 'Exact retry'),
      ).toMatchObject({ id: r.id, reused: true });
      await expect(
        f.changes.prepareRefund(
          f.maker,
          f.scope(),
          { ...p, amount: '59' },
          'Changed retry',
        ),
      ).rejects.toThrow('different');
    }));
  it('PC07 concurrent refund requests cannot consume the same entitlement twice', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        results = await Promise.allSettled([
          f.prepareRefund(c, '40'),
          f.prepareRefund(c, '40'),
        ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (await f.changes.readChange(f.checker, f.scope(), c.change))
          .refundReserved,
      ).toBe('40.000000000000');
    }));
  it('PC08 refunds and pending allocation reversals share original receipt capacity', async () =>
    db(async (f) => {
      const c = await f.readyChange();
      await f.prepareRefund(c, '60');
      await expect(
        f.receivables.proposeAssignment(
          f.maker,
          f.scope(),
          {
            ...f.profile(),
            commandKey: randomUUID(),
            receiptId: c.observed.receiptId!,
            originalId: c.assignment.id,
            memoId: c.bill.memo.id,
            memoHash: c.bill.memo.hash,
            amount: '30',
          },
          'Reverse reserved allocation',
        ),
      ).rejects.toThrow();
    }));
  it('PC09 independent rejection releases entitlement without deleting audit evidence', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c, '60');
      await f.changes.reviewRefund(
        f.checker,
        f.scope(),
        r.refund,
        'REJECT',
        randomUUID(),
        'Reject draft',
      );
      expect(
        (await f.changes.readChange(f.checker, f.scope(), c.change))
          .entitlementAvailable,
      ).toBe('60.000000000000');
      await expect(
        f.source.query(
          'DELETE FROM finance_policy_refund_requests WHERE id=$1',
          [r.refund.id],
        ),
      ).rejects.toThrow('append-only');
    }));
  it('PC10 binds signed obligations before allowing any B15 cash reservation', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      const e = await f.refundExecution(r.refund, '40', false);
      await expect(
        f.outgoing.reserve(
          f.maker,
          f.scope(),
          e.intent,
          randomUUID(),
          'Unbound payment',
        ),
      ).rejects.toThrow('unbound');
      const key = randomUUID();
      await f.changes.bindExecution(
        f.maker,
        f.scope(),
        r.refund,
        e.intent,
        key,
        'Bind exact refund',
      );
      expect(
        await f.changes.bindExecution(
          f.maker,
          f.scope(),
          r.refund,
          e.intent,
          key,
          'Retry exact binding',
        ),
      ).toMatchObject({ reused: true });
      await f.reserveCash(e as any);
      expect(f.provider.ledger).toHaveLength(0);
    }));
  it('PC11 records confirmed cash separately and requires bank reconciliation', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      const e = await f.refundExecution(r.refund);
      await f.reserveCash(e as any);
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Synthetic execution',
      );
      expect(
        await f.changes.reconcileRefund(
          f.checker,
          f.scope(),
          r.refund,
          randomUUID(),
          'Cash without bank',
        ),
      ).toMatchObject({
        state: 'UNRECONCILED_CASH_HELD',
        principal: '40.000000000000',
      });
      const bank = await f.bankEvidence(e as any);
      await f.outgoing.reconcile(
        f.checker,
        f.scope(),
        e.intent,
        bank,
        randomUUID(),
        'Independent bank match',
      );
      expect(
        await f.changes.reconcileRefund(
          f.checker,
          f.scope(),
          r.refund,
          randomUUID(),
          'Bank verified',
        ),
      ).toMatchObject({
        state: 'CONFIRMED_CASH_HELD',
        principal: '40.000000000000',
        fees: '1.000000000000',
        legalDischargeAccepted: false,
      });
    }));
  it('PC12 unknown cash retains refund capacity and cannot be cancelled', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      const e = await f.refundExecution(r.refund);
      await f.reserveCash(e as any);
      f.provider.timeout = true;
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Lost provider response',
      );
      expect(
        await f.changes.reconcileRefund(
          f.checker,
          f.scope(),
          r.refund,
          randomUUID(),
          'Unknown outcome',
        ),
      ).toMatchObject({ state: 'OUTCOME_UNKNOWN_HELD' });
      await expect(
        f.changes.reviewRefund(
          f.checker,
          f.scope(),
          r.refund,
          'CANCEL',
          randomUUID(),
          'Cannot release uncertain cash',
        ),
      ).rejects.toThrow('capacity');
    }));
  it('PC13 full reversal must invert the original component vector', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        base = f.nextChange(c, {
          effect: 'REVERSAL',
          correctionOf: { id: c.change.id, hash: c.change.hash },
          additionalPremium: '60',
          returnPremium: '0',
          taxDifference: '9',
          taxLines: [
            {
              code: 'SYNTHETIC-TAX',
              kind: 'TAX',
              amount: '8',
              ruleHash: '3'.repeat(64),
            },
            {
              code: 'SYNTHETIC-LEVY',
              kind: 'LEVY',
              amount: '1',
              ruleHash: '4'.repeat(64),
            },
          ],
          feeDifference: '1',
          commissionDifference: '3',
        }),
        bad = await f.observeChange(base);
      await expect(f.reviewChange(bad)).rejects.toThrow(
        'exact original component',
      );
      const fixed = await f.observeChange({
        ...base,
        sourceRevision: 2,
        commissionDifference: '2',
      });
      await f.reviewChange(fixed);
      expect(
        (await f.changes.readChange(f.checker, f.scope(), fixed)).entitlement,
      ).toBe('0.000000000000');
    }));
  it('PC14 late adjustments preserve consumed refunds and expose negative capacity', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      const e = await f.refundExecution(r.refund);
      await f.reserveCash(e as any);
      const next = await f.observeChange(
        f.nextChange(c, {
          effect: 'ADJUSTMENT',
          correctionOf: { id: c.change.id, hash: c.change.hash },
          additionalPremium: '30',
          returnPremium: '0',
          taxDifference: '0',
          taxLines: [],
          feeDifference: '0',
          commissionDifference: '0',
        }),
      );
      await f.reviewChange(next);
      expect(
        await f.changes.readChange(f.checker, f.scope(), next),
      ).toMatchObject({
        entitlement: '30.000000000000',
        refundReserved: '40.000000000000',
        entitlementAvailable: '-10.000000000000',
      });
      await expect(
        f.outgoing.dispatch(
          f.maker,
          f.scope(),
          e.intent,
          'SUBMIT',
          'Stale payment blocked',
        ),
      ).rejects.toThrow('stale');
      expect(f.provider.ledger).toHaveLength(0);
    }));
  it('PC15 bound executions cannot exceed the approved refund', async () =>
    db(async (f) => {
      const c = await f.readyChange(),
        r = await f.prepareRefund(c);
      await f.approveRefund(r.refund);
      await f.refundExecution(r.refund, '30');
      await expect(f.refundExecution(r.refund, '20')).rejects.toThrow('exceed');
    }));
  it('PC16 populated controls refuse down migration and all control rows require audit', async () =>
    db(async (f) => {
      const c = await f.preparedChange(),
        q = f.source.createQueryRunner();
      try {
        await expect(
          new FinancePolicyChangeControls1797600000000().down(q),
        ).rejects.toThrow('retained');
      } finally {
        await q.release();
      }
      const [old] = await f.source.query(
          'SELECT * FROM finance_policy_change_aliases LIMIT 1',
        ),
        row = { ...old, id: randomUUID(), inbox_id: randomUUID() };
      row.subject_hash = hash(row.subject);
      row.canonical_subject = canonicalFinanceJson(row.subject);
      await expect(
        f.source.query(
          'INSERT INTO finance_policy_change_aliases SELECT (jsonb_populate_record(NULL::finance_policy_change_aliases,$1::jsonb)).*',
          [JSON.stringify(row)],
        ),
      ).rejects.toThrow();
      expect(c.change.financialEffects).toBe(0);
    }));
});
