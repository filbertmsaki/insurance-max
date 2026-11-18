import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createBillingFixture } from '../support/finance-quotation-billing-fixture';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';
import { sourceByteHash } from '../../src/modules/tenant/finance/accounting/accounting-events/finance-event.types';
const db = <T>(run: (db: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(run, process.env, 'quotation-billing');
async function counts(s: DataSource) {
  return (
    await s.query(
      'SELECT (SELECT count(*)::integer FROM finance_quotation_memoranda) AS memos,(SELECT count(*)::integer FROM finance_quotation_memorandum_lines) AS lines,(SELECT count(*)::integer FROM finance_quotation_billing_decisions) AS decisions,(SELECT count(*)::integer FROM finance_quotation_billing_audits) AS audits',
    )
  )[0];
}
describe('Signed-source quotation memorandum billing, recognition held (B13)', () => {
  it('QB01 creates empty controls, supports empty rollback and protects populated registries', async () => {
    await db(async ({ dataSource: s }) => {
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_billing_authorities',
          )
        )[0].n,
      ).toBe(0);
      await s.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await s.query(
            "SELECT to_regclass('finance_quotation_memoranda') AS name",
          )
        )[0].name,
      ).toBeNull();
      await s.runMigrations({ transaction: 'all' });
      await createBillingFixture(s);
      await expect(s.undoLastMigration({ transaction: 'all' })).rejects.toThrow(
        'requires empty',
      );
    });
  });
  it('QB02 persists exact source components, independently reviews and leaves all recognition held', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { memo } = await f.prepare();
      const result = await f.billing.reviewInactive(
        f.checker,
        f.scope(),
        memo,
        'REVIEWED_INACTIVE',
        'independent factual review',
      );
      expect(result).toMatchObject({
        accountingState: 'HELD_INACTIVE',
        recognitionOwner: 'UNASSIGNED_HELD',
        financialEffects: 0,
      });
      const read = await f.billing.readInactive(f.maker, f.scope(), memo.id);
      expect(read.snapshot.components).toEqual({
        gross: '118.000000000000',
        discount: '0.000000000000',
        tax: null,
        charges: '0.000000000000',
        total: '118.000000000000',
      });
      expect(read.history).toHaveLength(2);
      expect(read.holds).toContain('B45_FOUNDATION_ACCEPTANCE_PENDING');
      expect(
        (
          await s.query("SELECT to_regclass('finance_journal_entries') AS name")
        )[0].name,
      ).toBeNull();
    });
  });
  it('QB03 binds the exact signed snapshot and rejects changed business content', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        p = f.snapshot(),
        a = await f.post(p);
      p.quotationNumber = 'CHANGED';
      await expect(
        f.billing.prepareInactive(
          f.maker,
          f.scope(),
          a.input(),
          'changed source',
        ),
      ).rejects.toThrow('source binding');
      expect((await counts(s)).memos).toBe(0);
    });
  });
  it('QB04 serializes exact retries and preserves one memorandum across new delivery aliases', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        p = f.snapshot(),
        a = await f.post(p);
      const results = await Promise.all([
        f.billing.prepareInactive(f.maker, f.scope(), a.input(), 'first'),
        f.billing.prepareInactive(f.maker, f.scope(), a.input(), 'retry'),
      ]);
      expect(results[0].id).toBe(results[1].id);
      expect(results.filter((r) => r.reused)).toHaveLength(1);
      const alias = await f.post(p);
      expect(
        (
          await f.billing.prepareInactive(
            f.maker,
            f.scope(),
            alias.input(),
            'alias',
          )
        ).id,
      ).toBe(results[0].id);
      expect(await counts(s)).toEqual({
        memos: 1,
        lines: 1,
        decisions: 0,
        audits: 1,
      });
    });
  });
  it('QB05 denies worker principals, tenant leakage and cross-book source use', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { memo, accepted } = await f.prepare();
      await expect(
        f.billing.readInactive(f.worker as never, f.scope(), memo.id),
      ).rejects.toThrow('human');
      await expect(
        f.billing.readInactive(
          { ...f.maker, tenantId: randomUUID() },
          f.scope(),
          memo.id,
        ),
      ).rejects.toThrow('authority');
      await expect(
        f.billing.readInactive(f.maker, f.scope(1), memo.id),
      ).rejects.toThrow('unavailable');
      await expect(
        f.billing.prepareInactive(
          f.maker,
          f.scope(1),
          accepted.input(),
          'wrong book',
        ),
      ).rejects.toThrow('profile');
    });
  });
  it('QB06 denies maker and same-person aliases as checkers and freezes rejection', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { memo } = await f.prepare();
      await expect(
        f.billing.reviewInactive(
          f.maker,
          f.scope(),
          memo,
          'REVIEWED_INACTIVE',
          'self',
        ),
      ).rejects.toThrow('independent');
      const alias = { ...f.maker, subjectId: randomUUID() };
      await f.billingGrant(alias, 'REVIEW_BILLING');
      await expect(
        f.billing.reviewInactive(
          alias,
          f.scope(),
          memo,
          'REVIEWED_INACTIVE',
          'alias',
        ),
      ).rejects.toThrow('independent');
      await f.billing.reviewInactive(
        f.checker,
        f.scope(),
        memo,
        'REJECTED_INACTIVE',
        'reject',
      );
      await expect(
        f.billing.reviewInactive(
          f.checker,
          f.scope(),
          memo,
          'REVIEWED_INACTIVE',
          'change decision',
        ),
      ).rejects.toThrow('immutable');
    });
  });
  it('QB07 requires original memorandum lineage and preserves superseded/late-source facts', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        p = f.snapshot(),
        one = await f.post(p),
        next = {
          ...p,
          sourceRevision: 2,
          workflowRevision: 9,
          invoiceStateVersion: 6,
          billingDate: '2026-10-31',
          policyId: randomUUID(),
        },
        two = await f.post(next);
      await expect(
        f.billing.prepareInactive(
          f.maker,
          f.scope(),
          two.input(),
          'missing predecessor',
        ),
      ).rejects.toThrow('preceding');
      const first = await f.billing.prepareInactive(
        f.maker,
        f.scope(),
        one.input(),
        'late original',
      );
      await expect(
        f.billing.reviewInactive(
          f.checker,
          f.scope(),
          first,
          'REVIEWED_INACTIVE',
          'stale review',
        ),
      ).rejects.toThrow('superseded');
      const second = await f.billing.prepareInactive(
        f.maker,
        f.scope(),
        two.input(),
        'source correction',
      );
      await f.billing.reviewInactive(
        f.checker,
        f.scope(),
        second,
        'REVIEWED_INACTIVE',
        'review correction',
      );
      expect(
        (await f.billing.readInactive(f.maker, f.scope(), first.id)).superseded,
      ).toBe(true);
      expect(
        (await f.billing.readInactive(f.maker, f.scope(), second.id)).snapshot
          .billingDate,
      ).toBe('2026-10-31');
      expect(
        (
          await s.query(
            'SELECT previous_id FROM finance_quotation_memoranda WHERE id=$1',
            [second.id],
          )
        )[0].previous_id,
      ).toBe(first.id);
    });
  });
  it('QB08 retains zero billing facts without creating a legacy invoice or journal', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        p = f.snapshot();
      p.invoiceId = null;
      p.invoiceNumber = null;
      p.invoiceSourceRevision = null;
      p.invoiceStateVersion = null;
      p.paymentReference = null;
      p.components = {
        gross: '0',
        discount: '0',
        tax: null,
        charges: '0',
        total: '0',
      };
      p.lines = [{ key: 'ZERO', description: 'No premium', ...p.components }];
      const { memo } = await f.prepare(p);
      expect(
        (await f.billing.readInactive(f.maker, f.scope(), memo.id)).snapshot
          .components.total,
      ).toBe('0.000000000000');
      expect(
        (await s.query("SELECT to_regclass('invoices') AS name"))[0].name,
      ).toBeNull();
    });
  });
  it('QB09 distinguishes inclusive and exclusive components without duplicate tax effects', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s);
      for (const mode of ['INCLUSIVE', 'EXCLUSIVE'] as const) {
        const p = f.snapshot();
        p.taxPresentation = mode;
        p.components = {
          gross: mode === 'INCLUSIVE' ? '118' : '100',
          discount: '5',
          tax: '18',
          charges: '2',
          total: '115',
        };
        p.lines = [
          {
            key: 'PREMIUM',
            description: 'Explicit source split',
            ...p.components,
          },
        ];
        const { memo } = await f.prepare(p);
        expect(
          (await f.billing.readInactive(f.maker, f.scope(), memo.id)).snapshot
            .components.total,
        ).toBe('115.000000000000');
      }
      expect((await counts(s)).memos).toBe(2);
    });
  });
  it('QB10 holds declared original journal effects, paid status and policy links without recognition', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        p = f.snapshot();
      p.policyId = randomUUID();
      p.sourceStatus = 'PAID';
      p.legacyJournalEvidence = {
        state: 'PRESENT',
        references: [{ id: randomUUID(), hash: 'f'.repeat(64) }],
      };
      const { memo } = await f.prepare(p);
      const r = await f.billing.reviewInactive(
        f.checker,
        f.scope(),
        memo,
        'REVIEWED_INACTIVE',
        'observe existing effects',
      );
      expect(r.holds).toContain('LEGACY_EFFECTS_NOT_RECONCILED');
      expect(r.financialEffects).toBe(0);
      expect(
        (await f.billing.readInactive(f.maker, f.scope(), memo.id)).snapshot
          .sourceStatus,
      ).toBe('PAID');
    });
  });
  it('QB11 retains the accepted B11 source when maker audit failure rolls back every memorandum row', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        a = await f.post(f.snapshot());
      await s.query(
        "CREATE FUNCTION fail_billing_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic maker audit failure';END $$",
      );
      await s.query(
        'CREATE TRIGGER fail_billing_audit BEFORE INSERT ON finance_quotation_billing_audits FOR EACH ROW EXECUTE FUNCTION fail_billing_audit()',
      );
      await expect(
        f.billing.prepareInactive(f.maker, f.scope(), a.input(), 'audit fault'),
      ).rejects.toThrow('audit failure');
      expect(await counts(s)).toEqual({
        memos: 0,
        lines: 0,
        decisions: 0,
        audits: 0,
      });
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS n FROM finance_integration_inboxes',
          )
        )[0].n,
      ).toBe(2);
    });
  });
  it('QB12 never records a successful review when its audit cannot commit', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { memo } = await f.prepare();
      await s.query(
        "CREATE FUNCTION fail_billing_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='REVIEWED_INACTIVE' THEN RAISE EXCEPTION 'synthetic review audit failure';END IF;RETURN NEW;END $$",
      );
      await s.query(
        'CREATE TRIGGER fail_billing_review BEFORE INSERT ON finance_quotation_billing_audits FOR EACH ROW EXECUTE FUNCTION fail_billing_review()',
      );
      await expect(
        f.billing.reviewInactive(
          f.checker,
          f.scope(),
          memo,
          'REVIEWED_INACTIVE',
          'audit fault',
        ),
      ).rejects.toThrow('audit failure');
      expect((await counts(s)).decisions).toBe(0);
      expect((await counts(s)).audits).toBe(1);
    });
  });
  it('QB13 rejects persisted but wrong line evidence even when monetary totals still balance', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        a = await f.post(f.snapshot());
      await s.query(
        "CREATE FUNCTION corrupt_billing_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.description='wrong persisted description';RETURN NEW;END $$",
      );
      await s.query(
        'CREATE TRIGGER corrupt_billing_line BEFORE INSERT ON finance_quotation_memorandum_lines FOR EACH ROW EXECUTE FUNCTION corrupt_billing_line()',
      );
      await expect(
        f.billing.prepareInactive(
          f.maker,
          f.scope(),
          a.input(),
          'persisted corruption',
        ),
      ).rejects.toThrow('line differs');
      expect((await counts(s)).memos).toBe(0);
    });
  });
  it('QB14 protects subject, line, review and audit immutability', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { memo } = await f.prepare();
      await expect(
        s.query(
          "UPDATE finance_quotation_memoranda SET accounting_state='ACTIVE' WHERE id=$1",
          [memo.id],
        ),
      ).rejects.toThrow();
      await expect(
        s.query(
          'DELETE FROM finance_quotation_memorandum_lines WHERE memo_id=$1',
          [memo.id],
        ),
      ).rejects.toThrow('immutable');
      await expect(
        s.query(
          "INSERT INTO finance_quotation_memorandum_lines(memo_id,line_key,description,gross,discount,tax,charges,total) VALUES($1,'LATE','late',0,0,NULL,0,0)",
          [memo.id],
        ),
      ).rejects.toThrow('frozen');
      await expect(
        s.query('TRUNCATE finance_quotation_billing_audits'),
      ).rejects.toThrow('immutable');
    });
  });
  it('QB15 invalidates review when the frozen maker authority changes or is revoked', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { memo } = await f.prepare();
      await s.query(
        "UPDATE finance_billing_authorities SET authority_reference='CHANGED' WHERE tenant_id=$1 AND subject_id=$2 AND permission='PREPARE_BILLING'",
        [f.tenantId, f.maker.subjectId],
      );
      await expect(
        f.billing.reviewInactive(
          f.checker,
          f.scope(),
          memo,
          'REVIEWED_INACTIVE',
          'changed maker',
        ),
      ).rejects.toThrow('changed');
      await s.query(
        "UPDATE finance_billing_authorities SET state='REVOKED' WHERE tenant_id=$1 AND subject_id=$2 AND permission='PREPARE_BILLING'",
        [f.tenantId, f.maker.subjectId],
      );
      await expect(
        f.billing.reviewInactive(
          f.checker,
          f.scope(),
          memo,
          'REVIEWED_INACTIVE',
          'revoked maker',
        ),
      ).rejects.toThrow('authority');
    });
  });
  it('QB16 uses exact scoped read permissions without hidden writes or raw signature disclosure', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { memo } = await f.prepare(),
        before = await counts(s),
        r = await f.billing.readInactive(f.checker, f.scope(), memo.id);
      expect(JSON.stringify(r)).not.toMatch(
        /raw_body|signature_base64|public_key_pem/,
      );
      expect(await counts(s)).toEqual(before);
      await s.query(
        "UPDATE finance_billing_authorities SET state='REVOKED' WHERE tenant_id=$1 AND subject_id=$2 AND permission='READ_BILLING'",
        [f.tenantId, f.checker.subjectId],
      );
      await expect(
        f.billing.readInactive(f.checker, f.scope(), memo.id),
      ).rejects.toThrow('authority');
    });
  });
  it('QB17 rolls back preparation when its grant expires during atomic audit', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        a = await f.post(f.snapshot());
      await s.query(
        "UPDATE finance_billing_authorities SET valid_to=statement_timestamp()+interval '1 second' WHERE tenant_id=$1 AND subject_id=$2 AND permission='PREPARE_BILLING'",
        [f.tenantId, f.maker.subjectId],
      );
      await s.query(
        'CREATE FUNCTION delay_billing_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2);RETURN NEW;END $$',
      );
      await s.query(
        'CREATE TRIGGER delay_billing_audit BEFORE INSERT ON finance_quotation_billing_audits FOR EACH ROW EXECUTE FUNCTION delay_billing_audit()',
      );
      await expect(
        f.billing.prepareInactive(
          f.maker,
          f.scope(),
          a.input(),
          'expiry fault',
        ),
      ).rejects.toThrow(/authority|maker/);
      expect((await counts(s)).memos).toBe(0);
    });
  });
  it('QB18 re-verifies stored signatures instead of trusting accepted labels', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        a = await f.post(f.snapshot()),
        signature = Buffer.alloc(64);
      await s.query(
        'ALTER TABLE finance_source_event_preview_deliveries DISABLE TRIGGER USER',
      );
      await s.query(
        'UPDATE finance_source_event_preview_deliveries SET signature_base64=$1,signature_hash=$2 WHERE tenant_id=$3',
        [signature.toString('base64'), sourceByteHash(signature), f.tenantId],
      );
      await s.query(
        'ALTER TABLE finance_source_event_preview_deliveries ENABLE TRIGGER USER',
      );
      await expect(
        f.billing.prepareInactive(
          f.maker,
          f.scope(),
          a.input(),
          'corrupt historical signature',
        ),
      ).rejects.toThrow('signature');
      expect((await counts(s)).memos).toBe(0);
    });
  });
  it('QB19 rejects another representation of the same UUID economic original', async () => {
    await db(async ({ dataSource: s }) => {
      const f = await createBillingFixture(s),
        { snapshot } = await f.prepare();
      const variant = {
          ...snapshot,
          quotationId: snapshot.quotationId.toUpperCase(),
        },
        accepted = await f.post(variant);
      await expect(
        f.billing.prepareInactive(
          f.maker,
          f.scope(),
          accepted.input(),
          'UUID alias',
        ),
      ).rejects.toThrow('economic quotation revision');
      expect((await counts(s)).memos).toBe(1);
    });
  });
});
