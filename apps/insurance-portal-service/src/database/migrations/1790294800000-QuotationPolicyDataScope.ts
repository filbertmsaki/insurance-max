import { MigrationInterface, QueryRunner } from 'typeorm';

const MANAGE_DATA_SCOPE_PERMISSION = 'users:manage-data-scope';

export class QuotationPolicyDataScope1790294800000 implements MigrationInterface {
  name = 'QuotationPolicyDataScope1790294800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_users"
      ADD COLUMN IF NOT EXISTS "quotation_policy_data_scope" varchar(20) NOT NULL DEFAULT 'USER'
    `);

    await queryRunner.query(`
      ALTER TABLE "company_users"
      DROP CONSTRAINT IF EXISTS "CHK_company_users_quotation_policy_data_scope"
    `);

    await queryRunner.query(`
      ALTER TABLE "company_users"
      ADD CONSTRAINT "CHK_company_users_quotation_policy_data_scope"
      CHECK ("quotation_policy_data_scope" IN ('USER', 'DEPARTMENT', 'BRANCH', 'COMPANY'))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_company_users_data_scope"
      ON "company_users" ("company_id", "quotation_policy_data_scope")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_data_scope_owner"
      ON "quotations" ("company_id", "created_by")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_data_scope_department"
      ON "quotations" ("company_id", "department_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_data_scope_branch"
      ON "quotations" ("company_id", "branch_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_data_scope_owner"
      ON "policies" ("company_id", "created_by")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_data_scope_department"
      ON "policies" ("company_id", "department_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_data_scope_branch"
      ON "policies" ("company_id", "branch_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(
      `
      INSERT INTO "permissions" (
        "id",
        "name",
        "display_name",
        "description",
        "is_system_generated",
        "assignment_scope",
        "assignable_to_company_role",
        "assignable_to_platform_role",
        "is_deprecated"
      )
      VALUES (
        uuid_generate_v4(),
        $1,
        'Manage User Data Scope',
        'Change a user quotation and policy data access scope.',
        true,
        'tenant',
        true,
        false,
        false
      )
      ON CONFLICT ("name") DO NOTHING
    `,
      [MANAGE_DATA_SCOPE_PERMISSION],
    );

    await queryRunner.query(
      `
      INSERT INTO "permission_role" ("roles_id", "permissions_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."is_administrative" = true
        AND permission."name" = $1
      ON CONFLICT DO NOTHING
    `,
      [MANAGE_DATA_SCOPE_PERMISSION],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "permission_role" permission_role
      USING "permissions" permission
      WHERE permission_role."permissions_id" = permission."id"
        AND permission."name" = $1
    `,
      [MANAGE_DATA_SCOPE_PERMISSION],
    );

    await queryRunner.query(`DELETE FROM "permissions" WHERE "name" = $1`, [
      MANAGE_DATA_SCOPE_PERMISSION,
    ]);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policies_data_scope_branch"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policies_data_scope_department"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policies_data_scope_owner"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_data_scope_branch"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_data_scope_department"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_data_scope_owner"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_users_data_scope"`,
    );

    await queryRunner.query(`
      ALTER TABLE "company_users"
      DROP CONSTRAINT IF EXISTS "CHK_company_users_quotation_policy_data_scope"
    `);

    await queryRunner.query(`
      ALTER TABLE "company_users"
      DROP COLUMN IF EXISTS "quotation_policy_data_scope"
    `);
  }
}
