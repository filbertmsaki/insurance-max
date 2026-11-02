import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * User numbers move from the global users table to the company membership,
 * so each tenant numbers its users 1, 2, 3… independently. Every existing
 * membership is renumbered in creation order. A BEFORE INSERT trigger backed
 * by a per-company counter row assigns numbers for every insert path
 * (services, seeds, raw SQL) and serializes concurrent creates per company.
 */
export class TenantScopedUserNumbers1795100000000 implements MigrationInterface {
  name = 'TenantScopedUserNumbers1795100000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE company_users IN SHARE ROW EXCLUSIVE MODE;

      CREATE TABLE IF NOT EXISTS company_user_number_counters (
        company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
        last_value integer NOT NULL DEFAULT 0
      );

      ALTER TABLE company_users ADD COLUMN IF NOT EXISTS user_no integer;

      UPDATE company_users membership
      SET user_no = ranked.n
      FROM (
        SELECT id, row_number() OVER (PARTITION BY company_id ORDER BY created_at, id) AS n
        FROM company_users
      ) ranked
      WHERE membership.id = ranked.id;

      INSERT INTO company_user_number_counters (company_id, last_value)
      SELECT company_id, max(user_no) FROM company_users GROUP BY company_id
      ON CONFLICT (company_id) DO UPDATE SET last_value = EXCLUDED.last_value;

      ALTER TABLE company_users ALTER COLUMN user_no SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_company_users_company_user_no"
        ON company_users(company_id, user_no);

      CREATE OR REPLACE FUNCTION assign_company_user_no() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.user_no IS NULL THEN
          INSERT INTO company_user_number_counters AS counter (company_id, last_value)
          VALUES (NEW.company_id, 1)
          ON CONFLICT (company_id) DO UPDATE SET last_value = counter.last_value + 1
          RETURNING last_value INTO NEW.user_no;
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS assign_company_user_no ON company_users;
      CREATE TRIGGER assign_company_user_no BEFORE INSERT ON company_users
        FOR EACH ROW EXECUTE FUNCTION assign_company_user_no();

      ALTER TABLE users DROP COLUMN IF EXISTS user_no;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS user_no varchar(30);
      UPDATE users u
      SET user_no = 'USER-' || lpad(ranked.n::text, 5, '0')
      FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM users) ranked
      WHERE u.id = ranked.id;
      ALTER TABLE users ALTER COLUMN user_no SET NOT NULL;
      ALTER TABLE users ADD CONSTRAINT "UQ_users_user_no" UNIQUE (user_no);

      DROP TRIGGER IF EXISTS assign_company_user_no ON company_users;
      DROP FUNCTION IF EXISTS assign_company_user_no();
      DROP INDEX IF EXISTS "UQ_company_users_company_user_no";
      ALTER TABLE company_users DROP COLUMN IF EXISTS user_no;
      DROP TABLE IF EXISTS company_user_number_counters;
    `);
  }
}
