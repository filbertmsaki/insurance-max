import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { FinanceApprovalService } from '../../src/modules/tenant/finance/governance/finance-approvals/finance-approval.service';
import { financeConfigurationHash } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import type { BeneficiaryEvidence } from '../../src/modules/tenant/finance/governance/finance-approvals/finance-approval.types';
import { createCandidateFixture } from '../support/finance-candidate-fixture';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';
const configured = <T>(work: (db: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(work, process.env, 'journal-candidates');
async function counters(source: DataSource) {
  const [row] = await source.query(
    `SELECT (SELECT count(*)::integer FROM finance_approval_requests) AS requests,(SELECT count(*)::integer FROM finance_approval_decisions) AS decisions,(SELECT count(*)::integer FROM finance_approval_events) AS events,(SELECT count(*)::integer FROM finance_journal_candidate_events) AS candidate_events`,
  );
  return row;
}
const beneficiary = (id: string): BeneficiaryEvidence => ({
  mode: 'REFERENCED',
  sourceSystem: 'SYNTHETIC_REFERENCE',
  referenceId: 'restricted-payee-reference',
  version: '1',
  evidenceHash: 'b'.repeat(64),
  naturalPersonIds: [id],
});

describe('Inactive approval and audit governance on PostgreSQL (B09)', () => {
  it('AP01 requires explicit governance despite an existing validation grant and preserves inactive history', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare();
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'missing approval',
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect((await counters(dataSource)).requests).toBe(0);
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_journal_candidates WHERE id=$1',
            [row.id],
          )
        )[0].state,
      ).toBe('PREPARED_INACTIVE');
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_journal_entries') AS name",
          )
        )[0].name,
      ).toBeNull();
    });
  });
  it('AP02 requires the complete independent quorum and consumes it with validation exactly once', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource, { quorum: 2 }),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'partial quorum',
          token,
        ),
      ).rejects.toMatchObject({ status: 403 });
      const other = f.actor(),
        mandate = await f.mandate(other);
      await f.approve(token, other, mandate.id);
      const validated = await f.service.validateInactive(
        f.checker,
        f.scope,
        row.id,
        row.subject_hash,
        'complete inactive quorum',
        token,
      );
      expect(validated.state).toBe('VALIDATED_INACTIVE');
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_approval_requests WHERE id=$1',
            [token.requestId],
          )
        )[0].state,
      ).toBe('CONSUMED_INACTIVE');
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'repeat consume',
          token,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect((await counters(dataSource)).events).toBe(4);
    });
  });
  it('AP03 denies maker aliases, beneficiary checkers and self-delegation through the maker', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row, beneficiary(f.checker.naturalPersonId));
      const alias = { ...f.maker, subjectId: randomUUID() },
        aliasMandate = await f.mandate(alias);
      await expect(
        f.approve(token, alias, aliasMandate.id),
      ).rejects.toMatchObject({ status: 403 });
      await expect(f.approve(token)).rejects.toMatchObject({ status: 403 });
      const makerRoot = await f.mandate(f.maker),
        delegate = f.actor();
      const delegated = await f.mandate(delegate, {
        delegated_from_id: makerRoot.id,
      });
      await expect(
        f.approve(token, delegate, delegated.id),
      ).rejects.toMatchObject({ status: 403 });
      expect((await counters(dataSource)).decisions).toBe(0);
    });
  });
  it('AP04 checks the entire candidate amount, currency, role and scope without splitting authority', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      for (const override of [
        { max_amount: '25.124' },
        { currency: 'EUR' },
        { role_code: 'OTHER' },
        { book_id: f.books[1].id },
        { natural_person_id: randomUUID() },
        { state: 'DRAFT' },
        { valid_from: new Date('2099-01-01Z') },
        { valid_to: new Date('2021-01-01Z') },
      ]) {
        const m = await f.mandate(f.checker, override);
        await expect(f.approve(token, f.checker, m.id)).rejects.toMatchObject({
          status: 403,
        });
      }
      expect((await counters(dataSource)).decisions).toBe(0);
      const exact = await f.mandate(f.checker, { max_amount: '25.125' });
      await f.approve(token, f.checker, exact.id);
    });
  });
  it('AP05 allows bounded direct delegation and rejects chains, expansion and duplicate represented people', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource, { quorum: 2 }),
        row = await f.prepare(),
        token = await f.request(row);
      const rootActor = f.actor(),
        root = await f.mandate(rootActor, { max_amount: '100' }),
        delegate = f.actor();
      const expanded = await f.mandate(delegate, {
        delegated_from_id: root.id,
        max_amount: '101',
      });
      await expect(
        f.approve(token, delegate, expanded.id),
      ).rejects.toMatchObject({ status: 403 });
      const valid = await f.mandate(delegate, {
        delegated_from_id: root.id,
        max_amount: '100',
      });
      await f.approve(token, delegate, valid.id);
      await expect(f.approve(token, rootActor, root.id)).rejects.toMatchObject({
        status: 403,
      });
      const third = f.actor(),
        chain = await f.mandate(third, {
          delegated_from_id: valid.id,
          max_amount: '100',
        });
      await expect(f.approve(token, third, chain.id)).rejects.toMatchObject({
        status: 403,
      });
      const alias = { ...delegate, subjectId: randomUUID() },
        aliasM = await f.mandate(alias);
      await expect(f.approve(token, alias, aliasM.id)).rejects.toMatchObject({
        status: 403,
      });
      await f.approve(token);
      await dataSource.query(
        'UPDATE finance_approval_mandates SET revoked_at=statement_timestamp() WHERE id=$1',
        [root.id],
      );
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'revoked root',
          token,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await dataSource.query(
        'UPDATE finance_approval_mandates SET revoked_at=NULL WHERE id=$1',
        [root.id],
      );
      expect(
        (
          await f.service.validateInactive(
            f.checker,
            f.scope,
            row.id,
            row.subject_hash,
            'bounded quorum',
            token,
          )
        ).state,
      ).toBe('VALIDATED_INACTIVE');
    });
  });
  it('AP06 rechecks revocation and changed mandate limits after approval before consumption', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      await dataSource.query(
        'UPDATE finance_approval_mandates SET revoked_at=statement_timestamp() WHERE id=$1',
        [f.checkerMandate.id],
      );
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'revoked approval',
          token,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await dataSource.query(
        'UPDATE finance_approval_mandates SET revoked_at=NULL,max_amount=100 WHERE id=$1',
        [f.checkerMandate.id],
      );
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'changed mandate subject',
          token,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_approval_requests WHERE id=$1',
            [token.requestId],
          )
        )[0].state,
      ).toBe('OPEN_INACTIVE');
    });
  });
  it('AP07 rejects changed request/beneficiary hashes, changed candidate and another scope', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      for (const wrong of [
        { ...token, requestHash: 'a'.repeat(64) },
        { ...token, beneficiaryHash: 'a'.repeat(64) },
      ])
        await expect(
          f.service.validateInactive(
            f.checker,
            f.scope,
            row.id,
            row.subject_hash,
            'changed frozen subject',
            wrong,
          ),
        ).rejects.toMatchObject({ status: 409 });
      const next = f.input();
      next.economicSourceId = 'other-source';
      const other = await f.prepare(next);
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          other.id,
          other.subject_hash,
          'wrong candidate',
          token,
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        f.approvals.decideInactive(
          { ...f.checker, tenantId: randomUUID() },
          f.scope,
          token,
          f.checkerMandate.id,
          'APPROVED_INACTIVE',
          'other tenant',
        ),
      ).rejects.toMatchObject({ status: 403 });
    });
  });
  it('AP08 rejection is audited, immutable and cannot later be consumed or revived', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approvals.decideInactive(
        f.checker,
        f.scope,
        token,
        f.checkerMandate.id,
        'REJECTED_INACTIVE',
        'independent rejection',
      );
      await expect(f.approve(token)).rejects.toMatchObject({ status: 409 });
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'rejected subject',
          token,
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        dataSource.query(
          "UPDATE finance_approval_requests SET state='OPEN_INACTIVE' WHERE id=$1",
          [token.requestId],
        ),
      ).rejects.toThrow('immutable');
      expect((await counters(dataSource)).events).toBe(2);
    });
  });
  it('AP09 audit failure rolls back decisions and does not consume the request', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await dataSource.query(
        `CREATE FUNCTION fail_approval_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='APPROVED_INACTIVE' THEN RAISE EXCEPTION 'controlled approval audit failure'; END IF; RETURN NEW; END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_approval_audit BEFORE INSERT ON finance_approval_events FOR EACH ROW EXECUTE FUNCTION fail_approval_audit()',
      );
      await expect(f.approve(token)).rejects.toThrow(
        'controlled approval audit failure',
      );
      expect((await counters(dataSource)).decisions).toBe(0);
      expect((await counters(dataSource)).events).toBe(1);
    });
  });
  it('AP10 candidate audit failure rolls back both validation and approval consumption', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      await dataSource.query(
        `CREATE FUNCTION fail_validated_candidate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='VALIDATED_INACTIVE' THEN RAISE EXCEPTION 'controlled final audit failure'; END IF; RETURN NEW; END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_validated_candidate BEFORE INSERT ON finance_journal_candidate_events FOR EACH ROW EXECUTE FUNCTION fail_validated_candidate()',
      );
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'audit rollback',
          token,
        ),
      ).rejects.toThrow('controlled final audit failure');
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_approval_requests WHERE id=$1',
            [token.requestId],
          )
        )[0].state,
      ).toBe('OPEN_INACTIVE');
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_journal_candidates WHERE id=$1',
            [row.id],
          )
        )[0].state,
      ).toBe('PREPARED_INACTIVE');
      expect((await counters(dataSource)).events).toBe(2);
    });
  });
  it('AP11 expiry after final audit rolls back consumption and preserves approval evidence', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      await dataSource.query(
        `CREATE FUNCTION expire_approval_mandate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='VALIDATED_INACTIVE' THEN UPDATE finance_approval_mandates SET valid_to=statement_timestamp()-interval '1 second'; END IF; RETURN NEW; END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER expire_approval_mandate AFTER INSERT ON finance_journal_candidate_events FOR EACH ROW EXECUTE FUNCTION expire_approval_mandate()',
      );
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'expired at commit',
          token,
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_approval_requests WHERE id=$1',
            [token.requestId],
          )
        )[0].state,
      ).toBe('OPEN_INACTIVE');
      expect((await counters(dataSource)).decisions).toBe(1);
    });
  });
  it('AP12 denies a genuinely expired request using database time', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource, { ttlSeconds: 1 }),
        row = await f.prepare(),
        token = await f.request(row);
      await dataSource.query('SELECT pg_sleep(1.1)');
      await expect(f.approve(token)).rejects.toMatchObject({ status: 403 });
      expect((await counters(dataSource)).decisions).toBe(0);
    });
  });
  it('AP13 exposes only a scoped pinned redacted audit view and performs no hidden writes', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row, beneficiary(randomUUID()));
      await f.approve(token);
      const reader = f.actor();
      await f.grant(reader, 'READ_CANDIDATE_AUDIT');
      const before = await counters(dataSource),
        view = await f.approvals.readAudit(reader, f.scope, token);
      expect(view.events).toHaveLength(2);
      expect(view.request_hash).toBe(token.requestHash);
      const encoded = JSON.stringify(view);
      expect(encoded).not.toContain('restricted-payee-reference');
      expect(encoded).not.toContain(f.checker.naturalPersonId);
      expect(encoded).not.toContain('reason');
      await expect(
        f.approvals.readAudit(f.checker, f.scope, token),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.approvals.readAudit(
          { ...reader, tenantId: randomUUID() },
          f.scope,
          token,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.approvals.readAudit(
          reader,
          { ...f.scope, bookId: f.books[1].id },
          token,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.approvals.readAudit(reader, f.scope, {
          ...token,
          requestHash: 'a'.repeat(64),
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(await counters(dataSource)).toEqual(before);
    });
  });
  it('AP14 protects request/decision history and requires consumed approval at the database commit boundary', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      for (const sql of [
        "UPDATE finance_approval_requests SET beneficiary='{}'::jsonb",
        'DELETE FROM finance_approval_events',
        "UPDATE finance_approval_decisions SET mandate_hash=repeat('a',64)",
        'TRUNCATE finance_approval_decisions',
      ])
        await expect(dataSource.query(sql)).rejects.toThrow();
      await expect(
        dataSource.query(
          "UPDATE finance_journal_candidates SET state='VALIDATED_INACTIVE',checker_subject_id=$2,checker_natural_person_id=$3,validated_at=statement_timestamp() WHERE id=$1",
          [row.id, f.checker.subjectId, f.checker.naturalPersonId],
        ),
      ).rejects.toThrow('consumed approval');
      await expect(
        dataSource.query(
          "UPDATE finance_approval_requests SET state='CONSUMED_INACTIVE',consumed_subject_id=$2,consumed_natural_person_id=$3 WHERE id=$1",
          [token.requestId, f.checker.subjectId, f.checker.naturalPersonId],
        ),
      ).rejects.toThrow('atomic audit');
    });
  });
  it('AP15 serializes competing decisions by one natural person and retains one independent vote', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      const results = await Promise.allSettled([
        f.approve(token),
        f.approve(token),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await counters(dataSource)).decisions).toBe(1);
    });
  });
  it('AP16 migrates empty governance without default mandates and refuses populated rollback', async () => {
    await configured(async ({ dataSource }) => {
      expect(
        (
          await dataSource.query(
            'SELECT count(*)::integer AS count FROM finance_approval_mandates',
          )
        )[0].count,
      ).toBe(0);
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_approval_requests') AS name",
          )
        )[0].name,
      ).toBeNull();
      await dataSource.runMigrations({ transaction: 'all' });
      await createCandidateFixture(dataSource);
      await expect(
        dataSource.undoLastMigration({ transaction: 'all' }),
      ).rejects.toThrow('requires empty');
    });
  });
  it('AP17 holds approval when its exact independently reviewed profile is superseded', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      const next = await f.config.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'APPROVAL_RULES',
          key: 'SYNTHETIC-APPROVAL',
          version: 2,
          effectiveFrom: '2026-01-01',
          dependencyRefs: ['DEC-11', 'DEC-14'],
          supersedesId: f.profile.id,
          payload: { ...f.profile.payload, requiredCheckers: 2 },
        },
        'new inactive quorum subject',
      );
      await f.config.submit(
        f.maker,
        f.scope,
        next.id,
        next.release_hash,
        'new profile submission',
      );
      await f.config.reviewInactive(
        f.checker,
        f.scope,
        next.id,
        next.release_hash,
        'REVIEWED_INACTIVE',
        'new profile review',
      );
      await expect(
        f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'stale profile',
          token,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_approval_requests WHERE id=$1',
            [token.requestId],
          )
        )[0].state,
      ).toBe('OPEN_INACTIVE');
    });
  });
  it('AP18 refuses forged consumption without quorum even with both apparently matching audit events', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await expect(
        f.approvals.consumeInactive(
          dataSource.manager,
          f.checker,
          f.scope,
          row,
          token,
          'outside transaction',
          [],
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        dataSource.transaction(async (manager) => {
          await manager.query(
            "UPDATE finance_approval_requests SET state='CONSUMED_INACTIVE',consumed_subject_id=$2,consumed_natural_person_id=$3 WHERE id=$1",
            [token.requestId, f.checker.subjectId, f.checker.naturalPersonId],
          );
          await manager.query(
            "INSERT INTO finance_approval_events (tenant_id,legal_entity_id,book_id,request_id,action,request_hash,actor_subject_id,actor_natural_person_id,reason) VALUES ($1,$2,$3,$4,'CONSUMED_INACTIVE',$5,$6,$7,'controlled missing-quorum bypass')",
            [
              f.tenantId,
              f.scope.legalEntityId,
              f.scope.bookId,
              token.requestId,
              token.requestHash,
              f.checker.subjectId,
              f.checker.naturalPersonId,
            ],
          );
          await manager.query(
            "UPDATE finance_journal_candidates SET state='VALIDATED_INACTIVE',checker_subject_id=$2,checker_natural_person_id=$3,validated_at=statement_timestamp() WHERE id=$1",
            [row.id, f.checker.subjectId, f.checker.naturalPersonId],
          );
          const [grant] = await manager.query(
            "SELECT id FROM finance_journal_candidate_authorities WHERE subject_id=$1 AND permission='VALIDATE_CANDIDATE'",
            [f.checker.subjectId],
          );
          await manager.query(
            "INSERT INTO finance_journal_candidate_events (tenant_id,legal_entity_id,book_id,period_id,period_revision,candidate_id,action,subject_hash,actor_subject_id,actor_natural_person_id,authority_id,reason) VALUES ($1,$2,$3,$4,$5,$6,'VALIDATED_INACTIVE',$7,$8,$9,$10,'controlled matching-audit bypass')",
            [
              f.tenantId,
              f.scope.legalEntityId,
              f.scope.bookId,
              f.period.id,
              f.period.revision,
              row.id,
              row.subject_hash,
              f.checker.subjectId,
              f.checker.naturalPersonId,
              grant.id,
            ],
          );
        }),
      ).rejects.toThrow('quorum');
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_approval_requests WHERE id=$1',
            [token.requestId],
          )
        )[0].state,
      ).toBe('OPEN_INACTIVE');
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
  it('AP19 freezes the requested approval token before a real book-lock wait', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createCandidateFixture(dataSource),
        row = await f.prepare(),
        token = await f.request(row);
      await f.approve(token);
      const supplied = { ...token, beneficiaryHash: 'a'.repeat(64) };
      const blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      let job: Promise<unknown> | undefined;
      try {
        await blocker.query(
          'SELECT id FROM finance_accounting_books WHERE id=$1 FOR UPDATE',
          [f.scope.bookId],
        );
        job = f.service.validateInactive(
          f.checker,
          f.scope,
          row.id,
          row.subject_hash,
          'frozen request while queued',
          supplied,
        );
        const outcome = Promise.allSettled([job]);
        let waiting = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          const [activity] = await dataSource.query(
            "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%finance_accounting_books%' AND query LIKE '%FOR UPDATE%'",
          );
          if (activity.count > 0) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        if (!waiting)
          throw new Error(
            'Validation was not observed waiting on its book lock',
          );
        supplied.beneficiaryHash = token.beneficiaryHash;
        await blocker.commitTransaction();
        const [result] = await outcome;
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected')
          expect(result.reason).toMatchObject({ status: 409 });
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        if (job) await Promise.allSettled([job]);
        await blocker.release();
      }
      expect(
        (
          await dataSource.query(
            'SELECT state FROM finance_approval_requests WHERE id=$1',
            [token.requestId],
          )
        )[0].state,
      ).toBe('OPEN_INACTIVE');
    });
  });
});
