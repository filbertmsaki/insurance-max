import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-membership removal of permissions that a role would otherwise grant. */
export class CompanyUserPermissionExclusions1795400000000 implements MigrationInterface {
  name = 'CompanyUserPermissionExclusions1795400000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS company_user_permission_exclusions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_user_id uuid NOT NULL REFERENCES company_users(id) ON DELETE CASCADE,
        permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_user_permission_exclusions_membership_permission"
          UNIQUE (company_user_id, permission_id)
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `DROP TABLE IF EXISTS company_user_permission_exclusions`,
    );
  }
}
