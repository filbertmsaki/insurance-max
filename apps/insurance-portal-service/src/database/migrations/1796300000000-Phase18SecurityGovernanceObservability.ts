import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase18SecurityGovernanceObservability1796300000000 implements MigrationInterface {
  name = 'Phase18SecurityGovernanceObservability1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "family_id" uuid DEFAULT uuid_generate_v4()
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "absolute_expires_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "idle_expires_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "authentication_strength" varchar(40) NOT NULL DEFAULT 'PASSWORD'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "two_factor_verified_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "last_activity_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "last_ip_address" varchar(45)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "risk_level" varchar(20) NOT NULL DEFAULT 'LOW'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "compromised_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "previous_refresh_token_hash" varchar(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "previous_refresh_rotated_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "security_events" jsonb DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      UPDATE "user_sessions"
      SET
        "family_id" = COALESCE("family_id", uuid_generate_v4()),
        "absolute_expires_at" = COALESCE("absolute_expires_at", "expires_at"),
        "idle_expires_at" = COALESCE("idle_expires_at", "last_used_at" + interval '30 minutes'),
        "last_activity_at" = COALESCE("last_activity_at", "last_used_at", now()),
        "last_ip_address" = COALESCE("last_ip_address", "ip_address"),
        "security_events" = COALESCE("security_events", '[]'::jsonb)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ALTER COLUMN "family_id" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_family_active"
      ON "user_sessions" ("family_id", "revoked")
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "event_no" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "previous_event_hash" varchar(128)
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "event_hash" varchar(128)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_audit_event_no"
      ON "audit_logs" ("event_no")
      WHERE "event_no" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "security_policy_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid,
        "profile_code" varchar(80) NOT NULL,
        "profile_name" varchar(160) NOT NULL,
        "version_number" integer NOT NULL DEFAULT 1,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "description" text,
        "policy" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_by" uuid,
        "approved_by" uuid,
        "effective_from" timestamptz,
        "effective_to" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz,
        CONSTRAINT "PK_security_policy_profiles" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_security_policy_company_status"
      ON "security_policy_profiles" ("company_id", "status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_security_policy_profile_version"
      ON "security_policy_profiles" ("company_id", "profile_code", "version_number")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "data_retention_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid,
        "policy_code" varchar(80) NOT NULL,
        "policy_name" varchar(160) NOT NULL,
        "resource_type" varchar(120) NOT NULL,
        "version_number" integer NOT NULL DEFAULT 1,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "action" varchar(20) NOT NULL DEFAULT 'RETAIN',
        "retention_days" integer NOT NULL DEFAULT 365,
        "dry_run_default" boolean NOT NULL DEFAULT true,
        "archive_before_delete" boolean NOT NULL DEFAULT false,
        "rules" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_data_retention_policies" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_data_retention_company_status"
      ON "data_retention_policies" ("company_id", "status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_data_retention_policy_version"
      ON "data_retention_policies" ("company_id", "policy_code", "version_number")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "legal_holds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid,
        "hold_code" varchar(80) NOT NULL,
        "resource_type" varchar(120) NOT NULL,
        "resource_id" varchar(120) NOT NULL,
        "reason" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "released_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "released_at" timestamptz,
        CONSTRAINT "PK_legal_holds" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_legal_hold_resource_active"
      ON "legal_holds" ("resource_type", "resource_id", "active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_legal_hold_resource_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "legal_holds"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_data_retention_policy_version"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_data_retention_company_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "data_retention_policies"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_security_policy_profile_version"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_security_policy_company_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "security_policy_profiles"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_event_no"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "event_hash",
      DROP COLUMN IF EXISTS "previous_event_hash",
      DROP COLUMN IF EXISTS "event_no"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_sessions_family_active"`,
    );
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      DROP COLUMN IF EXISTS "security_events",
      DROP COLUMN IF EXISTS "previous_refresh_rotated_at",
      DROP COLUMN IF EXISTS "previous_refresh_token_hash",
      DROP COLUMN IF EXISTS "compromised_at",
      DROP COLUMN IF EXISTS "risk_level",
      DROP COLUMN IF EXISTS "last_ip_address",
      DROP COLUMN IF EXISTS "last_activity_at",
      DROP COLUMN IF EXISTS "two_factor_verified_at",
      DROP COLUMN IF EXISTS "authentication_strength",
      DROP COLUMN IF EXISTS "idle_expires_at",
      DROP COLUMN IF EXISTS "absolute_expires_at",
      DROP COLUMN IF EXISTS "family_id"
    `);
  }
}
