import { ensureFinanceUuidV4 } from '../../src/database/finance-uuid-v4';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import type { QueryRunner } from 'typeorm';

describe('Finance UUID compatibility', () => {
  it('uses the existing uuid-ossp generator when the built-in is unavailable', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      const runner = dataSource.createQueryRunner();
      try {
        await runner.query(
          'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public',
        );
        // Exercise the legacy-server branch on this disposable modern PostgreSQL.
        const legacyProbe = {
          query: (sql: string) =>
            runner.query(
              sql.replace(
                "to_regprocedure('pg_catalog.gen_random_uuid()')",
                'NULL::regprocedure',
              ),
            ),
        } as unknown as QueryRunner;
        await ensureFinanceUuidV4(legacyProbe);
        const [row] = await dataSource.query(
          "SELECT public.finance_uuid_v4()::text AS id, pg_get_functiondef('public.finance_uuid_v4()'::regprocedure) AS definition",
        );
        expect(row.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(row.definition).toContain('public.uuid_generate_v4()');
      } finally {
        await runner.release();
      }
    });
  });
  it('installs an idempotent UUID v4 generator without creating posting authority', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      const runner = dataSource.createQueryRunner();
      try {
        await ensureFinanceUuidV4(runner);
        await ensureFinanceUuidV4(runner);
        const [row] = await dataSource.query(
          `SELECT public.finance_uuid_v4()::text AS first, public.finance_uuid_v4()::text AS second, to_regclass('public.finance_policy_posting_releases') AS releases`,
        );
        expect(row.first).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(row.second).not.toBe(row.first);
        expect(row.releases).toBeNull();
      } finally {
        await runner.release();
      }
    });
  });
});
