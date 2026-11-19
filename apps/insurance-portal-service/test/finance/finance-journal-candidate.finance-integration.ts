import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinanceAccountingBook } from '../../src/modules/tenant/finance/foundation/entities/finance-accounting-book.entity';
import { FinanceFoundationModule } from '../../src/modules/tenant/finance/foundation/finance-foundation.module';
import { FinanceFoundationController } from '../../src/modules/tenant/finance/foundation/finance-foundation.controller';
import { FinanceJournalCandidateService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal-candidate.service';
import { financeConfigurationHash } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import type { JournalCandidateInput } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal-candidate.types';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';

import { createCandidateFixture as fixture } from '../support/finance-candidate-fixture';

const configured = <T>(work: (db: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(work, process.env, 'journal-candidates');
async function counts(source: DataSource) {
  const [row] = await source.query(
    `SELECT (SELECT count(*)::integer FROM finance_journal_candidates) AS candidates, (SELECT count(*)::integer FROM finance_journal_candidate_lines) AS lines, (SELECT count(*)::integer FROM finance_journal_candidate_events WHERE candidate_id IS NOT NULL) AS events`,
  );
  return row;
}
async function waitForBookWaiters(source: DataSource, count: number) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const [row] = await source.query(
      "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%finance_accounting_books%' AND query LIKE '%FOR UPDATE%'",
    );
    if (row.count >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Expected concurrent book-lock waiters were not observed');
}

describe('Inactive period fences and exact persisted journal candidates (B08)', () => {
  it('JC01 migrates empty registries and protected rollback without touching legacy tables', async () => {
    await configured(async ({ dataSource }) => {
      expect(await counts(dataSource)).toEqual({
        candidates: 0,
        lines: 0,
        events: 0,
      });
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_journal_entries') AS name",
          )
        )[0].name,
      ).toBeNull();
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_approval_requests') AS name",
          )
        )[0].name,
      ).toBeNull();
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_draft_periods') AS name",
          )
        )[0].name,
      ).toBeNull();
      await dataSource.runMigrations({ transaction: 'all' });
      await fixture(dataSource);
      await expect(
        dataSource.undoLastMigration({ transaction: 'all' }),
      ).rejects.toThrow('requires empty');
    });
  });
  it('JC02 persists the independent literal vector, balances after storage and validates inactive only', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.prepare(),
        validated = await f.validate(row);
      expect(validated.state).toBe('VALIDATED_INACTIVE');
      expect(validated.accounting_date).toBe('2026-11-15');
      const lines = await dataSource.query(
        'SELECT account_code,debit::text,credit::text FROM finance_journal_candidate_lines ORDER BY line_key',
      );
      expect(lines).toEqual([
        {
          account_code: '210110',
          debit: '0.000000000000',
          credit: '25.125000000000',
        },
        {
          account_code: '110110',
          debit: '25.125000000000',
          credit: '0.000000000000',
        },
      ]);
      expect(await counts(dataSource)).toEqual({
        candidates: 1,
        lines: 2,
        events: 2,
      });
      expect(
        (await dataSource.getRepository(FinanceAccountingBook).find()).every(
          (b) =>
            b.state === 'DRAFT' &&
            b.chart_release_id === null &&
            b.functional_assessment_id === null,
        ),
      ).toBe(true);
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_accounts') AS name",
          )
        )[0].name,
      ).toBeNull();
    });
  });
  it('JC03 persists the smallest and largest supported exact values without storage rounding', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      for (const [i, amount] of [
        '0.000000000001',
        '99999999999999999999999999.999999999999',
      ].entries()) {
        const p = f.input();
        p.economicSourceId += i;
        p.decimalScale = 12;
        p.lines[0].debit = amount;
        p.lines[1].credit = amount;
        const row = await f.prepare(p);
        await f.validate(row);
        expect(
          (
            await dataSource.query(
              'SELECT debit::text FROM finance_journal_candidate_lines WHERE candidate_id=$1 AND line_key=$2',
              [row.id, 'DR'],
            )
          )[0].debit,
        ).toBe(amount);
      }
    });
  });
  it('JC04 rejects rounding, unbalance, two-sided lines, missing dimensions and unassigned roles without residue', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      for (const change of [
        (p: JournalCandidateInput) => {
          p.lines[0].debit = '25.1251';
        },
        (p: JournalCandidateInput) => {
          p.lines[1].credit = '25.126';
        },
        (p: JournalCandidateInput) => {
          p.lines[0].credit = '1';
        },
        (p: JournalCandidateInput) => {
          p.lines[0].dimensions = {};
        },
        (p: JournalCandidateInput) => {
          p.lines[0].dimensions.CURRENCY = 'EUR';
        },
        (p: JournalCandidateInput) => {
          p.lines[0].roleCode = 'UNASSIGNED';
        },
        (p: JournalCandidateInput) => {
          p.chartReleaseHash = 'b'.repeat(64);
        },
        (p: JournalCandidateInput) => {
          p.chartReleaseId = randomUUID();
        },
      ]) {
        const p = f.input();
        change(p);
        await expect(f.prepare(p)).rejects.toThrow();
      }
      expect(await counts(dataSource)).toEqual({
        candidates: 0,
        lines: 0,
        events: 0,
      });
    });
  });
  it('JC05 enforces scope, explicit grants, trusted natural person and independent validation', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        p = f.input();
      for (const [actor, scope] of [
        [{ ...f.maker, tenantId: randomUUID() }, f.scope],
        [f.maker, { ...f.scope, bookId: f.books[1].id }],
        [{ ...f.maker, naturalPersonId: randomUUID() }, f.scope],
      ] as const)
        await expect(
          f.service.prepareInactive(actor, scope, p, 'scope attempt'),
        ).rejects.toMatchObject({ status: 403 });
      const row = await f.prepare();
      await f.grant(f.maker, 'VALIDATE_CANDIDATE');
      const alias = { ...f.maker, subjectId: randomUUID() };
      await f.grant(alias, 'VALIDATE_CANDIDATE');
      for (const actor of [f.maker, alias])
        await expect(
          f.service.validateInactive(
            actor,
            f.scope,
            row.id,
            row.subject_hash,
            'self review',
          ),
        ).rejects.toMatchObject({ status: 403 });
      await dataSource.query(
        "UPDATE finance_journal_candidate_authorities SET revoked_at=statement_timestamp() WHERE permission='VALIDATE_CANDIDATE'",
      );
      await expect(f.validate(row)).rejects.toMatchObject({ status: 403 });
      expect((await counts(dataSource)).events).toBe(1);
    });
  });
  it('JC06 checks exact half-open dates, overlapping periods, stale hashes and stale period revisions', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      for (const date of ['2026-10-31', '2026-12-01']) {
        const p = f.input();
        p.accountingDate = date;
        await expect(f.prepare(p)).rejects.toMatchObject({ status: 409 });
      }
      await expect(
        f.service.createDraftPeriod(
          f.controller,
          f.scope,
          { code: 'OVERLAP', startsOn: '2026-11-30', endsBefore: '2026-12-30' },
          'overlap',
        ),
      ).rejects.toMatchObject({ status: 409 });
      const row = await f.prepare();
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          'b'.repeat(64),
          'stale hash',
        ),
      ).rejects.toMatchObject({ status: 409 });
      await f.service.fenceDraftPeriod(
        f.controller,
        f.scope,
        f.period.id,
        2,
        'SEALED_DRAFT',
        'seal validation',
      );
      await expect(f.validate(row)).rejects.toMatchObject({ status: 409 });
      await f.service.fenceDraftPeriod(
        f.controller,
        f.scope,
        f.period.id,
        3,
        'OPEN_FOR_VALIDATION',
        'reopen validation',
      );
      await expect(f.validate(row)).rejects.toMatchObject({ status: 409 });
      await expect(
        f.service.fenceDraftPeriod(
          f.controller,
          f.scope,
          f.period.id,
          2,
          'SEALED_DRAFT',
          'stale fence',
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).events).toBe(1);
    });
  });
  it('JC07 coalesces concurrent identical economic candidates and conflicts on changed content', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      let jobs: Promise<unknown>[] = [];
      try {
        await blocker.query(
          'SELECT id FROM finance_accounting_books WHERE id=$1 FOR UPDATE',
          [f.scope.bookId],
        );
        jobs = [f.prepare(), f.prepare()];
        const settled = Promise.all(jobs);
        await waitForBookWaiters(dataSource, 2);
        await blocker.commitTransaction();
        const rows = (await settled) as { id: string }[];
        expect(rows[0].id).toBe(rows[1].id);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await Promise.allSettled(jobs);
        await blocker.release();
      }
      expect(await counts(dataSource)).toEqual({
        candidates: 1,
        lines: 2,
        events: 1,
      });
      const changed = f.input();
      changed.sourceRevision = '2';
      await expect(f.prepare(changed)).rejects.toMatchObject({ status: 409 });
    });
  });
  it('JC08 rejects a writer that read an OPEN revision before the close fence wins the lock', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        closer = dataSource.createQueryRunner();
      await closer.connect();
      await closer.startTransaction();
      let job: Promise<unknown> | undefined;
      try {
        await closer.query(
          'SELECT id FROM finance_accounting_books WHERE id=$1 FOR UPDATE',
          [f.scope.bookId],
        );
        job = f.prepare();
        const outcome = Promise.allSettled([job]);
        await waitForBookWaiters(dataSource, 1);
        await closer.query(
          "UPDATE finance_draft_periods SET state='SEALED_DRAFT',revision=3 WHERE id=$1",
          [f.period.id],
        );
        const [grant] = await closer.query(
          "SELECT id FROM finance_journal_candidate_authorities WHERE subject_id=$1 AND permission='MANAGE_DRAFT_PERIOD'",
          [f.controller.subjectId],
        );
        const [fencedPeriod] = await closer.query(
          'SELECT *,starts_on::text AS starts_on,ends_before::text AS ends_before FROM finance_draft_periods WHERE id=$1',
          [f.period.id],
        );
        await closer.query(
          `INSERT INTO finance_journal_candidate_events (tenant_id,legal_entity_id,book_id,period_id,period_revision,action,subject_hash,actor_subject_id,actor_natural_person_id,authority_id,reason) VALUES ($1,$2,$3,$4,3,'PERIOD_FENCED',$5,$6,$7,$8,'controlled close fence')`,
          [
            f.tenantId,
            f.scope.legalEntityId,
            f.scope.bookId,
            f.period.id,
            financeConfigurationHash(fencedPeriod),
            f.controller.subjectId,
            f.controller.naturalPersonId,
            grant.id,
          ],
        );
        await closer.commitTransaction();
        const [result] = await outcome;
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected')
          expect(result.reason).toMatchObject({ status: 409 });
      } finally {
        if (closer.isTransactionActive) await closer.rollbackTransaction();
        if (job) await Promise.allSettled([job]);
        await closer.release();
      }
      expect(await counts(dataSource)).toEqual({
        candidates: 0,
        lines: 0,
        events: 0,
      });
    });
  });
  it('JC09 keeps an included pre-fence validation immutable when the period is subsequently sealed', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.prepare();
      await f.validate(row);
      await f.service.fenceDraftPeriod(
        f.controller,
        f.scope,
        f.period.id,
        2,
        'SEALED_DRAFT',
        'seal after included candidate',
      );
      expect(
        (
          await dataSource.query(
            'SELECT state,period_revision FROM finance_journal_candidates WHERE id=$1',
            [row.id],
          )
        )[0],
      ).toEqual({ state: 'VALIDATED_INACTIVE', period_revision: 2 });
    });
  });
  it('JC10 audit-write failure rolls back the candidate and every stored line', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await dataSource.query(
        `CREATE FUNCTION fail_candidate_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.candidate_id IS NOT NULL THEN RAISE EXCEPTION 'controlled candidate audit failure'; END IF; RETURN NEW; END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_candidate_audit BEFORE INSERT ON finance_journal_candidate_events FOR EACH ROW EXECUTE FUNCTION fail_candidate_audit()',
      );
      await expect(f.prepare()).rejects.toThrow(
        'controlled candidate audit failure',
      );
      expect(await counts(dataSource)).toEqual({
        candidates: 0,
        lines: 0,
        events: 0,
      });
    });
  });
  it('JC11 rejects a stored vector that remains balanced but was changed during persistence', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await dataSource.query(
        `CREATE FUNCTION corrupt_candidate_lines() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.debit>0 THEN NEW.debit=NEW.debit+1; ELSE NEW.credit=NEW.credit+1; END IF; RETURN NEW; END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER corrupt_candidate_lines BEFORE INSERT ON finance_journal_candidate_lines FOR EACH ROW EXECUTE FUNCTION corrupt_candidate_lines()',
      );
      await expect(f.prepare()).rejects.toMatchObject({ status: 409 });
      expect(await counts(dataSource)).toEqual({
        candidates: 0,
        lines: 0,
        events: 0,
      });
    });
  });
  it('JC12 linked reversal is the exact inverse of the validated original and does not replace it', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        original = await f.validate(await f.prepare());
      const p = f.input();
      p.correctionOf = { id: original.id, hash: original.subject_hash };
      p.lines[0].debit = '0';
      p.lines[0].credit = '25.125';
      p.lines[1].debit = '25.125';
      p.lines[1].credit = '0';
      const reversal = await f.validate(await f.prepare(p));
      expect(reversal.kind).toBe('REVERSAL');
      expect(reversal.correction_of_id).toBe(original.id);
      expect(
        (
          await dataSource.query(
            'SELECT sum(debit)::text AS debit,sum(credit)::text AS credit FROM finance_journal_candidate_lines',
          )
        )[0],
      ).toEqual({ debit: '50.250000000000', credit: '50.250000000000' });
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_journal_candidates WHERE id=$1',
            [original.id],
          )
        )[0].state,
      ).toBe('VALIDATED_INACTIVE');
      const wrong: JournalCandidateInput = JSON.parse(JSON.stringify(p));
      wrong.lines[0].credit = '26.125';
      wrong.lines[1].debit = '26.125';
      await expect(f.prepare(wrong)).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).candidates).toBe(2);
    });
  });
  it('JC13 holds unsupported corrections, stale predecessor hashes and reversals of an unvalidated original', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        original = await f.prepare();
      const p = f.input();
      p.correctionOf = { id: original.id, hash: original.subject_hash };
      p.lines[0].debit = '0';
      p.lines[0].credit = '25.125';
      p.lines[1].debit = '25.125';
      p.lines[1].credit = '0';
      await expect(f.prepare(p)).rejects.toMatchObject({ status: 409 });
      await f.validate(original);
      p.correctionOf.hash = 'a'.repeat(64);
      await expect(f.prepare(p)).rejects.toMatchObject({ status: 409 });
      p.correctionOf.hash = original.subject_hash;
      p.lines[0].credit = '26';
      p.lines[1].debit = '26';
      await expect(f.prepare(p)).rejects.toMatchObject({ status: 409 });
    });
  });
  it('JC14 rejects raw history edits, additional frozen lines and missing atomic period audit', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.prepare();
      for (const sql of [
        "UPDATE finance_journal_candidates SET payload='{}'::jsonb",
        'DELETE FROM finance_journal_candidates',
        'UPDATE finance_journal_candidate_lines SET debit=debit+1 WHERE debit>0',
        'TRUNCATE finance_journal_candidate_events',
        'DELETE FROM finance_journal_candidate_events',
      ])
        await expect(dataSource.query(sql)).rejects.toThrow();
      await expect(
        dataSource.query(
          `INSERT INTO finance_journal_candidate_lines (tenant_id,legal_entity_id,book_id,candidate_id,line_key,role_code,account_code,debit,credit,dimensions) SELECT tenant_id,legal_entity_id,book_id,candidate_id,'EXTRA',role_code,account_code,debit,credit,dimensions FROM finance_journal_candidate_lines WHERE candidate_id=$1 LIMIT 1`,
          [row.id],
        ),
      ).rejects.toThrow('frozen');
      await expect(
        dataSource.query(
          "UPDATE finance_draft_periods SET state='SEALED_DRAFT',revision=3 WHERE id=$1",
          [f.period.id],
        ),
      ).rejects.toThrow('requires atomic audit');
      expect(
        (
          await dataSource.query(
            'SELECT revision FROM finance_draft_periods WHERE id=$1',
            [f.period.id],
          )
        )[0].revision,
      ).toBe(2);
      await expect(
        dataSource.query(
          "UPDATE finance_journal_candidates SET state='VALIDATED_INACTIVE',checker_subject_id=$2,checker_natural_person_id=$3,validated_at=statement_timestamp() WHERE id=$1",
          [row.id, f.checker.subjectId, f.checker.naturalPersonId],
        ),
      ).rejects.toThrow('requires consumed approval');
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_journal_candidates WHERE id=$1',
            [row.id],
          )
        )[0].state,
      ).toBe('PREPARED_INACTIVE');
    });
  });
  it('JC15 expiry after candidate audit rolls back validation and preserves the prepared subject', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.prepare();
      await dataSource.query(
        `CREATE FUNCTION expire_candidate_authority() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='VALIDATED_INACTIVE' THEN UPDATE finance_journal_candidate_authorities SET valid_to=statement_timestamp()-interval '1 second' WHERE id=NEW.authority_id; END IF; RETURN NEW; END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER expire_candidate_authority AFTER INSERT ON finance_journal_candidate_events FOR EACH ROW EXECUTE FUNCTION expire_candidate_authority()',
      );
      await expect(f.validate(row)).rejects.toMatchObject({ status: 403 });
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_journal_candidates WHERE id=$1',
            [row.id],
          )
        )[0].state,
      ).toBe('PREPARED_INACTIVE');
      expect(await counts(dataSource)).toEqual({
        candidates: 1,
        lines: 2,
        events: 1,
      });
    });
  });
  it('JC16 resolves through the internal Nest foundation module without registering routes', async () => {
    await configured(async ({ dataSource }) => {
      class IsolatedDatabaseModule {}
      const context = await Test.createTestingModule({
        imports: [
          {
            module: IsolatedDatabaseModule,
            global: true,
            providers: [
              { provide: getDataSourceToken(), useValue: dataSource },
            ],
            exports: [getDataSourceToken()],
          },
          FinanceFoundationModule,
        ],
      }).compile();
      try {
        expect(context.get(FinanceJournalCandidateService)).toBeInstanceOf(
          FinanceJournalCandidateService,
        );
        expect(
          Reflect.getMetadata('controllers', FinanceFoundationModule) ?? [],
        ).toEqual([FinanceFoundationController]);
      } finally {
        await context.close();
      }
    });
  });
});
