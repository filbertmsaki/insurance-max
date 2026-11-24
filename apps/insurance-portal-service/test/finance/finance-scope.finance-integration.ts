import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinanceLegalEntity } from '../../src/modules/tenant/finance/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/finance/foundation/entities/finance-accounting-book.entity';
import { FinanceScopeMembership } from '../../src/modules/tenant/finance/foundation/entities/finance-scope-membership.entity';
import { FinanceLegalEntitySourceMap } from '../../src/modules/tenant/finance/foundation/entities/finance-legal-entity-source-map.entity';
import { FinanceFoundationModule } from '../../src/modules/tenant/finance/foundation/finance-foundation.module';
import {
  FinanceScopeService,
  type FinancePrincipal,
} from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-scope.service';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';

const scoped = <T>(work: (fixture: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(work, process.env, 'scope-foundations');

async function fixtures(source: DataSource) {
  const [tenantA, tenantB, userA, userB, worker] = Array.from(
    { length: 5 },
    () => randomUUID(),
  );
  const entities = await source.getRepository(FinanceLegalEntity).save([
    {
      tenant_id: tenantA,
      entity_code: 'INSURER',
      legal_name: 'Synthetic insurer',
      business_profile: 'GENERAL_INSURER',
    },
    {
      tenant_id: tenantA,
      entity_code: 'BROKER',
      legal_name: 'Synthetic broker',
      business_profile: 'BROKER',
    },
    {
      tenant_id: tenantB,
      entity_code: 'INSURER',
      legal_name: 'Other tenant insurer',
      business_profile: 'GENERAL_INSURER',
    },
  ]);
  const books = await source.getRepository(FinanceAccountingBook).save([
    {
      tenant_id: tenantA,
      legal_entity_id: entities[0].id,
      book_code: 'PRIMARY',
    },
    {
      tenant_id: tenantA,
      legal_entity_id: entities[0].id,
      book_code: 'COMPARATIVE',
    },
    {
      tenant_id: tenantA,
      legal_entity_id: entities[1].id,
      book_code: 'PRIMARY',
    },
    {
      tenant_id: tenantB,
      legal_entity_id: entities[2].id,
      book_code: 'PRIMARY',
    },
  ]);
  const memberships = await source.getRepository(FinanceScopeMembership).save([
    {
      tenant_id: tenantA,
      legal_entity_id: entities[0].id,
      book_id: books[0].id,
      subject_id: userA,
      subject_kind: 'USER',
      state: 'ENABLED',
      authority_reference: 'SYNTHETIC-READ-A',
      valid_from: new Date('2020-01-01T00:00:00Z'),
    },
    {
      tenant_id: tenantA,
      legal_entity_id: entities[0].id,
      book_id: books[1].id,
      subject_id: userB,
      subject_kind: 'USER',
      state: 'ENABLED',
      authority_reference: 'SYNTHETIC-READ-B',
      valid_from: new Date('2020-01-01T00:00:00Z'),
    },
    {
      tenant_id: tenantA,
      legal_entity_id: entities[1].id,
      book_id: books[2].id,
      subject_id: worker,
      subject_kind: 'WORKER',
      state: 'ENABLED',
      authority_reference: 'SYNTHETIC-WORKER',
      valid_from: new Date('2020-01-01T00:00:00Z'),
    },
  ]);
  const principal: FinancePrincipal = {
    tenantId: tenantA,
    subjectId: userA,
    kind: 'USER',
  };
  const selection = { legalEntityId: entities[0].id, bookId: books[0].id };
  return {
    tenantA,
    tenantB,
    userA,
    userB,
    worker,
    entities,
    books,
    memberships,
    principal,
    selection,
  };
}

describe('Finance scope foundations on migrated PostgreSQL (B05 draft slice)', () => {
  it('FS01 runs an empty additive migration with draft defaults and no assumed currencies or mappings', async () => {
    await scoped(async ({ dataSource }) => {
      for (const entity of [
        FinanceLegalEntity,
        FinanceAccountingBook,
        FinanceScopeMembership,
        FinanceLegalEntitySourceMap,
      ])
        expect(await dataSource.getRepository(entity).count()).toBe(0);
      const [history] = await dataSource.query('SELECT name FROM migrations');
      expect(history.name).toBe('FinanceScopeFoundations1796000000000');
      const f = await fixtures(dataSource);
      const book = await dataSource
        .getRepository(FinanceAccountingBook)
        .findOneByOrFail({ id: f.books[0].id });
      expect(book).toMatchObject({
        state: 'DRAFT',
        accounting_basis_code: null,
        functional_assessment_id: null,
        calendar_id: null,
        chart_release_id: null,
        presentation_context_id: null,
      });
      expect(f.entities.map((e) => e.state)).toEqual([
        'DRAFT',
        'DRAFT',
        'DRAFT',
      ]);
      expect(
        await dataSource.getRepository(FinanceLegalEntitySourceMap).count(),
      ).toBe(0);
    });
  });

  it('FS02 rejects cross-tenant entity, book, membership and source-map references in PostgreSQL', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource);
      await expect(
        dataSource.getRepository(FinanceAccountingBook).save({
          tenant_id: f.tenantA,
          legal_entity_id: f.entities[2].id,
          book_code: 'BAD',
        }),
      ).rejects.toMatchObject({ driverError: { code: '23503' } });
      await expect(
        dataSource.getRepository(FinanceScopeMembership).save({
          tenant_id: f.tenantA,
          legal_entity_id: f.entities[1].id,
          book_id: f.books[0].id,
          subject_id: f.userA,
          subject_kind: 'USER',
          authority_reference: 'TEST',
          valid_from: new Date(),
        }),
      ).rejects.toMatchObject({ driverError: { code: '23503' } });
      await expect(
        dataSource.getRepository(FinanceLegalEntitySourceMap).save({
          tenant_id: f.tenantA,
          legal_entity_id: f.entities[2].id,
          source_system: 'PORTAL',
          source_company_id: 'synthetic-company',
          legal_role: 'INSURER',
          business_profile: 'GENERAL_INSURER',
          mapping_version: 1,
          valid_from: '2020-01-01',
        }),
      ).rejects.toMatchObject({ driverError: { code: '23503' } });
      expect(
        await dataSource.getRepository(FinanceAccountingBook).count(),
      ).toBe(4);
      expect(
        await dataSource.getRepository(FinanceScopeMembership).count(),
      ).toBe(3);
      expect(
        await dataSource.getRepository(FinanceLegalEntitySourceMap).count(),
      ).toBe(0);
    });
  });

  it('FS03 resolves only the enabled exact draft-read membership', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource);
      const result = await new FinanceScopeService(dataSource).resolveDraftRead(
        f.principal,
        f.selection,
      );
      expect(result).toEqual({
        tenantId: f.tenantA,
        legalEntityId: f.entities[0].id,
        bookId: f.books[0].id,
        entityCode: 'INSURER',
        bookCode: 'PRIMARY',
        businessProfile: 'GENERAL_INSURER',
        mode: 'DRAFT_READ_ONLY',
      });
      expect(Object.isFrozen(result)).toBe(true);
      const upper = await new FinanceScopeService(dataSource).resolveDraftRead(
        {
          ...f.principal,
          tenantId: f.tenantA.toUpperCase(),
          subjectId: f.userA.toUpperCase(),
        },
        {
          legalEntityId: f.entities[0].id.toUpperCase(),
          bookId: f.books[0].id.toUpperCase(),
        },
      );
      expect(upper).toEqual(result);
    });
  });

  it('FS04 denies another tenant, entity, book, subject and nonexistent scope without leaking their existence', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource),
        service = new FinanceScopeService(dataSource);
      for (const [principal, selection] of [
        [{ ...f.principal, tenantId: f.tenantB }, f.selection],
        [
          f.principal,
          { legalEntityId: f.entities[1].id, bookId: f.books[2].id },
        ],
        [
          f.principal,
          { legalEntityId: f.entities[0].id, bookId: f.books[1].id },
        ],
        [{ ...f.principal, subjectId: f.userB }, f.selection],
        [f.principal, { legalEntityId: randomUUID(), bookId: randomUUID() }],
      ] as const)
        await expect(
          service.resolveDraftRead(principal, selection),
        ).rejects.toMatchObject({ response: { code: 'FINANCE_SCOPE_DENIED' } });
    });
  });

  it('FS05 distinguishes worker identity from a human with the same subject ID', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource),
        service = new FinanceScopeService(dataSource);
      const selection = {
        legalEntityId: f.entities[1].id,
        bookId: f.books[2].id,
      };
      await expect(
        service.resolveDraftRead(
          { tenantId: f.tenantA, subjectId: f.worker, kind: 'WORKER' },
          selection,
        ),
      ).resolves.toMatchObject({ bookId: f.books[2].id });
      await expect(
        service.resolveDraftRead(
          { tenantId: f.tenantA, subjectId: f.worker, kind: 'USER' },
          selection,
        ),
      ).rejects.toMatchObject({ response: { code: 'FINANCE_SCOPE_DENIED' } });
      await expect(
        service.resolveDraftRead(
          { ...f.principal, kind: 'WORKER' },
          f.selection,
        ),
      ).rejects.toMatchObject({ response: { code: 'FINANCE_SCOPE_DENIED' } });
    });
  });

  it('FS06 denies future, expired, revoked, draft and disabled access using server time', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource),
        service = new FinanceScopeService(dataSource);
      const deny = () =>
        expect(
          service.resolveDraftRead(f.principal, f.selection),
        ).rejects.toMatchObject({ response: { code: 'FINANCE_SCOPE_DENIED' } });
      const id = f.memberships[0].id;
      await dataSource.query(
        "UPDATE finance_scope_memberships SET valid_from = statement_timestamp() + interval '1 hour' WHERE id = $1",
        [id],
      );
      await deny();
      await dataSource.query(
        "UPDATE finance_scope_memberships SET valid_from = '2020-01-01', valid_to = statement_timestamp() - interval '1 second' WHERE id = $1",
        [id],
      );
      await deny();
      await dataSource.query(
        "UPDATE finance_scope_memberships SET valid_to = NULL, state = 'REVOKED' WHERE id = $1",
        [id],
      );
      await deny();
      await dataSource.query(
        "UPDATE finance_scope_memberships SET state = 'DRAFT' WHERE id = $1",
        [id],
      );
      await deny();
      await dataSource.query(
        "UPDATE finance_scope_memberships SET state = 'ENABLED', revoked_at = statement_timestamp() WHERE id = $1",
        [id],
      );
      await deny();
      await dataSource.query(
        'UPDATE finance_scope_memberships SET revoked_at = NULL WHERE id = $1',
        [id],
      );
      await dataSource.query(
        "UPDATE finance_accounting_books SET state = 'DISABLED' WHERE id = $1",
        [f.books[0].id],
      );
      await deny();
      await dataSource.query(
        "UPDATE finance_accounting_books SET state = 'DRAFT' WHERE id = $1",
        [f.books[0].id],
      );
      await dataSource.query(
        "UPDATE finance_legal_entities SET state = 'DISABLED' WHERE id = $1",
        [f.entities[0].id],
      );
      await deny();
    });
  });

  it('FS07 rejects posting-capable book states and duplicate codes in the same scope', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource);
      await expect(
        dataSource.query(
          "UPDATE finance_accounting_books SET state = 'ACTIVE' WHERE id = $1",
          [f.books[0].id],
        ),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      await expect(
        dataSource.getRepository(FinanceAccountingBook).save({
          tenant_id: f.tenantA,
          legal_entity_id: f.entities[0].id,
          book_code: 'PRIMARY',
        }),
      ).rejects.toMatchObject({ driverError: { code: '23505' } });
      await expect(
        dataSource.getRepository(FinanceScopeMembership).save({
          tenant_id: f.tenantA,
          legal_entity_id: f.entities[0].id,
          book_id: f.books[0].id,
          subject_id: randomUUID(),
          subject_kind: 'USER',
          permission: 'POST' as 'READ_DRAFT',
          authority_reference: 'INVALID-POST',
          valid_from: new Date(),
        }),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
    });
  });

  it('FS08 retains explicit versioned draft source roles without inferring tenant from company', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource),
        maps = dataSource.getRepository(FinanceLegalEntitySourceMap);
      const base = {
        tenant_id: f.tenantA,
        legal_entity_id: f.entities[0].id,
        source_system: 'PORTAL',
        source_company_id: 'one-legacy-company',
        legal_role: 'INSURER',
        business_profile: 'GENERAL_INSURER',
        mapping_version: 1,
        valid_from: '2020-01-01',
      };
      // TypeORM save may attach a generated id to its argument. Keep the
      // reusable fixture unchanged so each role/version is a fresh insert.
      await maps.save({ ...base });
      await maps.save({
        ...base,
        legal_entity_id: f.entities[1].id,
        legal_role: 'BROKER',
        business_profile: 'BROKER',
      });
      expect((await maps.find()).map((row) => row.state)).toEqual([
        'DRAFT',
        'DRAFT',
      ]);
      await expect(maps.save({ ...base })).rejects.toMatchObject({
        driverError: { code: '23505' },
      });
      await expect(
        maps.save({ ...base, mapping_version: 0 }),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      await expect(
        maps.save({ ...base, mapping_version: 2, valid_to: '2019-12-31' }),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
    });
  });

  it('FS09 refuses migration rollback when draft records would be lost', async () => {
    await scoped(async ({ dataSource }) => {
      await fixtures(dataSource);
      await expect(
        dataSource.undoLastMigration({ transaction: 'all' }),
      ).rejects.toThrow('empty draft structures');
      expect(await dataSource.getRepository(FinanceLegalEntity).count()).toBe(
        3,
      );
      expect(
        (await dataSource.query('SELECT name FROM migrations')).length,
      ).toBe(1);
    });
  });

  it('FS10 reverses and reapplies the empty migration without altering an unrelated table', async () => {
    await scoped(async ({ dataSource }) => {
      await dataSource.query(
        "CREATE TABLE b05_legacy_sentinel (value text NOT NULL); INSERT INTO b05_legacy_sentinel VALUES ('preserve')",
      );
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(
        await dataSource.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'finance_%'",
        ),
      ).toEqual([]);
      expect(
        await dataSource.query('SELECT value FROM b05_legacy_sentinel'),
      ).toEqual([{ value: 'preserve' }]);
      await dataSource.runMigrations({ transaction: 'all' });
      expect(await dataSource.getRepository(FinanceLegalEntity).count()).toBe(
        0,
      );
      expect(
        await dataSource.query('SELECT value FROM b05_legacy_sentinel'),
      ).toEqual([{ value: 'preserve' }]);
    });
  });

  it('FS11 resolves the real Nest module through an existing isolated DataSource without exposing controllers', async () => {
    await scoped(async ({ dataSource }) => {
      const f = await fixtures(dataSource);
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
        await expect(
          context
            .get(FinanceScopeService)
            .resolveDraftRead(f.principal, f.selection),
        ).resolves.toMatchObject({ mode: 'DRAFT_READ_ONLY' });
        expect(
          Reflect.getMetadata('controllers', FinanceFoundationModule) ?? [],
        ).toEqual([]);
      } finally {
        await context.close();
      }
    });
  });
});
