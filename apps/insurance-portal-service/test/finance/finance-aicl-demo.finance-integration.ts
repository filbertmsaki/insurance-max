import { randomUUID } from 'node:crypto';
import { seedAiclFin01Demo } from '../../src/database/seeds/aicl-fin-01-demo.seed';
import { withFinanceTestDatabase } from '../support/finance-test-database';

const run = (work: Parameters<typeof withFinanceTestDatabase>[0]) =>
  withFinanceTestDatabase(work, process.env, 'scope-foundations');

describe('AICL isolated demo seeder', () => {
  it('rejects missing demo approval and production mode before accessing the database', () =>
    run(async ({ dataSource }) => {
      await expect(
        seedAiclFin01Demo(dataSource, {
          apply: true,
          env: { ...process.env, FINANCE_AICL_DEMO_SEED: '0' },
        }),
      ).rejects.toThrow('isolated');
      await expect(
        seedAiclFin01Demo(dataSource, {
          apply: true,
          env: {
            ...process.env,
            FINANCE_AICL_DEMO_SEED: '1',
            NODE_ENV: 'production',
          },
        }),
      ).rejects.toThrow('isolated');
      expect(
        await dataSource.query(
          'SELECT count(*)::int n FROM finance_legal_entities',
        ),
      ).toEqual([{ n: 0 }]);
    }));

  it('creates only draft rows, supports dry run, and is idempotent', () =>
    run(async ({ dataSource }) => {
      await dataSource.query(
        'CREATE TABLE companies(id uuid PRIMARY KEY, name text, slug text, deleted_at timestamptz)',
      );
      await dataSource.query(
        'CREATE TABLE finance_foundation_identity_bindings(tenant_id uuid,source_company_id uuid,valid_from timestamptz,valid_to timestamptz,revoked_at timestamptz)',
      );
      const company = randomUUID(),
        tenant = randomUUID();
      await dataSource.query(
        "INSERT INTO companies VALUES($1,'ALLIANCE INSURANCE CORPORATION','alliance-insurance-corporation',NULL)",
        [company],
      );
      await dataSource.query(
        "INSERT INTO finance_foundation_identity_bindings VALUES($1,$2,statement_timestamp()-interval '1 day',NULL,NULL)",
        [tenant, company],
      );
      const env = { ...process.env, FINANCE_AICL_DEMO_SEED: '1' };
      const dry = await seedAiclFin01Demo(dataSource, { apply: false, env });
      expect(dry.mode).toBe('DRY_RUN');
      expect(
        await dataSource.query(
          'SELECT count(*)::int n FROM finance_legal_entities',
        ),
      ).toEqual([{ n: 0 }]);
      const first = await seedAiclFin01Demo(dataSource, { apply: true, env });
      expect(first.postingEnabled).toBe(false);
      expect(first.companyId).toBe(company);
      const again = await seedAiclFin01Demo(dataSource, { apply: true, env });
      expect(again.log.every((line) => line.startsWith('reused'))).toBe(true);
      const books = await dataSource.query(
        'SELECT book_code,state,accounting_basis_code,chart_release_id FROM finance_accounting_books ORDER BY book_code',
      );
      expect(books).toHaveLength(3);
      expect(
        books.every(
          (book: any) =>
            book.state === 'DRAFT' &&
            book.accounting_basis_code === null &&
            book.chart_release_id === null,
        ),
      ).toBe(true);
      expect(
        await dataSource.query(
          'SELECT count(*)::int n FROM finance_scope_memberships',
        ),
      ).toEqual([{ n: 0 }]);
      await expect(
        dataSource.query(
          "UPDATE finance_accounting_books SET state='ACTIVE' WHERE book_code='AICL-IFRS-GL'",
        ),
      ).rejects.toThrow();
      await dataSource.query(
        "UPDATE finance_accounting_books SET accounting_basis_code='IFRS' WHERE book_code='AICL-IFRS-GL'",
      );
      await expect(
        seedAiclFin01Demo(dataSource, { apply: true, env }),
      ).rejects.toThrow('Existing book is not an unconfigured draft');
      expect(
        await dataSource.query(
          "SELECT accounting_basis_code FROM finance_accounting_books WHERE book_code='AICL-IFRS-GL'",
        ),
      ).toEqual([{ accounting_basis_code: 'IFRS' }]);
    }));

  it('rejects a mismatched owned cluster before writes', () =>
    run(async ({ dataSource }) => {
      const env = {
        ...process.env,
        FINANCE_AICL_DEMO_SEED: '1',
        FINANCE_TEST_PG_CLUSTER_DIRECTORY: process.cwd(),
      };
      await expect(
        seedAiclFin01Demo(dataSource, { apply: true, env }),
      ).rejects.toThrow('identity');
      expect(
        await dataSource.query(
          'SELECT count(*)::int n FROM finance_legal_entities',
        ),
      ).toEqual([{ n: 0 }]);
    }));
});
