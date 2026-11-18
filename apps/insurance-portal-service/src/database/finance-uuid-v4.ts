import { QueryRunner } from 'typeorm';

/** Install a Finance-scoped UUID generator using an existing database function. */
export async function ensureFinanceUuidV4(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(`DO $$
    BEGIN
      IF to_regprocedure('public.finance_uuid_v4()') IS NULL THEN
        IF to_regprocedure('pg_catalog.gen_random_uuid()') IS NOT NULL THEN
          EXECUTE 'CREATE FUNCTION public.finance_uuid_v4() RETURNS uuid LANGUAGE sql VOLATILE AS ''SELECT pg_catalog.gen_random_uuid()''';
        ELSIF to_regprocedure('public.uuid_generate_v4()') IS NOT NULL THEN
          EXECUTE 'CREATE FUNCTION public.finance_uuid_v4() RETURNS uuid LANGUAGE sql VOLATILE AS ''SELECT public.uuid_generate_v4()''';
        ELSE
          RAISE EXCEPTION 'Finance requires an existing PostgreSQL UUID v4 generator (gen_random_uuid or uuid-ossp).';
        END IF;
      END IF;
    END $$`);
}
