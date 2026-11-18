import { randomUUID } from 'node:crypto';
import { withClaimsDatabase as db } from '../support/finance-claims-fixture';
import { withCommissionDatabase } from '../support/finance-commission-fixture';
import { FinanceClaimsControls1797900000000 } from '../../src/database/migrations/1797900000000-FinanceClaimsControls';
import { sealClaimsSource } from '../../src/modules/tenant/billing-commission/foundation/finance-claims.types';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
} from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
describe('B18 inactive claims obligations, payments and recoveries', () => {
  it('CL30 new cash is held until legacy instruction consumption reconciles to the case baseline', async () =>
    db(async (f) => {
      const c = await f.readyCase(),
        p = await f.payable(c, { legacyPaid: '30' });
      expect(
        await f.claims.read(f.checker, f.scope(), p.control),
      ).toMatchObject({
        paymentHeld: true,
        holds: expect.arrayContaining([
          'LEGACY_CLAIM_BASELINE_RECONCILIATION_REQUIRED',
        ]),
      });
      await expect(f.claimSettlement(p, '10')).rejects.toThrow('held');
      const revisedCase = await f.nextClaim(c.caseSnapshot, c.caseControl, {
        paidIndemnity: '30',
        caseOutstanding: '70',
      });
      const { source, ...base } = p.payableSnapshot;
      void source;
      const revised = sealClaimsSource(
        {
          ...base,
          sourceRevision: 2,
          previous: { id: p.control.id, hash: p.control.hash },
          caseRef: {
            id: revisedCase.control.id,
            hash: revisedCase.control.hash,
          },
        },
        { syntheticReconciledBaseline: true },
      );
      const control = await f.observeClaim(revised);
      await f.reviewClaim(control);
      expect(await f.claims.read(f.checker, f.scope(), control)).toMatchObject({
        paymentHeld: false,
        available: '50.000000000000',
      });
      await f.claimSettlement(
        { ...p, control, payableSnapshot: revised },
        '10',
      );
    }));
  it('CL29 review limits cover actual legacy consumption above a reduced entitlement', async () =>
    db(async (f) => {
      const c = await f.readyCase(),
        p = await f.payable(c, { amount: '20', legacyPaid: '30' }, false);
      await f.source.query(
        "UPDATE finance_claim_authorities SET max_amount=25 WHERE subject_id=$1 AND permission='REVIEW_CLAIM'",
        [f.checker.subjectId],
      );
      await expect(f.reviewClaim(p.control)).rejects.toThrow('authority');
    }));
  it('CL27 case review limits cover admitted and offered amounts as well as the case estimate', async () =>
    db(async (f) => {
      const c = await f.preparedCase({
        caseEstimateIncludingPaid: '40',
        caseOutstanding: '40',
        approvedLimit: '100',
        acceptedOffer: '80',
      });
      await f.source.query(
        "UPDATE finance_claim_authorities SET max_amount=50 WHERE subject_id=$1 AND permission='REVIEW_CLAIM'",
        [f.checker.subjectId],
      );
      await expect(f.reviewClaim(c.caseControl)).rejects.toThrow('authority');
    }));
  it('CL28 direct recovery allocations cannot bypass shared receipt capacity or mandatory audit', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase(), { expected: '200' });
      await f.assign(r, '80');
      const a = await f.allocateRecovery(r, '30'),
        [old] = await f.source.query(
          'SELECT * FROM finance_claim_recovery_receipts WHERE id=$1',
          [a.ref.id],
        );
      const copy = (value: string, audit: boolean) =>
        f.source.transaction(async (m) => {
          const row = {
            ...old,
            id: randomUUID(),
            command_key: randomUUID(),
            amount: value,
          };
          row.subject = {
            ...row.subject,
            plan: {
              ...row.subject.plan,
              commandKey: row.command_key,
              amount: value,
            },
          };
          row.subject_hash = hash(row.subject);
          row.canonical_subject = canonicalFinanceJson(row.subject);
          await m.query(
            'INSERT INTO finance_claim_recovery_receipts SELECT (jsonb_populate_record(NULL::finance_claim_recovery_receipts,$1::jsonb)).*',
            [JSON.stringify(row)],
          );
          if (audit)
            await m.query(
              "INSERT INTO finance_claim_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,'finance_claim_recovery_receipts',$4,'PREPARE_RECOVERY',$5,$6,$7,'Synthetic bypass probe')",
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
      await expect(copy('10', true)).rejects.toThrow('shared receipt capacity');
      await expect(copy('5', false)).rejects.toThrow('audit');
    }));
  it('CL01 empty controls roll back without changing B17', async () =>
    withCommissionDatabase(async (f) => {
      const q = f.source.createQueryRunner();
      try {
        const m = new FinanceClaimsControls1797900000000();
        await m.up(q);
        await m.down(q);
        expect(
          (
            await q.query(
              "SELECT to_regclass('finance_claim_records') n,to_regclass('finance_commission_movements') p",
            )
          )[0],
        ).toEqual({ n: null, p: 'finance_commission_movements' });
      } finally {
        await q.release();
      }
    }));
  it('CL02 case paid, ultimate and signed outstanding remain distinct from unknown measurement', async () =>
    db(async (f) => {
      const c = await f.readyCase({
        paidIndemnity: '70',
        paidExpenses: '10',
        caseEstimateIncludingPaid: '75',
        caseOutstanding: '-5',
      });
      expect(
        await f.claims.read(f.checker, f.scope(), c.caseControl),
      ).toMatchObject({
        components: {
          paidIndemnity: '70.000000000000',
          paidExpenses: '10.000000000000',
          caseOutstanding: '-5.000000000000',
          ibnr: null,
        },
        measurement: {
          state: 'MEASUREMENT_COMPONENTS_UNRESOLVED',
          remainingMeasurementDelta: null,
          postingEffects: 0,
        },
        recoveryNettingEffects: 0,
      });
    }));
  it('CL03 delivery aliases and identical higher revisions cannot create another payable', async () =>
    db(async (f) => {
      const p = await f.payable(await f.readyCase());
      const retry = await f.observeClaim(p.payableSnapshot);
      expect(retry.id).toBe(p.control.id);
      const alias = await f.observeClaim({
        ...p.payableSnapshot,
        sourceRevision: 2,
      });
      expect(alias.id).toBe(p.control.id);
      expect(
        await f.claims.read(f.checker, f.scope(), p.control),
      ).toMatchObject({ payable: '80.000000000000' });
    }));
  it('CL04 changed accepted evidence without its exact previous head is held as conflict', async () =>
    db(async (f) => {
      const p = await f.payable(await f.readyCase()),
        { source, ...base } = p.payableSnapshot;
      void source;
      const changed = sealClaimsSource(
        {
          ...base,
          sourceRevision: 2,
          data: { ...base.data, amount: '90' },
        },
        { syntheticBadRevision: true },
      );
      expect((await f.observeClaim(changed)).sourceState).toBe('CONFLICT_HELD');
      await expect(f.claimSettlement(p)).rejects.toThrow('held');
    }));
  it('CL05 legitimate revised entitlement preserves consumed reservations and negative capacity', async () =>
    db(async (f) => {
      const p = await f.payable(await f.readyCase()),
        r = await f.claimSettlement(p, '60');
      await f.approveClaim(r.ref);
      const next = await f.nextClaim(p.payableSnapshot, p.control, {
        amount: '40',
      });
      expect(
        await f.claims.read(f.checker, f.scope(), next.control),
      ).toMatchObject({
        available: '-20.000000000000',
        paymentHeld: true,
        reserved: '60.000000000000',
      });
      await expect(f.claimExecution(r.ref, '60')).rejects.toThrow(
        /stale|entitlement/,
      );
    }));
  it('CL06 multiple claimant instructions share one admitted and accepted-offer cap', async () =>
    db(async (f) => {
      const c = await f.readyCase(),
        a = await f.payable(c),
        b = await f.payable(c);
      await f.claimSettlement(a, '70');
      await expect(f.claimSettlement(b, '40')).rejects.toThrow('insufficient');
      await f.claimSettlement(b, '30');
    }));
  it('CL07 concurrent reservations cannot exceed shared claim capacity', async () =>
    db(async (f) => {
      const c = await f.readyCase(),
        a = await f.payable(c),
        b = await f.payable(c);
      const results = await Promise.allSettled([
        f.claimSettlement(a, '70'),
        f.claimSettlement(b, '70'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    }));
  it('CL08 accepted offer and legacy paid/reserved consume claim headroom once', async () =>
    db(async (f) => {
      const p = await f.payable(
        await f.readyCase({
          approvedLimit: '100',
          acceptedOffer: '80',
          paidIndemnity: '20',
          legacyReserved: '10',
          caseOutstanding: '80',
        }),
      );
      await expect(f.claimSettlement(p, '51')).rejects.toThrow('insufficient');
      await f.claimSettlement(p, '50');
    }));
  it('CL09 an unreviewed new case revision holds existing payment requests immediately', async () =>
    db(async (f) => {
      const c = await f.readyCase(),
        p = await f.payable(c),
        r = await f.claimSettlement(p);
      await f.approveClaim(r.ref);
      await f.nextClaim(
        c.caseSnapshot,
        c.caseControl,
        { approvedLimit: '30', acceptedOffer: '30' },
        false,
      );
      await expect(f.claimExecution(r.ref)).rejects.toThrow(
        /stale|entitlement/,
      );
    }));
  it('CL10 another book or policy cannot take a claim economic identity', async () =>
    db(async (f) => {
      const c = await f.readyCase();
      await expect(f.observeClaim(c.caseSnapshot, 1)).rejects.toThrow(
        /scope|identity/,
      );
      const { source, ...base } = c.caseSnapshot;
      void source;
      await expect(
        f.observeClaim(
          sealClaimsSource(
            { ...base, sourceRevision: 2, policyId: randomUUID() },
            {},
          ),
        ),
      ).rejects.toThrow('identity');
    }));
  it('CL11 makers, natural-person aliases and revoked authority cannot approve evidence', async () =>
    db(async (f) => {
      const c = await f.preparedCase();
      await expect(
        f.claims.review(
          f.maker,
          f.scope(),
          c.caseControl,
          'REVIEWED_INACTIVE',
          'Self review',
        ),
      ).rejects.toThrow('Independent');
      const alias = { ...f.checker, naturalPersonId: f.maker.naturalPersonId };
      await f.claimGrant(alias, 'REVIEW_CLAIM');
      await expect(
        f.claims.review(
          alias,
          f.scope(),
          c.caseControl,
          'REVIEWED_INACTIVE',
          'Alias review',
        ),
      ).rejects.toThrow('Independent');
      await f.source.query(
        "UPDATE finance_claim_authorities SET state='REVOKED' WHERE subject_id=$1 AND permission='REVIEW_CLAIM'",
        [f.checker.subjectId],
      );
      await expect(f.reviewClaim(c.caseControl)).rejects.toThrow('authority');
    }));
  it('CL12 missing payment tax evidence is unresolved and legacy writer ownership blocks cash', async () =>
    db(async (f) => {
      const c = await f.readyCase(),
        unknown = await f.payable(c, { taxEvidenceHash: null }, false);
      await expect(f.reviewClaim(unknown.control)).rejects.toThrow(
        'unresolved',
      );
      const legacy = await f.payable(c, {
        writer: 'LEGACY_ACTIVE',
        writerEvidenceHash: null,
      });
      await expect(f.claimSettlement(legacy)).rejects.toThrow('held');
    }));
  it('CL13 signed B15 candidate still requires exact execution binding before cash reservation', async () =>
    db(async (f) => {
      const p = await f.payable(await f.readyCase()),
        r = await f.claimSettlement(p);
      await f.approveClaim(r.ref);
      const e = await f.claimExecution(r.ref, '40', false);
      await expect(
        f.outgoing.reserve(
          f.maker,
          f.scope(),
          e.intent,
          randomUUID(),
          'Unbound claim cash',
        ),
      ).rejects.toThrow('Claim cash');
      await f.claims.bindExecution(
        f.maker,
        f.scope(),
        r.ref,
        e.intent,
        randomUUID(),
        'Exact claim binding',
      );
      await f.reserveCash(e);
    }));
  it('CL14 actual principal and fee reconcile separately without another claim expense', async () =>
    db(async (f) => {
      const p = await f.payable(await f.readyCase()),
        r = await f.claimSettlement(p);
      await f.approveClaim(r.ref);
      const e = await f.claimExecution(r.ref);
      await f.reserveCash(e);
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Synthetic claim disbursement',
      );
      expect(
        await f.claims.reconcileSettlement(
          f.checker,
          f.scope(),
          r.ref,
          randomUUID(),
          'Observe actual cash',
        ),
      ).toMatchObject({
        state: 'UNRECONCILED_CASH_HELD',
        principal: '40.000000000000',
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
        'Signed bank match',
      );
      expect(
        await f.claims.reconcileSettlement(
          f.checker,
          f.scope(),
          r.ref,
          randomUUID(),
          'Reconcile bank cash',
        ),
      ).toMatchObject({ state: 'CONFIRMED_CASH_HELD', financialEffects: 0 });
      expect(
        await f.claims.read(f.checker, f.scope(), p.control),
      ).toMatchObject({ settlementExpenseEffects: 0 });
    }));
  it('CL15 timeout and late case reduction retain cash and allow only original-key recovery', async () =>
    db(async (f) => {
      const c = await f.readyCase(),
        p = await f.payable(c),
        r = await f.claimSettlement(p);
      await f.approveClaim(r.ref);
      const e = await f.claimExecution(r.ref);
      await f.reserveCash(e);
      f.provider.timeout = true;
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Lost provider response',
      );
      await f.nextClaim(c.caseSnapshot, c.caseControl, {
        approvedLimit: '20',
        acceptedOffer: '20',
      });
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'QUERY',
        'Recover original truth',
      );
      expect(f.provider.ledger.map((r) => r.operation)).toEqual([
        'SUBMIT',
        'QUERY',
      ]);
      expect(
        await f.claims.reconcileSettlement(
          f.checker,
          f.scope(),
          r.ref,
          randomUUID(),
          'Retain overpaid truth',
        ),
      ).toMatchObject({
        state: 'EXCEPTION_HELD',
        principal: '40.000000000000',
      });
    }));
  it('CL16 confirmed cash cannot release its approved settlement capacity', async () =>
    db(async (f) => {
      const p = await f.payable(await f.readyCase()),
        r = await f.claimSettlement(p);
      await f.approveClaim(r.ref);
      const e = await f.claimExecution(r.ref);
      await f.reserveCash(e);
      await f.outgoing.dispatch(
        f.maker,
        f.scope(),
        e.intent,
        'SUBMIT',
        'Confirmed synthetic claim',
      );
      await expect(
        f.claims.reviewSettlement(
          f.checker,
          f.scope(),
          r.ref,
          'CANCEL',
          randomUUID(),
          'Cannot cancel paid cash',
        ),
      ).rejects.toThrow('capacity');
    }));
  it('CL17 legal salvage recovery allocates a confirmed B14 receipt independently', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase()),
        a = await f.allocateRecovery(r);
      await f.reviewRecovery(a.ref);
      expect(
        await f.claims.read(f.checker, f.scope(), r.control),
      ).toMatchObject({
        available: '30.000000000000',
        reserved: '20.000000000000',
        legalRecognitionEffects: 0,
        reinsuranceNettingEffects: 0,
      });
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            r.observed.receiptId,
          )
        ).claimRecoveryReserved,
      ).toBe('20.000000000000');
    }));
  it('CL18 unresolved or disputed rights and reinsurance recoveries cannot be accepted', async () =>
    db(async (f) => {
      const c = await f.readyCase();
      for (const override of [
        { legalStatus: 'UNRESOLVED' as const, legalEvidenceHash: null },
        { legalStatus: 'DISPUTED' as const },
        { type: 'REINSURANCE' as const },
      ]) {
        const r = await f.recovery(c, override, false);
        await expect(f.reviewClaim(r.control)).rejects.toThrow('unresolved');
      }
    }));
  it('CL19 a different debtor or currency cannot consume the source receipt', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase(), {
        debtorId: randomUUID(),
      });
      await expect(f.allocateRecovery(r)).rejects.toThrow(/debtor|receipt/);
    }));
  it('CL20 recovery receipts and premium allocations share capacity in both directions', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase());
      await f.assign(r, '100');
      await expect(f.allocateRecovery(r, '20')).rejects.toThrow('capacity');
      const a = await f.allocateRecovery(r, '18');
      await f.reviewRecovery(a.ref);
      await expect(f.assign(r, '1')).rejects.toThrow(
        /capacity|cash|enough|availab|insufficient/i,
      );
    }));
  it('CL21 pending recoveries reserve capacity before review and cannot over-receive', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase());
      await f.allocateRecovery(r, '40');
      await expect(f.allocateRecovery(r, '11')).rejects.toThrow('capacity');
      await f.allocateRecovery(r, '10');
    }));
  it('CL22 a late reduction below allocated receipts exposes negative recovery headroom', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase()),
        a = await f.allocateRecovery(r, '40');
      await f.reviewRecovery(a.ref);
      const revised = await f.nextClaim(r.recoverySnapshot, r.control, {
        expected: '30',
      });
      expect(
        await f.claims.read(f.checker, f.scope(), revised.control),
      ).toMatchObject({
        available: '-10.000000000000',
        allocationHeld: true,
        reserved: '40.000000000000',
      });
    }));
  it('CL23 independent reversal releases allocation without reversing bank cash or native recovery', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase()),
        a = await f.allocateRecovery(r);
      await f.reviewRecovery(a.ref);
      expect(await f.reviewRecovery(a.ref, 'REVERSE')).toMatchObject({
        bankReceiptReversed: false,
        legacyRecoveryWritten: false,
      });
      expect(
        await f.claims.read(f.checker, f.scope(), r.control),
      ).toMatchObject({ available: '50.000000000000' });
      await expect(f.reviewRecovery(a.ref, 'REVERSE')).rejects.toThrow('once');
    }));
  it('CL24 makers cannot review their recovery allocation and retries cannot change amounts', async () =>
    db(async (f) => {
      const r = await f.recovery(await f.readyCase()),
        a = await f.allocateRecovery(r);
      await expect(
        f.claims.reviewRecoveryReceipt(
          f.maker,
          f.scope(),
          a.ref,
          'APPROVE',
          randomUUID(),
          'Self approval',
        ),
      ).rejects.toThrow('Independent');
      expect(
        (
          await f.claims.prepareRecoveryReceipt(
            f.maker,
            f.scope(),
            a.plan,
            'Unchanged retry',
          )
        ).id,
      ).toBe(a.ref.id);
      await expect(
        f.claims.prepareRecoveryReceipt(
          f.maker,
          f.scope(),
          { ...a.plan, amount: '21' },
          'Changed retry',
        ),
      ).rejects.toThrow('differs');
    }));
  it('CL25 populated rollback and audit mutation are forbidden', async () =>
    db(async (f) => {
      await f.readyCase();
      await expect(
        f.source.query("UPDATE finance_claim_audits SET reason='altered'"),
      ).rejects.toThrow('append-only');
      const q = f.source.createQueryRunner();
      try {
        await expect(
          new FinanceClaimsControls1797900000000().down(q),
        ).rejects.toThrow('retained');
      } finally {
        await q.release();
      }
    }));
  it('CL26 direct inserts cannot exceed shared admitted capacity or omit audit', async () =>
    db(async (f) => {
      const p = await f.payable(await f.readyCase()),
        r = await f.claimSettlement(p, '60'),
        [old] = await f.source.query(
          'SELECT * FROM finance_claim_settlements WHERE id=$1',
          [r.ref.id],
        );
      const copy = (value: string, audit: boolean) =>
        f.source.transaction(async (m) => {
          const row = {
            ...old,
            id: randomUUID(),
            command_key: randomUUID(),
            amount: value,
          };
          row.subject = {
            ...row.subject,
            plan: {
              ...row.subject.plan,
              commandKey: row.command_key,
              amount: value,
            },
          };
          row.subject_hash = hash(row.subject);
          row.canonical_subject = canonicalFinanceJson(row.subject);
          await m.query(
            'INSERT INTO finance_claim_settlements SELECT (jsonb_populate_record(NULL::finance_claim_settlements,$1::jsonb)).*',
            [JSON.stringify(row)],
          );
          if (audit)
            await m.query(
              "INSERT INTO finance_claim_audits(tenant_id,legal_entity_id,book_id,object_table,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,'finance_claim_settlements',$4,'PREPARE_SETTLEMENT',$5,$6,$7,'Synthetic bypass probe')",
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
      await expect(copy('30', true)).rejects.toThrow(/capacity|payable/);
    }));
});
