import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinanceLegalEntity } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-accounting-book.entity';
import { FinanceLegalEntitySourceMap } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity-source-map.entity';
import { FinanceConfigurationAuthority } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-authority.entity';
import { FinanceConfigurationRelease } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-release.entity';
import { FinanceConfigurationEvent } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-event.entity';
import { FinanceConfigurationService } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.service';
import { FinanceFoundationModule } from '../../src/modules/tenant/billing-commission/foundation/finance-foundation.module';
import type {
  FinanceConfigurationActor,
  FinanceConfigurationInput,
} from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';

const configured = <T>(work: (fixture: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(work, process.env, 'configuration-reviews');
const input = (
  overrides: Partial<FinanceConfigurationInput> = {},
): FinanceConfigurationInput => ({
  kind: 'DIMENSIONS',
  key: 'fixture',
  version: 1,
  effectiveFrom: '2026-01-01',
  payload: { schemaVersion: 1, label: ' exact content ' },
  dependencyRefs: ['DEC-14'],
  ...overrides,
});

async function fixture(source: DataSource) {
  const tenantId = randomUUID(),
    otherTenantId = randomUUID();
  const entity = await source.getRepository(FinanceLegalEntity).save({
    tenant_id: tenantId,
    entity_code: 'SYNTHETIC',
    legal_name: 'Synthetic config entity',
    business_profile: 'GENERAL_INSURER',
  });
  const books = await source.getRepository(FinanceAccountingBook).save([
    { tenant_id: tenantId, legal_entity_id: entity.id, book_code: 'A' },
    { tenant_id: tenantId, legal_entity_id: entity.id, book_code: 'B' },
  ]);
  const maker: FinanceConfigurationActor = {
    tenantId,
    subjectId: randomUUID(),
    naturalPersonId: randomUUID(),
    kind: 'USER',
  };
  const checker: FinanceConfigurationActor = {
    tenantId,
    subjectId: randomUUID(),
    naturalPersonId: randomUUID(),
    kind: 'USER',
  };
  const alias: FinanceConfigurationActor = {
    ...maker,
    subjectId: randomUUID(),
  };
  const scope = { legalEntityId: entity.id, bookId: books[0].id };
  const authority = (
    actor: FinanceConfigurationActor,
    permission: FinanceConfigurationAuthority['permission'],
  ) => ({
    tenant_id: tenantId,
    legal_entity_id: entity.id,
    book_id: books[0].id,
    subject_id: actor.subjectId,
    natural_person_id: actor.naturalPersonId,
    permission,
    state: 'ENABLED' as const,
    authority_reference: 'SYNTHETIC-TEST-AUTHORITY',
    valid_from: new Date('2020-01-01T00:00:00Z'),
  });
  await source
    .getRepository(FinanceConfigurationAuthority)
    .save([
      authority(maker, 'PREPARE_CONFIG'),
      authority(maker, 'REVIEW_CONFIG'),
      authority(checker, 'REVIEW_CONFIG'),
      authority(alias, 'REVIEW_CONFIG'),
    ]);
  const service = new FinanceConfigurationService(source);
  const submitted = async (value: FinanceConfigurationInput = input()) => {
    const row = await service.createDraft(
      maker,
      scope,
      value,
      'fixture preparation',
    );
    return service.submit(
      maker,
      scope,
      row.id,
      row.release_hash,
      'fixture submission',
    );
  };
  return {
    tenantId,
    otherTenantId,
    entity,
    books,
    maker,
    checker,
    alias,
    scope,
    service,
    submitted,
  };
}

describe('Inactive configuration review controls on PostgreSQL (B06)', () => {
  it('CF01 migrates empty governance registries without enabling books or seeding authority', async () => {
    await configured(async ({ dataSource }) => {
      for (const entity of [
        FinanceConfigurationAuthority,
        FinanceConfigurationRelease,
        FinanceConfigurationEvent,
      ])
        expect(await dataSource.getRepository(entity).count()).toBe(0);
      expect(
        (
          await dataSource.query(
            'SELECT name FROM migrations ORDER BY timestamp',
          )
        ).map((r: { name: string }) => r.name),
      ).toEqual([
        'FinanceScopeFoundations1796000000000',
        'FinanceConfigurationReviews1796100000000',
      ]);
    });
  });

  it('CF02 records exact immutable preparation/submission/review evidence while every policy remains inactive', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.submitted();
      const reviewed = await f.service.reviewInactive(
        f.checker,
        f.scope,
        row.id,
        row.release_hash,
        'REVIEWED_INACTIVE',
        'independent content review only',
      );
      expect(reviewed.state).toBe('REVIEWED_INACTIVE');
      expect(reviewed.payload).toEqual({
        schemaVersion: 1,
        label: ' exact content ',
      });
      expect(reviewed.dependency_refs).toEqual(['DEC-14']);
      const events = await dataSource
        .getRepository(FinanceConfigurationEvent)
        .find({ where: { release_id: row.id }, order: { occurred_at: 'ASC' } });
      expect(events.map((e) => e.action)).toEqual([
        'CREATED',
        'SUBMITTED',
        'REVIEWED_INACTIVE',
      ]);
      expect(
        events.every(
          (e) =>
            e.release_hash === row.release_hash &&
            e.details.financialActivation === false,
        ),
      ).toBe(true);
      expect(events[2].actor_natural_person_id).toBe(f.checker.naturalPersonId);
      expect(
        (await dataSource.getRepository(FinanceAccountingBook).find()).every(
          (book) => book.state === 'DRAFT',
        ),
      ).toBe(true);
    });
  });

  it('CF03 denies the preparer and a different account for the same human despite reviewer grants', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.submitted();
      for (const actor of [f.maker, f.alias])
        await expect(
          f.service.reviewInactive(
            actor,
            f.scope,
            row.id,
            row.release_hash,
            'REVIEWED_INACTIVE',
            'self review attempt',
          ),
        ).rejects.toMatchObject({ status: 403 });
      expect(
        (
          await dataSource
            .getRepository(FinanceConfigurationRelease)
            .findOneByOrFail({ id: row.id })
        ).state,
      ).toBe('SUBMITTED');
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(2);
    });
  });

  it('CF04 denies other tenants/books, natural-person substitution, workers and revoked authority', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await expect(
        f.service.createDraft(
          { ...f.maker, tenantId: f.otherTenantId },
          f.scope,
          input(),
          'test',
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.service.createDraft(
          f.maker,
          { ...f.scope, bookId: f.books[1].id },
          input(),
          'test',
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.service.createDraft(
          { ...f.maker, naturalPersonId: f.checker.naturalPersonId },
          f.scope,
          input(),
          'test',
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.service.createDraft(
          {
            ...f.maker,
            kind: 'WORKER',
          } as unknown as FinanceConfigurationActor,
          f.scope,
          input(),
          'test',
        ),
      ).rejects.toMatchObject({ status: 403 });
      await dataSource
        .getRepository(FinanceConfigurationAuthority)
        .update({ subject_id: f.maker.subjectId }, { state: 'REVOKED' });
      await expect(
        f.service.createDraft(f.maker, f.scope, input(), 'test'),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        await dataSource.getRepository(FinanceConfigurationRelease).count(),
      ).toBe(0);
    });
  });

  it('CF05 detaches caller input before asynchronous work and rejects duplicate versions or stale hashes', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        value = input(),
        actor = { ...f.maker },
        selection = { ...f.scope };
      const pending = f.service.createDraft(
        actor,
        selection,
        value,
        'detached subject',
      );
      value.payload!.label = 'mutated';
      value.version = 99;
      actor.tenantId = f.otherTenantId;
      selection.bookId = f.books[1].id;
      const row = await pending;
      expect(row.version).toBe(1);
      expect(row.tenant_id).toBe(f.tenantId);
      expect(row.payload.label).toBe(' exact content ');
      await expect(
        f.service.createDraft(f.maker, f.scope, input(), 'duplicate'),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        f.service.submit(
          f.maker,
          f.scope,
          row.id,
          '0'.repeat(64),
          'stale hash',
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await dataSource.getRepository(FinanceConfigurationRelease).count(),
      ).toBe(1);
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(1);
    });
  });

  it('CF06 handles half-open adjacent intervals and gaps but rejects reviewed overlaps and an open-ended collision', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      const review = async (version: number, from: string, to?: string) => {
        const row = await f.submitted(
          input({ version, effectiveFrom: from, effectiveTo: to }),
        );
        return f.service.reviewInactive(
          f.checker,
          f.scope,
          row.id,
          row.release_hash,
          'REVIEWED_INACTIVE',
          'interval review',
        );
      };
      await review(1, '2026-01-01', '2026-02-01');
      await review(2, '2026-02-01', '2026-03-01');
      await review(3, '2026-04-01', '2026-05-01');
      await expect(review(4, '2026-01-15', '2026-02-15')).rejects.toMatchObject(
        { status: 409 },
      );
      await review(5, '2026-05-01');
      await expect(review(6, '2030-01-01', '2031-01-01')).rejects.toMatchObject(
        { status: 409 },
      );
      expect(
        await dataSource
          .getRepository(FinanceConfigurationRelease)
          .countBy({ state: 'REVIEWED_INACTIVE' }),
      ).toBe(4);
    });
  });

  it('CF07 serializes two real waiting review sessions so only one overlapping candidate is reviewed', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        a = await f.submitted(),
        b = await f.submitted(input({ version: 2 }));
      const blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      await blocker.query(
        'SELECT id FROM finance_accounting_books WHERE id = $1 FOR UPDATE',
        [f.scope.bookId],
      );
      const pending = [a, b].map((row) =>
        f.service.reviewInactive(
          f.checker,
          f.scope,
          row.id,
          row.release_hash,
          'REVIEWED_INACTIVE',
          'concurrent review',
        ),
      );
      // Attach rejection handlers before unblocking competing sessions.
      const completion = Promise.allSettled(pending);
      try {
        const deadline = Date.now() + 5000;
        let waiting = 0;
        while (Date.now() < deadline) {
          const [locks] = await dataSource.query(
            "SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND (query LIKE '%finance_accounting_books%' OR query LIKE '%pg_advisory_xact_lock%')",
          );
          waiting = locks.waiting;
          if (waiting >= 2) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBeGreaterThanOrEqual(2);
        await blocker.commitTransaction();
        const results = await completion;
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
        expect(
          await dataSource
            .getRepository(FinanceConfigurationRelease)
            .countBy({ state: 'REVIEWED_INACTIVE' }),
        ).toBe(1);
        expect(
          await dataSource.getRepository(FinanceConfigurationEvent).count(),
        ).toBe(5);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await blocker.release();
        await completion;
      }
    });
  });

  it('CF08 supersedes an exact reviewed predecessor atomically without rewriting either snapshot', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        old = await f.submitted();
      await f.service.reviewInactive(
        f.checker,
        f.scope,
        old.id,
        old.release_hash,
        'REVIEWED_INACTIVE',
        'old review',
      );
      const next = await f.submitted(
        input({
          version: 2,
          effectiveFrom: '2027-01-01',
          supersedesId: old.id,
          payload: { schemaVersion: 1, label: 'new version' },
        }),
      );
      await f.service.reviewInactive(
        f.checker,
        f.scope,
        next.id,
        next.release_hash,
        'REVIEWED_INACTIVE',
        'explicit supersession',
      );
      const original = await dataSource
        .getRepository(FinanceConfigurationRelease)
        .findOneByOrFail({ id: old.id });
      expect(original).toMatchObject({
        state: 'SUPERSEDED_INACTIVE',
        release_hash: old.release_hash,
        effective_from: '2026-01-01',
        effective_to: null,
        payload: old.payload,
      });
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(7);
    });
  });

  it('CF09 captures explicit source roles and rejects drift, ambiguity or mismatched source scope/profile', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        maps = dataSource.getRepository(FinanceLegalEntitySourceMap);
      const base = {
        tenant_id: f.tenantId,
        legal_entity_id: f.entity.id,
        source_system: 'PORTAL',
        source_company_id: 'synthetic-company',
        legal_role: 'INSURER',
        business_profile: 'GENERAL_INSURER',
        mapping_version: 1,
        valid_from: '2020-01-01',
      };
      const source = await maps.save({ ...base });
      const row = await f.submitted(
        input({
          kind: 'SOURCE_ASSOCIATIONS',
          payload: undefined,
          sourceMapIds: [source.id],
        }),
      );
      await maps.update(source.id, { legal_role: 'CHANGED-DRAFT-ROLE' });
      await expect(
        f.service.reviewInactive(
          f.checker,
          f.scope,
          row.id,
          row.release_hash,
          'REVIEWED_INACTIVE',
          'stale source',
        ),
      ).rejects.toMatchObject({ status: 409 });
      await maps.update(source.id, { legal_role: 'INSURER' });
      const second = await maps.save({ ...base, mapping_version: 2 });
      await expect(
        f.service.createDraft(
          f.maker,
          f.scope,
          input({
            kind: 'SOURCE_ASSOCIATIONS',
            version: 2,
            payload: undefined,
            sourceMapIds: [source.id, second.id],
          }),
          'ambiguous originals',
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        f.service.createDraft(
          f.maker,
          f.scope,
          input({
            kind: 'SOURCE_ASSOCIATIONS',
            version: 3,
            payload: undefined,
            sourceMapIds: [randomUUID()],
          }),
          'unknown source',
        ),
      ).rejects.toMatchObject({ status: 409 });
      await maps.update(source.id, { business_profile: 'BROKER' });
      await expect(
        f.service.createDraft(
          f.maker,
          f.scope,
          input({
            kind: 'SOURCE_ASSOCIATIONS',
            version: 4,
            payload: undefined,
            sourceMapIds: [source.id],
          }),
          'wrong profile',
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect((await maps.find()).every((map) => map.state === 'DRAFT')).toBe(
        true,
      );
    });
  });

  it('CF10 enforces immutable content, append-only audit and an audit event in the same transaction', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.service.createDraft(f.maker, f.scope, input(), 'created');
      await expect(
        dataSource
          .getRepository(FinanceConfigurationRelease)
          .update(row.id, { payload: { changed: true } }),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      await expect(
        dataSource.query('DELETE FROM finance_configuration_events'),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      await expect(
        dataSource.query('TRUNCATE finance_configuration_events'),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      await expect(
        dataSource.query(
          "UPDATE finance_configuration_releases SET state = 'SUBMITTED' WHERE id = $1",
          [row.id],
        ),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      expect(
        (
          await dataSource
            .getRepository(FinanceConfigurationRelease)
            .findOneByOrFail({ id: row.id })
        ).state,
      ).toBe('DRAFT');
    });
  });

  it('CF11 rolls back a state change when its required audit insertion fails', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.service.createDraft(f.maker, f.scope, input(), 'created');
      await dataSource.query(
        "CREATE FUNCTION test_fail_config_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'SUBMITTED' THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_fail_config_audit BEFORE INSERT ON finance_configuration_events FOR EACH ROW EXECUTE FUNCTION test_fail_config_audit()",
      );
      await expect(
        f.service.submit(f.maker, f.scope, row.id, row.release_hash, 'submit'),
      ).rejects.toThrow('controlled audit failure');
      expect(
        (
          await dataSource
            .getRepository(FinanceConfigurationRelease)
            .findOneByOrFail({ id: row.id })
        ).state,
      ).toBe('DRAFT');
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(1);
    });
  });

  it('CF12 rechecks authority validity after the write and rolls back controlled mid-command expiry', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await dataSource.query(
        "CREATE FUNCTION test_expire_config_authority() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE finance_configuration_authorities SET valid_to = statement_timestamp() - interval '1 second' WHERE subject_id = NEW.actor_subject_id AND permission = 'PREPARE_CONFIG'; RETURN NEW; END $$; CREATE TRIGGER test_expire_config_authority BEFORE INSERT ON finance_configuration_events FOR EACH ROW EXECUTE FUNCTION test_expire_config_authority()",
      );
      await expect(
        f.service.createDraft(
          f.maker,
          f.scope,
          input(),
          'expires during audit',
        ),
      ).rejects.toThrow('expired before completion');
      expect(
        await dataSource.getRepository(FinanceConfigurationRelease).count(),
      ).toBe(0);
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(0);
    });
  });

  it('CF13 protects populated governance rollback and leaves B05 intact when an empty migration is reversed', async () => {
    await configured(async ({ dataSource }) => {
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(await dataSource.getRepository(FinanceLegalEntity).count()).toBe(
        0,
      );
      await dataSource.runMigrations({ transaction: 'all' });
      await fixture(dataSource);
      await expect(
        dataSource.undoLastMigration({ transaction: 'all' }),
      ).rejects.toThrow('empty governance structures');
      expect(
        await dataSource.getRepository(FinanceConfigurationAuthority).count(),
      ).toBe(4);
    });
  });

  it('CF14 resolves the configuration service through Nest without public controllers or activation', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
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
        const row = await context
          .get(FinanceConfigurationService)
          .createDraft(f.maker, f.scope, input(), 'Nest wiring');
        expect(row.state).toBe('DRAFT');
        expect(
          Reflect.getMetadata('controllers', FinanceFoundationModule) ?? [],
        ).toEqual([]);
        await expect(
          dataSource.query(
            "UPDATE finance_configuration_releases SET state = 'ACTIVE' WHERE id = $1",
            [row.id],
          ),
        ).rejects.toMatchObject({ driverError: { code: '23514' } });
      } finally {
        await context.close();
      }
    });
  });

  it('CF15 records an independent rejection without permitting a later review or activation of that version', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        row = await f.submitted();
      await f.service.reviewInactive(
        f.checker,
        f.scope,
        row.id,
        row.release_hash,
        'REJECTED',
        'unsupported proposal',
      );
      await expect(
        f.service.reviewInactive(
          f.checker,
          f.scope,
          row.id,
          row.release_hash,
          'REVIEWED_INACTIVE',
          'retry',
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await dataSource
            .getRepository(FinanceConfigurationRelease)
            .findOneByOrFail({ id: row.id })
        ).state,
      ).toBe('REJECTED');
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(3);
    });
  });
});
