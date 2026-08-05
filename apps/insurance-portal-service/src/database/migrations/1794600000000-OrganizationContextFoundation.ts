import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationContextFoundation1794600000000 implements MigrationInterface {
  name = 'OrganizationContextFoundation1794600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    /*
     * Company operating configuration
     */
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS
      "operating_timezone"
      character varying(100)
      NOT NULL DEFAULT 'Africa/Dar_es_Salaam'
    `);

    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS
      "default_currency"
      character varying(3)
      NOT NULL DEFAULT 'TZS'
    `);

    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS
      "tira_integration_enabled"
      boolean NOT NULL DEFAULT false
    `);

    /*
     * Only one default active company membership per user.
     */
    await queryRunner.query(`
      WITH ranked_memberships AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "user_id"
            ORDER BY
              "is_default" DESC,
              "last_accessed_at" DESC NULLS LAST,
              "created_at" ASC,
              "id" ASC
          ) AS row_number
        FROM "company_users"
        WHERE "status" = 'active'
      )
      UPDATE "company_users" membership
      SET "is_default" = ranked_memberships.row_number = 1
      FROM ranked_memberships
      WHERE membership."id" = ranked_memberships."id"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_company_users_one_default_membership"
      ON "company_users" ("user_id")
      WHERE "is_default" = true AND "status" = 'active'
    `);

    /*
     * Branch identity.
     */
    await queryRunner.query(`
      ALTER TABLE "branches"
      ADD COLUMN IF NOT EXISTS
      "is_head_office"
      boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      WITH ranked_branches AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "company_id"
            ORDER BY
              "is_head_office" DESC,
              "created_at" ASC,
              "id" ASC
          ) AS row_number
        FROM "branches"
        WHERE "deleted_at" IS NULL
      )
      UPDATE "branches" branch
      SET "is_head_office" = ranked_branches.row_number = 1
      FROM ranked_branches
      WHERE branch."id" = ranked_branches."id"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_branches_one_head_office"
      ON "branches" ("company_id")
      WHERE "is_head_office" = true AND "deleted_at" IS NULL
    `);

    /*
     * Ensure only one primary and one active branch per membership.
     */
    await queryRunner.query(`
      WITH ranked_primary AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "company_user_id"
            ORDER BY
              "is_active_branch" DESC,
              "is_primary" DESC,
              "created_at" ASC,
              "id" ASC
          ) AS row_number
        FROM "branch_users"
      )
      UPDATE "branch_users" assignment
      SET
        "is_primary" = ranked_primary.row_number = 1,
        "is_active_branch" = ranked_primary.row_number = 1
      FROM ranked_primary
      WHERE assignment."id" = ranked_primary."id"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_branch_users_one_primary_branch"
      ON "branch_users" ("company_user_id")
      WHERE "is_primary" = true
    `);

    /*
     * TIRA configuration readiness.
     */
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD COLUMN IF NOT EXISTS
      "validation_status"
      character varying(30)
      NOT NULL DEFAULT 'NOT_VALIDATED'
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD COLUMN IF NOT EXISTS
      "validated_at"
      TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD COLUMN IF NOT EXISTS
      "validation_message"
      text
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      DROP CONSTRAINT IF EXISTS
      "CHK_tiramis_company_configuration_environment"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD CONSTRAINT
      "CHK_tiramis_company_configuration_environment"
      CHECK ("environment" IN ('test', 'live'))
    `);

    /*
     * A company code and system code identify the
     * corresponding configuration in TIRAMIS.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_tiramis_company_environment_codes"
      ON "tiramis_company_configurations" (
        "environment",
        "company_code",
        "system_code"
      )
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      UPDATE "companies" company
      SET "tira_integration_enabled" = true
      WHERE EXISTS (
        SELECT 1
        FROM "tiramis_company_configurations" configuration
        WHERE
          configuration."company_id" = company."id"
          AND configuration."is_active" = true
      )
    `);

    /*
     * Sales-point lifecycle fields.
     */
    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      ADD COLUMN IF NOT EXISTS
      "created_by" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      ADD COLUMN IF NOT EXISTS
      "updated_by" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      ADD COLUMN IF NOT EXISTS
      "deleted_at"
      TIMESTAMP WITH TIME ZONE
    `);

    /*
     * Migrate legacy branch sales-point values into
     * the canonical sales-point table.
     */
    await queryRunner.query(`
      INSERT INTO "tiramis_sale_points" (
        "company_id",
        "branch_id",
        "branch_code",
        "branch_name",
        "sale_point_code",
        "sale_point_name",
        "is_default",
        "is_active",
        "metadata",
        "created_at",
        "updated_at"
      )
      SELECT
        branch."company_id",
        branch."id",
        branch."code",
        branch."name",
        upper(trim(branch."sale_point_code")),
        COALESCE(
          NULLIF(trim(branch."sale_point_name"), ''),
          branch."name"
        ),
        true,
        branch."status" = 'active',
        jsonb_build_object('migratedFromLegacyBranchFields', true),
        now(),
        now()
      FROM "branches" branch
      WHERE
        branch."deleted_at" IS NULL
        AND branch."sale_point_code" IS NOT NULL
        AND trim(branch."sale_point_code") <> ''
      ON CONFLICT ("company_id", "sale_point_code")
      DO UPDATE SET
        "branch_id" = COALESCE("tiramis_sale_points"."branch_id", EXCLUDED."branch_id"),
        "branch_code" = COALESCE("tiramis_sale_points"."branch_code", EXCLUDED."branch_code"),
        "branch_name" = COALESCE("tiramis_sale_points"."branch_name", EXCLUDED."branch_name"),
        "sale_point_name" = COALESCE("tiramis_sale_points"."sale_point_name", EXCLUDED."sale_point_name")
    `);

    await queryRunner.query(`
      UPDATE "tiramis_sale_points" sale_point
      SET
        "branch_code" = branch."code",
        "branch_name" = branch."name"
      FROM "branches" branch
      WHERE sale_point."branch_id" = branch."id"
    `);

    /*
     * Exactly one default active sales point per branch.
     */
    await queryRunner.query(`
      WITH ranked_sale_points AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "branch_id"
            ORDER BY
              "is_default" DESC,
              "is_active" DESC,
              "created_at" ASC,
              "id" ASC
          ) AS row_number
        FROM "tiramis_sale_points"
        WHERE
          "branch_id" IS NOT NULL
          AND "is_active" = true
          AND "deleted_at" IS NULL
      )
      UPDATE "tiramis_sale_points" sale_point
      SET "is_default" = ranked_sale_points.row_number = 1
      FROM ranked_sale_points
      WHERE sale_point."id" = ranked_sale_points."id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_tiramis_sale_points_one_default_per_branch"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
      "UQ_tiramis_sale_points_one_default_per_branch"
      ON "tiramis_sale_points" ("branch_id")
      WHERE
        "is_default" = true
        AND "is_active" = true
        AND "branch_id" IS NOT NULL
        AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      DROP CONSTRAINT IF EXISTS
      "CHK_tiramis_sale_point_default_active"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      ADD CONSTRAINT
      "CHK_tiramis_sale_point_default_active"
      CHECK ("is_default" = false OR "is_active" = true)
    `);

    /*
     * User department assignments.
     */
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "department_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "company_user_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "is_active_department" boolean NOT NULL DEFAULT false,
        "assigned_by" uuid,
        "activated_at" TIMESTAMP WITH TIME ZONE,
        "activated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_department_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_department_users_membership_department"
          UNIQUE ("company_user_id", "department_id"),
        CONSTRAINT "FK_department_users_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_department_users_membership"
          FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_department_users_department"
          FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_department_users_company"
      ON "department_users" ("company_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_department_users_membership"
      ON "department_users" ("company_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_department_users_department"
      ON "department_users" ("department_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_department_users_one_primary"
      ON "department_users" ("company_user_id")
      WHERE "is_primary" = true
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_department_users_one_active"
      ON "department_users" ("company_user_id")
      WHERE "is_active_department" = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_department_users_one_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_department_users_one_primary"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "department_users"`);

    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_sale_point_default_active"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_sale_points"
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "updated_by",
      DROP COLUMN IF EXISTS "created_by"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_tiramis_company_environment_codes"`,
    );

    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      DROP CONSTRAINT IF EXISTS "CHK_tiramis_company_configuration_environment"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      DROP COLUMN IF EXISTS "validation_message",
      DROP COLUMN IF EXISTS "validated_at",
      DROP COLUMN IF EXISTS "validation_status"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_branch_users_one_primary_branch"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_branches_one_head_office"`,
    );

    await queryRunner.query(`
      ALTER TABLE "branches"
      DROP COLUMN IF EXISTS "is_head_office"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_company_users_one_default_membership"`,
    );

    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "tira_integration_enabled",
      DROP COLUMN IF EXISTS "default_currency",
      DROP COLUMN IF EXISTS "operating_timezone"
    `);
  }
}
