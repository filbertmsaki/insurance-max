import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3AuthorizationAndAudit1794500000000 implements MigrationInterface {
  name = 'Phase3AuthorizationAndAudit1794500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "roles"
      ADD COLUMN IF NOT EXISTS "scope" character varying(30)
    `);

    await queryRunner.query(`
      ALTER TABLE "roles"
      ADD COLUMN IF NOT EXISTS "is_administrative" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "roles"
      SET "scope" =
        CASE
          WHEN "company_id" IS NOT NULL THEN 'tenant'
          WHEN "name" IN ('OWNER', 'SUPER_ADMIN') THEN 'platform'
          ELSE 'tenant_template'
        END
      WHERE "scope" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "roles"
      SET "is_administrative" = true
      WHERE "name" IN ('OWNER', 'SUPER_ADMIN', 'ADMINISTRATOR')
        OR "name" LIKE '%_ADMIN'
    `);

    await queryRunner.query(`
      ALTER TABLE "roles" ALTER COLUMN "scope" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "roles" ALTER COLUMN "scope" SET DEFAULT 'tenant'
    `);

    await queryRunner.query(`
      ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "CHK_roles_scope"
    `);

    await queryRunner.query(`
      ALTER TABLE "roles"
      ADD CONSTRAINT "CHK_roles_scope"
      CHECK ("scope" IN ('platform', 'tenant_template', 'tenant'))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_roles_scope_company"
      ON "roles" ("scope", "company_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
      ADD COLUMN IF NOT EXISTS "assignment_scope" character varying(20) NOT NULL DEFAULT 'tenant'
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
      ADD COLUMN IF NOT EXISTS "assignable_to_company_role" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
      ADD COLUMN IF NOT EXISTS "assignable_to_platform_role" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
      ADD COLUMN IF NOT EXISTS "is_deprecated" boolean NOT NULL DEFAULT false
    `);

    /*
     * Existing permissions are conservatively classified from their
     * current assignments. The RBAC seeder then applies the
     * authoritative scope configuration.
     */
    await queryRunner.query(`
      UPDATE "permissions" permission
      SET
        "assignable_to_company_role" =
          EXISTS (
            SELECT 1
            FROM "permission_role" role_permission
            INNER JOIN "company_user_roles" company_role
              ON company_role."role_id" = role_permission."roles_id"
            WHERE role_permission."permissions_id" = permission."id"
          ),
        "assignable_to_platform_role" =
          EXISTS (
            SELECT 1
            FROM "permission_role" role_permission
            INNER JOIN "role_user" platform_role
              ON platform_role."roles_id" = role_permission."roles_id"
            WHERE role_permission."permissions_id" = permission."id"
          )
          OR EXISTS (
            SELECT 1
            FROM "permission_user" platform_permission
            WHERE platform_permission."permissions_id" = permission."id"
          )
    `);

    await queryRunner.query(`
      UPDATE "permissions"
      SET "assignment_scope" =
        CASE
          WHEN "assignable_to_company_role" = true AND "assignable_to_platform_role" = true THEN 'shared'
          WHEN "assignable_to_platform_role" = true THEN 'platform'
          ELSE 'tenant'
        END
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "CHK_permissions_assignment_scope"
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
      ADD CONSTRAINT "CHK_permissions_assignment_scope"
      CHECK ("assignment_scope" IN ('platform', 'tenant', 'shared'))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_permissions_assignment_scope"
      ON "permissions" ("assignment_scope", "assignable_to_company_role", "assignable_to_platform_role")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "authorization_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "company_users"
      ADD COLUMN IF NOT EXISTS "authorization_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "company_membership_id" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "branch_id" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "session_id" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "request_id" character varying(128)
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "correlation_id" character varying(128)
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "actor_type" character varying(30) NOT NULL DEFAULT 'user'
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_service" character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "event_category" character varying(80)
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "before_state" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "after_state" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "changed_fields" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "metadata" TYPE jsonb
      USING (CASE WHEN "metadata" IS NULL THEN NULL ELSE "metadata"::jsonb END)
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE
      USING "created_at" AT TIME ZONE 'UTC'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_company_created"
      ON "audit_logs" ("company_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_request_id" ON "audit_logs" ("request_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_correlation_id" ON "audit_logs" ("correlation_id")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('app.audit_maintenance', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'audit_logs is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_audit_logs_append_only" ON "audit_logs"
    `);

    await queryRunner.query(`
      CREATE TRIGGER "TRG_audit_logs_append_only"
      BEFORE UPDATE OR DELETE ON "audit_logs"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_audit_logs_append_only" ON "audit_logs"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_audit_log_mutation()`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_correlation_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_request_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_company_created"`);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "changed_fields",
      DROP COLUMN IF EXISTS "after_state",
      DROP COLUMN IF EXISTS "before_state",
      DROP COLUMN IF EXISTS "reason",
      DROP COLUMN IF EXISTS "event_category",
      DROP COLUMN IF EXISTS "actor_service",
      DROP COLUMN IF EXISTS "actor_type",
      DROP COLUMN IF EXISTS "correlation_id",
      DROP COLUMN IF EXISTS "request_id",
      DROP COLUMN IF EXISTS "session_id",
      DROP COLUMN IF EXISTS "branch_id",
      DROP COLUMN IF EXISTS "company_membership_id"
    `);

    await queryRunner.query(
      `ALTER TABLE "company_users" DROP COLUMN IF EXISTS "authorization_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "authorization_version"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_permissions_assignment_scope"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "CHK_permissions_assignment_scope"`,
    );
    await queryRunner.query(`
      ALTER TABLE "permissions"
      DROP COLUMN IF EXISTS "is_deprecated",
      DROP COLUMN IF EXISTS "assignable_to_platform_role",
      DROP COLUMN IF EXISTS "assignable_to_company_role",
      DROP COLUMN IF EXISTS "assignment_scope"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_roles_scope_company"`);
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "CHK_roles_scope"`,
    );
    await queryRunner.query(`
      ALTER TABLE "roles"
      DROP COLUMN IF EXISTS "is_administrative",
      DROP COLUMN IF EXISTS "scope"
    `);
  }
}
