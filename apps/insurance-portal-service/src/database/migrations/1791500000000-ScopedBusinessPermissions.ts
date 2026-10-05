import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive scope metadata for granular grants and reviewed business role bundles. */
export class ScopedBusinessPermissions1791500000000 implements MigrationInterface {
  name = 'ScopedBusinessPermissions1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_user_permissions"
        ADD COLUMN IF NOT EXISTS "data_scope" varchar(20),
        ADD COLUMN IF NOT EXISTS "scope_branch_id" uuid,
        ADD COLUMN IF NOT EXISTS "scope_department_id" uuid
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permission_scopes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        "data_scope" varchar(20) NOT NULL,
        "scope_branch_id" uuid NULL,
        "scope_department_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_role_permission_scopes_role_permission" UNIQUE ("role_id", "permission_id"),
        CONSTRAINT "CHK_role_permission_scopes_data_scope" CHECK ("data_scope" IN ('USER','DEPARTMENT','BRANCH','COMPANY')),
        CONSTRAINT "CHK_role_permission_scopes_scope_target" CHECK (
          ("data_scope" = 'BRANCH' AND "scope_department_id" IS NULL)
          OR ("data_scope" = 'DEPARTMENT' AND "scope_branch_id" IS NULL)
          OR ("data_scope" IN ('USER','COMPANY') AND "scope_branch_id" IS NULL AND "scope_department_id" IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_role_permission_scopes_permission_scope" ON "role_permission_scopes" ("permission_id", "data_scope")`,
    );
    await queryRunner.query(`
      ALTER TABLE "company_user_permissions"
        DROP CONSTRAINT IF EXISTS "CHK_company_user_permissions_data_scope"
    `);
    await queryRunner.query(`
      ALTER TABLE "company_user_permissions"
        ADD CONSTRAINT "CHK_company_user_permissions_data_scope"
        CHECK ("data_scope" IS NULL OR "data_scope" IN ('USER','DEPARTMENT','BRANCH','COMPANY'))
    `);
    await queryRunner.query(`
      ALTER TABLE "company_user_permissions"
        DROP CONSTRAINT IF EXISTS "CHK_company_user_permissions_scope_target"
    `);
    await queryRunner.query(`
      ALTER TABLE "company_user_permissions"
        ADD CONSTRAINT "CHK_company_user_permissions_scope_target"
        CHECK (
          ("data_scope" = 'BRANCH' AND "scope_department_id" IS NULL)
          OR ("data_scope" = 'DEPARTMENT' AND "scope_branch_id" IS NULL)
          OR ("data_scope" IN ('USER','COMPANY') AND "scope_branch_id" IS NULL AND "scope_department_id" IS NULL)
          OR ("data_scope" IS NULL AND "scope_branch_id" IS NULL AND "scope_department_id" IS NULL)
        )
    `);
    await queryRunner.query(`
      UPDATE "company_user_permissions" grant_row
      SET "data_scope" = membership."quotation_policy_data_scope"
      FROM "company_users" membership
      WHERE grant_row."company_user_id" = membership."id"
        AND grant_row."data_scope" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permission_scopes"`);
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" DROP CONSTRAINT IF EXISTS "CHK_company_user_permissions_scope_target"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" DROP CONSTRAINT IF EXISTS "CHK_company_user_permissions_data_scope"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" DROP COLUMN IF EXISTS "scope_department_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" DROP COLUMN IF EXISTS "scope_branch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" DROP COLUMN IF EXISTS "data_scope"`,
    );
  }
}
