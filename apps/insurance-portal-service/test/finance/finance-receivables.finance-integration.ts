import { randomUUID } from 'node:crypto';
import { withReceivableDatabase } from '../support/finance-receivables-fixture';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import { FinanceReceivableControls1797000000000 } from '../../src/database/migrations/1797000000000-FinanceReceivableControls';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import type { TermsEvidence } from '../../src/modules/tenant/billing-commission/foundation/finance-receivables.types';
const db = withReceivableDatabase;
describe('B14 inactive receipt ownership, assignment, ageing and reconciliation on owned PostgreSQL', () => {
  it('RC01 creates only empty registries and safely rolls an unused migration back', async () => {
    await withFinanceTestDatabase(
      async ({ dataSource: s }) => {
        const q = s.createQueryRunner();
        try {
          const migration = new FinanceReceivableControls1797000000000();
          await migration.up(q);
          expect(
            (
              await s.query(
                'SELECT count(*)::integer AS n FROM finance_confirmed_receipts',
              )
            )[0].n,
          ).toBe(0);
          await migration.down(q);
          expect(
            (
              await s.query(
                "SELECT to_regclass('public.finance_confirmed_receipts') AS t",
              )
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
  it('RC02 preserves confirmed cash, bank fees and accounting holds without GL tables', async () => {
    await db(async (f) => {
      const c = await f.observe(),
        p = await f.receivables.readReceipt(
          f.checker,
          f.scope(),
          c.observed.receiptId!,
        );
      expect(p).toMatchObject({
        received: '118.000000000000',
        bankSettled: '116.000000000000',
        bankFee: '2.000000000000',
        available: '118.000000000000',
        accountingState: 'HELD_INACTIVE',
        financialEffects: 0,
      });
      expect(
        (
          await f.source.query(
            "SELECT to_regclass('finance_journal_entries') AS t",
          )
        )[0].t,
      ).toBeNull();
    });
  });
  it('RC03 deduplicates source retries and original aliases by bank economic identity', async () => {
    await db(async (f) => {
      const c = await f.observe();
      expect(
        (
          await f.receivables.observeReceipt(
            f.maker,
            f.scope(),
            c.accepted.input(),
            'exact retry',
          )
        ).reused,
      ).toBe(true);
      const alias = await f.observe({ ...c.snap, id: randomUUID() });
      expect(alias.observed).toMatchObject({
        state: 'ALIASED',
        receiptId: c.observed.receiptId,
      });
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_confirmed_receipts',
          )
        )[0].n,
      ).toBe(1);
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).available,
      ).toBe('118.000000000000');
    });
  });
  it('RC04 retains the original confirmed receipt when a source alias conflicts', async () => {
    await db(async (f) => {
      const c = await f.ready();
      const alias = await f.observe({
        ...c.snap,
        id: randomUUID(),
        received: '120',
        bankSettled: '118',
      });
      expect(alias.observed.state).toBe('CONFLICT_HELD');
      const p = await f.receivables.readReceipt(
        f.checker,
        f.scope(),
        c.observed.receiptId!,
      );
      expect(p.received).toBe('118.000000000000');
      expect(p.sourceConflicts).toBe(1);
      await expect(f.assign(c)).rejects.toThrow('availability');
    });
  });
  it.each(['sourceAccountId', 'currency', 'decimalScale'])(
    'RC05 rejects undeclared receipt ownership/currency/scale: %s',
    async (key) => {
      await db(async (f) => {
        const snap: any = f.receipt();
        snap[key] =
          key === 'sourceAccountId'
            ? randomUUID()
            : key === 'currency'
              ? 'EUR'
              : 3;
        await expect(f.observe(snap)).rejects.toThrow('ownership');
        expect(
          (
            await f.source.query(
              'SELECT count(*)::integer AS n FROM finance_confirmed_receipts',
            )
          )[0].n,
        ).toBe(0);
        expect(
          (
            await f.source.query(
              'SELECT count(*)::integer AS n FROM finance_integration_inboxes',
            )
          )[0].n,
        ).toBe(2);
      });
    },
  );
  it('RC06 reserves pending capacity, applies independent partial assignments and releases only reviewed reversals', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c);
      let p = await f.receivables.readReceipt(
        f.checker,
        f.scope(),
        c.observed.receiptId!,
      );
      expect(p).toMatchObject({
        pending: '50.000000000000',
        assigned: '0.000000000000',
        available: '68.000000000000',
      });
      await f.review(a);
      const rev = await f.receivables.proposeAssignment(
        f.maker,
        f.scope(),
        {
          ...f.profile(),
          commandKey: randomUUID(),
          receiptId: c.observed.receiptId!,
          memoId: c.bill.memo.id,
          memoHash: c.bill.memo.hash,
          amount: '20',
          originalId: a.id,
        },
        'partial unassignment',
      );
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).available,
      ).toBe('68.000000000000');
      await f.review(rev);
      p = await f.receivables.readReceipt(
        f.checker,
        f.scope(),
        c.observed.receiptId!,
      );
      expect(p).toMatchObject({
        assigned: '30.000000000000',
        pending: '0.000000000000',
        available: '88.000000000000',
      });
      await expect(
        f.receivables.proposeAssignment(
          f.maker,
          f.scope(),
          {
            ...f.profile(),
            commandKey: randomUUID(),
            receiptId: c.observed.receiptId!,
            memoId: c.bill.memo.id,
            memoHash: c.bill.memo.hash,
            amount: '31',
            originalId: a.id,
          },
          'over reversal',
        ),
      ).rejects.toThrow('exceed');
    });
  });
  it('RC07 serializes competing consumption of one receipt across independent transactions', async () => {
    await db(async (f) => {
      const c = await f.ready();
      const results = await Promise.allSettled([
        f.assign(c, '100'),
        f.assign(c, '100'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).available,
      ).toBe('18.000000000000');
    });
  });
  it('RC08 prevents two receipts from consuming the same billing capacity', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        snap = { ...f.receipt(), customerId: c.snap.customerId },
        second = await f.observe(snap);
      const other = { ...c, ...second };
      const results = await Promise.allSettled([
        f.assign(c, '80'),
        f.assign(other, '80'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (
          await f.receivables.readBillingAgeing(f.checker, f.scope(), {
            ...f.profile(),
            memoId: c.bill.memo.id,
            asOf: '2026-11-15',
          })
        ).available,
      ).toBe('38.000000000000');
    });
  });
  it('RC09 rejects cross-customer assignments while retaining the confirmed cash', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        foreign = await f.observe();
      await expect(f.assign({ ...c, ...foreign })).rejects.toThrow(
        'owner, customer',
      );
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            foreign.observed.receiptId!,
          )
        ).received,
      ).toBe('118.000000000000');
    });
  });
  it('RC10 enforces natural-person independence despite subject aliases', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c),
        alias = { ...f.maker, subjectId: randomUUID() };
      await f.receivableGrant(alias, 'REVIEW_ASSIGNMENT');
      await expect(
        f.receivables.reviewInactive(
          alias,
          f.scope(),
          a,
          'REVIEWED_INACTIVE',
          'same person alias',
        ),
      ).rejects.toThrow('independent');
      await expect(
        f.receivables.reconcile(
          f.maker,
          f.scope(),
          {
            commandKey: randomUUID(),
            receiptId: c.observed.receiptId!,
            positionHash: (
              await f.receivables.readReceipt(
                f.checker,
                f.scope(),
                c.observed.receiptId!,
              )
            ).hash,
            statementHash: 'e'.repeat(64),
            received: '118',
            bankSettled: '116',
            bankFee: '2',
          },
          'self reconciliation',
        ),
      ).rejects.toThrow('cannot reconcile');
      const aliasSource = await f.postEvidence({ ...c.snap, id: randomUUID() });
      await f.receivables.observeReceipt(
        f.checker,
        f.scope(),
        aliasSource.input(),
        'checker prepared an alias',
      );
      const position = await f.receivables.readReceipt(
        f.checker,
        f.scope(),
        c.observed.receiptId!,
      );
      await expect(
        f.receivables.reconcile(
          f.checker,
          f.scope(),
          {
            commandKey: randomUUID(),
            receiptId: c.observed.receiptId!,
            positionHash: position.hash,
            statementHash: 'e'.repeat(64),
            received: '118',
            bankSettled: '116',
            bankFee: '2',
          },
          'alias observer self reconciliation',
        ),
      ).rejects.toThrow('cannot reconcile');
    });
  });
  it('RC11 blocks revoked makers from positive review while allowing independent rejection to release a hold', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c);
      await f.source.query(
        "UPDATE finance_receivable_authorities SET state='REVOKED' WHERE subject_id=$1 AND permission='PREPARE_ASSIGNMENT'",
        [f.maker.subjectId],
      );
      await expect(f.review(a)).rejects.toThrow('authority');
      await f.review(a, 'REJECTED_INACTIVE');
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).available,
      ).toBe('118.000000000000');
    });
  });
  it('RC12 rolls back a command if authority expires during mandatory audit', async () => {
    await db(async (f) => {
      const c = await f.ready();
      await f.source.query(
        `CREATE FUNCTION expire_receivable_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.object_kind='REQUEST' THEN UPDATE finance_receivable_authorities SET revoked_at=statement_timestamp() WHERE subject_id=NEW.actor_subject_id AND permission='PREPARE_ASSIGNMENT';END IF;RETURN NEW;END $$`,
      );
      await f.source.query(
        'CREATE TRIGGER expire_grant BEFORE INSERT ON finance_receivable_audits FOR EACH ROW EXECUTE FUNCTION expire_receivable_grant()',
      );
      await expect(f.assign(c)).rejects.toThrow('expired');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_receivable_requests',
          )
        )[0].n,
      ).toBe(0);
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).received,
      ).toBe('118.000000000000');
    });
  });
  it('RC13 audit failure rolls back new records without undoing the accepted source confirmation reference', async () => {
    await db(async (f) => {
      const snap = f.receipt(),
        accepted = await f.postEvidence(snap);
      await f.source.query(
        "CREATE FUNCTION reject_rc_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic mandatory audit failure';END $$",
      );
      await f.source.query(
        'CREATE TRIGGER reject_rc_audit BEFORE INSERT ON finance_receivable_audits FOR EACH ROW EXECUTE FUNCTION reject_rc_audit()',
      );
      await expect(
        f.receivables.observeReceipt(
          f.maker,
          f.scope(),
          accepted.input(),
          'audit failure',
        ),
      ).rejects.toThrow('mandatory audit');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_confirmed_receipts',
          )
        )[0].n,
      ).toBe(0);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_integration_inboxes',
          )
        )[0].n,
      ).toBe(2);
    });
  });
  it('RC14 ages from independently reviewed signed due dates and never invents credit terms', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        view = () =>
          f.receivables.readBillingAgeing(f.checker, f.scope(), {
            ...f.profile(),
            memoId: c.bill.memo.id,
            asOf: '2026-11-15',
          });
      expect((await view()).bucket).toBe('DUE_DATE_EVIDENCE_REQUIRED');
      const terms: TermsEvidence = {
        schema: 'FINANCE_RECEIVABLE_EVIDENCE_V1',
        kind: 'BILLING_DUE_DATE',
        id: randomUUID(),
        sourceRevision: 1,
        sourceCompanyId: f.companyId,
        memoId: c.bill.memo.id,
        memoHash: c.bill.memo.hash,
        invoiceId: c.bill.snapshot.invoiceId!,
        customerId: c.snap.customerId,
        currency: 'USD',
        decimalScale: 2,
        dueDate: '2026-10-15',
      };
      const accepted = await f.postEvidence(terms),
        input = { ...accepted.input(), commandKey: randomUUID() };
      const request = await f.receivables.prepareTerms(
        f.maker,
        f.scope(),
        input,
        'evidenced due date',
      );
      expect(
        (
          await f.receivables.prepareTerms(
            f.maker,
            f.scope(),
            input,
            'exact terms retry',
          )
        ).id,
      ).toBe(request.id);
      expect((await view()).bucket).toBe('DUE_DATE_EVIDENCE_REQUIRED');
      await f.review(request);
      expect(await view()).toMatchObject({
        dueDate: '2026-10-15',
        daysPastDue: 31,
        bucket: 'UP_TO_60',
        legalReceivableScope: 'UNASSIGNED_HELD',
      });
    });
  });
  it('RC15 records independent statement reconciliation and exposes stale evidence after new consumption', async () => {
    await db(async (f) => {
      const c = await f.ready();
      const pos = await f.receivables.readReceipt(
          f.checker,
          f.scope(),
          c.observed.receiptId!,
        ),
        input = {
          commandKey: randomUUID(),
          receiptId: c.observed.receiptId!,
          positionHash: pos.hash,
          statementHash: 'f'.repeat(64),
          received: '118',
          bankSettled: '116',
          bankFee: '2',
        };
      const r = await f.receivables.reconcile(
        f.checker,
        f.scope(),
        input,
        'independent statement check',
      );
      expect(r).toMatchObject({ state: 'MATCHED_HELD', financialEffects: 0 });
      await f.assign(c, '20');
      const next = await f.receivables.readReceipt(
        f.checker,
        f.scope(),
        c.observed.receiptId!,
      );
      expect(next.reconciliations[0].stale).toBe(true);
      expect(
        (
          await f.receivables.reconcile(
            f.checker,
            f.scope(),
            input,
            'historical receipt',
          )
        ).reused,
      ).toBe(true);
      await expect(
        f.receivables.reconcile(
          f.checker,
          f.scope(),
          { ...input, commandKey: randomUUID() },
          'stale check',
        ),
      ).rejects.toThrow('position changed');
    });
  });
  it('RC16 retains an owned reconciliation exception instead of forcing a bank match', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        pos = await f.receivables.readReceipt(
          f.checker,
          f.scope(),
          c.observed.receiptId!,
        );
      const result = await f.receivables.reconcile(
        f.checker,
        f.scope(),
        {
          commandKey: randomUUID(),
          receiptId: c.observed.receiptId!,
          positionHash: pos.hash,
          statementHash: 'd'.repeat(64),
          received: '118',
          bankSettled: '115',
          bankFee: '2',
        },
        'unresolved bank difference',
      );
      expect(result.state).toBe('EXCEPTION_HELD');
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).received,
      ).toBe('118.000000000000');
    });
  });
  it('RC17 consumes explicit legacy allocations, refunds and reservations once', async () => {
    await db(async (f) => {
      const bill = await f.billing(),
        snap = {
          ...f.receipt(),
          customerId: bill.snapshot.customerId,
          legacyAllocated: '10',
          legacyRefunded: '20',
          legacyReserved: '30',
        },
        c = { ...(await f.observe(snap)), bill };
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).available,
      ).toBe('58.000000000000');
      await expect(f.assign(c, '59')).rejects.toThrow('availability');
    });
  });
  it('RC18 preserves negative source gaps without clamping or erasing confirmed cash', async () => {
    await db(async (f) => {
      const bill = await f.billing(),
        snap = {
          ...f.receipt(),
          customerId: bill.snapshot.customerId,
          legacyAllocated: '150',
        },
        c = { ...(await f.observe(snap)), bill };
      const p = await f.receivables.readReceipt(
        f.checker,
        f.scope(),
        c.observed.receiptId!,
      );
      expect(p).toMatchObject({
        received: '118.000000000000',
        available: '-32.000000000000',
      });
      expect(p.holds).toContain('NEGATIVE_CAPACITY_RECONCILIATION_REQUIRED');
      await expect(f.assign(c, '1')).rejects.toThrow('availability');
    });
  });
  it('RC19 enforces append-only cash, assignments and audit rows', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c);
      for (const [t, id] of [
        ['finance_confirmed_receipts', c.observed.receiptId],
        ['finance_receivable_requests', a.id],
      ])
        await expect(
          f.source.query(`DELETE FROM ${t} WHERE id=$1`, [id]),
        ).rejects.toThrow('append-only');
      await expect(
        f.source.query('TRUNCATE finance_receivable_audits'),
      ).rejects.toThrow('append-only');
    });
  });
  it('RC20 database conservation rejects an otherwise fully audited over-consumption', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c),
        [row] = await f.source.query(
          'SELECT * FROM finance_receivable_requests WHERE id=$1',
          [a.id],
        );
      const id = randomUUID(),
        key = randomUUID(),
        subject = {
          ...row.subject,
          commandKey: key,
          amount: '200.000000000000',
        };
      await expect(
        f.source.transaction(async (m) => {
          await m.query(
            'INSERT INTO finance_receivable_requests SELECT (jsonb_populate_record(NULL::finance_receivable_requests,to_jsonb(t)||$2::jsonb)).* FROM finance_receivable_requests t WHERE id=$1',
            [
              a.id,
              {
                id,
                command_key: key,
                amount: '200.000000000000',
                subject,
                subject_hash: hash(subject),
              },
            ],
          );
          await m.query(
            "INSERT INTO finance_receivable_audits(tenant_id,legal_entity_id,book_id,object_kind,object_id,action,subject_hash,actor_subject_id,actor_natural_person_id,reason) VALUES($1,$2,$3,'REQUEST',$4,'PREPARED_INACTIVE',$5,$6,$7,'synthetic database attack')",
            [
              f.tenantId,
              f.entity.id,
              f.books[0].id,
              id,
              hash(subject),
              f.maker.subjectId,
              f.maker.naturalPersonId,
            ],
          );
        }),
      ).rejects.toThrow('capacity');
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).available,
      ).toBe('68.000000000000');
    });
  });
  it('RC21 exact review retries do not repeat assignment effects', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c);
      const one = await f.review(a),
        two = await f.review(a);
      expect(two.decisionId).toBe(one.decisionId);
      expect(two.reused).toBe(true);
      await expect(f.review(a, 'REJECTED_INACTIVE')).rejects.toThrow(
        'another decision',
      );
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).assigned,
      ).toBe('50.000000000000');
    });
  });
  it('RC22 late billing reductions remain negative held positions and stale prior reconciliations', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c);
      await f.review(a);
      const pos = await f.receivables.readReceipt(
        f.checker,
        f.scope(),
        c.observed.receiptId!,
      );
      await f.receivables.reconcile(
        f.checker,
        f.scope(),
        {
          commandKey: randomUUID(),
          receiptId: c.observed.receiptId!,
          positionHash: pos.hash,
          statementHash: 'd'.repeat(64),
          received: '118',
          bankSettled: '116',
          bankFee: '2',
        },
        'before source change',
      );
      const later = JSON.parse(JSON.stringify(c.bill.snapshot));
      later.sourceRevision = 2;
      later.components.gross = '20';
      later.components.total = '20';
      later.lines[0].gross = '20';
      later.lines[0].total = '20';
      later.paymentReference!.amount = '20';
      const accepted = await f.post(later),
        memo = await f.billingService.prepareInactive(
          f.maker,
          f.scope(),
          accepted.input(),
          'late correction',
        );
      await f.billingService.reviewInactive(
        f.checker,
        f.scope(),
        memo,
        'REVIEWED_INACTIVE',
        'late independent review',
      );
      expect(
        await f.receivables.readBillingAgeing(f.checker, f.scope(), {
          ...f.profile(),
          memoId: memo.id,
          asOf: '2026-11-15',
        }),
      ).toMatchObject({ remaining: '-30.000000000000' });
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).reconciliations[0].stale,
      ).toBe(true);
      const rev = await f.receivables.proposeAssignment(
        f.maker,
        f.scope(),
        {
          ...f.profile(),
          commandKey: randomUUID(),
          receiptId: c.observed.receiptId!,
          memoId: c.bill.memo.id,
          memoHash: c.bill.memo.hash,
          amount: '15',
          originalId: a.id,
        },
        'partial correction',
      );
      await f.review(rev);
      expect(
        (
          await f.receivables.readBillingAgeing(f.checker, f.scope(), {
            ...f.profile(),
            memoId: memo.id,
            asOf: '2026-11-15',
          })
        ).remaining,
      ).toBe('-15.000000000000');
    });
  });
  it('RC23 denies cross-tenant/book reads and refuses a second physical cash owner book', async () => {
    await db(async (f) => {
      const c = await f.observe();
      await expect(
        f.receivables.readReceipt(
          { ...f.checker, tenantId: randomUUID() },
          f.scope(),
          c.observed.receiptId!,
        ),
      ).rejects.toThrow();
      await expect(
        f.receivables.readReceipt(f.checker, f.scope(1), c.observed.receiptId!),
      ).rejects.toThrow('unavailable');
      const cross = await f.receivables.observeReceipt(
        f.maker,
        f.scope(1),
        c.accepted.input(1),
        'alternate book observation',
      );
      expect(cross).toMatchObject({ state: 'CONFLICT_HELD', receiptId: null });
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_confirmed_receipts',
          )
        )[0].n,
      ).toBe(1);
    });
  });
  it('RC24 rejects zero and overprecision assignments without rounding', async () => {
    await db(async (f) => {
      const c = await f.ready();
      await expect(f.assign(c, '0')).rejects.toThrow('positive');
      await expect(f.assign(c, '0.001')).rejects.toThrow('rounding');
      await expect(
        f.receivables.proposeAssignment(
          f.maker,
          f.scope(),
          {
            ...f.profile(),
            commandKey: randomUUID(),
            receiptId: c.observed.receiptId!,
            memoId: c.bill.memo.id,
            memoHash: c.bill.memo.hash,
            amount: '1',
            originalId: '',
          },
          'invalid original reference',
        ),
      ).rejects.toThrow();
      expect(
        (
          await f.receivables.readReceipt(
            f.checker,
            f.scope(),
            c.observed.receiptId!,
          )
        ).available,
      ).toBe('118.000000000000');
    });
  });
  it('RC25 protects nonempty registries and profiles from destructive rollback', async () => {
    await db(async (f) => {
      await f.observe();
      const q = f.source.createQueryRunner();
      try {
        await expect(
          new FinanceReceivableControls1797000000000().down(q),
        ).rejects.toThrow('empty registries');
      } finally {
        await q.release();
      }
    });
  });
  it('RC26 binds receipt content to the accepted signature and exact source snapshot hash', async () => {
    await db(async (f) => {
      const snap = f.receipt(),
        accepted = await f.postEvidence(snap);
      const changed = { ...snap, received: '120', bankSettled: '118' };
      await expect(
        f.receivables.observeReceipt(
          f.maker,
          f.scope(),
          { ...accepted.input(), snapshot: changed },
          'changed source body',
        ),
      ).rejects.toThrow('source binding');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_confirmed_receipts',
          )
        )[0].n,
      ).toBe(0);
    });
  });
  it('RC27 UUID spelling aliases do not mint a second confirmed receipt', async () => {
    await db(async (f) => {
      const c = await f.observe(),
        alias = await f.observe({
          ...c.snap,
          id: c.snap.id.toUpperCase(),
          sourceAccountId: c.snap.sourceAccountId.toUpperCase(),
        });
      expect(alias.observed).toMatchObject({
        state: 'ALIASED',
        receiptId: c.observed.receiptId,
      });
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_confirmed_receipts',
          )
        )[0].n,
      ).toBe(1);
    });
  });
  it('RC28 reads fail closed on corrupted persisted vectors even if a privileged writer disables immutability', async () => {
    await db(async (f) => {
      const c = await f.observe();
      await f.source.query(
        'ALTER TABLE finance_confirmed_receipts DISABLE TRIGGER immutable_rows',
      );
      await f.source.query(
        "UPDATE finance_confirmed_receipts SET bank_settled='115',bank_fee='3' WHERE id=$1",
        [c.observed.receiptId],
      );
      await f.source.query(
        'ALTER TABLE finance_confirmed_receipts ENABLE TRIGGER immutable_rows',
      );
      await expect(
        f.receivables.readReceipt(f.checker, f.scope(), c.observed.receiptId!),
      ).rejects.toThrow('Stored receipt vector');
    });
  });
  it('RC29 ageing cuts captured reviews at the requested UTC day and refuses invented historical balances', async () => {
    await db(async (f) => {
      const c = await f.ready(),
        a = await f.assign(c, '20');
      const [dates] = await f.source.query(
        "SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS today,to_char((statement_timestamp() AT TIME ZONE 'UTC')+interval '1 day','YYYY-MM-DD') AS tomorrow,to_char((statement_timestamp() AT TIME ZONE 'UTC')-interval '1 day','YYYY-MM-DD') AS yesterday",
      );
      await f.source.query(
        "CREATE FUNCTION future_review_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.created_at:=statement_timestamp()+interval '1 day';RETURN NEW;END $$",
      );
      await f.source.query(
        'CREATE TRIGGER future_capture BEFORE INSERT ON finance_receivable_decisions FOR EACH ROW EXECUTE FUNCTION future_review_capture()',
      );
      await f.review(a);
      const view = (asOf: string) =>
        f.receivables.readBillingAgeing(f.checker, f.scope(), {
          ...f.profile(),
          memoId: c.bill.memo.id,
          asOf,
        });
      expect(await view(dates.today)).toMatchObject({
        assigned: '0.000000000000',
        pending: '20.000000000000',
        balanceCutoff: 'CAPTURED_EVENTS_THROUGH_UTC_DAY_END',
      });
      expect(await view(dates.tomorrow)).toMatchObject({
        assigned: '20.000000000000',
        pending: '0.000000000000',
      });
      await expect(view(dates.yesterday)).rejects.toThrow(
        'predates captured billing evidence',
      );
    });
  });
});
