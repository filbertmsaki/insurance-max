import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase18SaasApiSecurityFoundation1796100000000 implements MigrationInterface {
  name = 'Phase18SaasApiSecurityFoundation1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      ALTER TABLE "saas_plans"
      ADD COLUMN IF NOT EXISTS "active_version_id" uuid,
      ADD COLUMN IF NOT EXISTS "current_version_number" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saas_plan_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "name" varchar(150) NOT NULL,
        "description" text,
        "billing_interval" varchar(30) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "base_price" numeric(20,4) NOT NULL,
        "trial_days" integer NOT NULL DEFAULT 0,
        "feature_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "meter_rate_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "plan_snapshot" jsonb NOT NULL,
        "plan_snapshot_hash" varchar(64) NOT NULL,
        "effective_from" timestamptz,
        "effective_to" timestamptz,
        "created_by" uuid NOT NULL,
        "approved_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz,
        CONSTRAINT "PK_saas_plan_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saas_plan_version" UNIQUE ("plan_id", "version_number")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "saas_plan_versions" (
        "plan_id",
        "version_number",
        "status",
        "name",
        "description",
        "billing_interval",
        "currency",
        "base_price",
        "trial_days",
        "feature_snapshot",
        "meter_rate_snapshot",
        "plan_snapshot",
        "plan_snapshot_hash",
        "effective_from",
        "created_by",
        "approved_by",
        "created_at",
        "approved_at"
      )
      SELECT
        plan."id",
        1,
        CASE
          WHEN plan."status" = 'ACTIVE' THEN 'ACTIVE'
          WHEN plan."status" = 'ARCHIVED' THEN 'RETIRED'
          ELSE 'DRAFT'
        END,
        plan."name",
        plan."description",
        plan."billing_interval"::text,
        plan."currency",
        plan."base_price"::numeric(20,4),
        plan."trial_days",
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'feature_code', feature."feature_code",
              'value_type', feature."value_type",
              'value', feature."value",
              'description', feature."description"
            )
            ORDER BY feature."feature_code"
          )
          FROM "saas_plan_features" feature
          WHERE feature."plan_id" = plan."id"
        ), '[]'::jsonb),
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'metric_code', rate."metric_code",
              'included_quantity', rate."included_quantity",
              'billing_unit', rate."billing_unit",
              'unit_price', rate."unit_price",
              'currency', rate."currency",
              'is_active', rate."is_active"
            )
            ORDER BY rate."metric_code"
          )
          FROM "saas_plan_meter_rates" rate
          WHERE rate."plan_id" = plan."id"
        ), '[]'::jsonb),
        jsonb_build_object(
          'plan_id', plan."id",
          'code', plan."code",
          'name', plan."name",
          'description', plan."description",
          'applicable_company_types', COALESCE(plan."applicable_company_types", '[]'::jsonb),
          'billing_interval', plan."billing_interval",
          'currency', plan."currency",
          'base_price', plan."base_price",
          'trial_days', plan."trial_days"
        ),
        encode(digest((
          jsonb_build_object(
            'plan_id', plan."id",
            'code', plan."code",
            'name', plan."name",
            'description', plan."description",
            'applicable_company_types', COALESCE(plan."applicable_company_types", '[]'::jsonb),
            'billing_interval', plan."billing_interval",
            'currency', plan."currency",
            'base_price', plan."base_price",
            'trial_days', plan."trial_days",
            'features', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'feature_code', feature."feature_code",
                  'value_type', feature."value_type",
                  'value', feature."value",
                  'description', feature."description"
                )
                ORDER BY feature."feature_code"
              )
              FROM "saas_plan_features" feature
              WHERE feature."plan_id" = plan."id"
            ), '[]'::jsonb),
            'meter_rates', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'metric_code', rate."metric_code",
                  'included_quantity', rate."included_quantity",
                  'billing_unit', rate."billing_unit",
                  'unit_price', rate."unit_price",
                  'currency', rate."currency",
                  'is_active', rate."is_active"
                )
                ORDER BY rate."metric_code"
              )
              FROM "saas_plan_meter_rates" rate
              WHERE rate."plan_id" = plan."id"
            ), '[]'::jsonb)
          )
        )::text, 'sha256'), 'hex'),
        CASE WHEN plan."status" = 'ACTIVE' THEN plan."updated_at" ELSE NULL END,
        COALESCE(plan."created_by", plan."updated_by", '00000000-0000-0000-0000-000000000000'::uuid),
        plan."updated_by",
        plan."created_at",
        CASE WHEN plan."status" = 'ACTIVE' THEN plan."updated_at" ELSE NULL END
      FROM "saas_plans" plan
      WHERE NOT EXISTS (
        SELECT 1
        FROM "saas_plan_versions" version
        WHERE version."plan_id" = plan."id"
      )
    `);

    await queryRunner.query(`
      UPDATE "saas_plans" plan
      SET
        "active_version_id" = version."id",
        "current_version_number" = version."version_number"
      FROM "saas_plan_versions" version
      WHERE version."plan_id" = plan."id"
        AND version."status" = 'ACTIVE'
    `);

    await queryRunner.query(`
      UPDATE "saas_plans" plan
      SET "current_version_number" = COALESCE((
        SELECT MAX(version."version_number")
        FROM "saas_plan_versions" version
        WHERE version."plan_id" = plan."id"
      ), 0)
      WHERE "current_version_number" = 0
    `);

    await queryRunner.query(`
      ALTER TABLE "company_subscriptions"
      ADD COLUMN IF NOT EXISTS "plan_version_id" uuid,
      ADD COLUMN IF NOT EXISTS "plan_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "plan_snapshot_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "grace_period_ends_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "scheduled_plan_id" uuid,
      ADD COLUMN IF NOT EXISTS "scheduled_plan_version_id" uuid,
      ADD COLUMN IF NOT EXISTS "scheduled_change_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "last_billed_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "next_billing_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      UPDATE "company_subscriptions" subscription
      SET
        "plan_version_id" = version."id",
        "plan_snapshot" = version."plan_snapshot",
        "plan_snapshot_hash" = version."plan_snapshot_hash",
        "next_billing_at" = COALESCE(subscription."next_billing_at", subscription."current_period_end"),
        "last_billed_at" = COALESCE(subscription."last_billed_at", subscription."created_at")
      FROM "saas_plan_versions" version
      WHERE version."id" = COALESCE((
          SELECT plan."active_version_id"
          FROM "saas_plans" plan
          WHERE plan."id" = subscription."plan_id"
        ), (
          SELECT latest."id"
          FROM "saas_plan_versions" latest
          WHERE latest."plan_id" = subscription."plan_id"
          ORDER BY latest."version_number" DESC
          LIMIT 1
        ))
        AND subscription."plan_version_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_changes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subscription_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "change_type" varchar(40) NOT NULL,
        "old_plan_version_id" uuid,
        "new_plan_version_id" uuid,
        "effective_at" timestamptz NOT NULL,
        "change_summary" jsonb,
        "changed_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_changes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "subscription_changes" (
        "subscription_id",
        "company_id",
        "change_type",
        "new_plan_version_id",
        "effective_at",
        "change_summary",
        "changed_by",
        "created_at"
      )
      SELECT
        subscription."id",
        subscription."company_id",
        'CREATED',
        subscription."plan_version_id",
        subscription."started_at",
        jsonb_build_object(
          'status', subscription."status",
          'subscription_no', subscription."subscription_no"
        ),
        subscription."created_by",
        subscription."created_at"
      FROM "company_subscriptions" subscription
      WHERE NOT EXISTS (
        SELECT 1
        FROM "subscription_changes" change
        WHERE change."subscription_id" = subscription."id"
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "saas_billing_cycles"
      ADD COLUMN IF NOT EXISTS "billing_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "billing_snapshot_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "plan_version_id" uuid,
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      UPDATE "saas_billing_cycles" cycle
      SET
        "plan_version_id" = subscription."plan_version_id",
        "billing_snapshot" = jsonb_build_object(
          'plan_version_id', subscription."plan_version_id",
          'currency', cycle."currency",
          'period', jsonb_build_object(
            'start', cycle."period_start",
            'end', cycle."period_end"
          ),
          'base_amount', cycle."base_amount",
          'usage_amount', cycle."usage_amount",
          'discount_amount', cycle."discount_amount",
          'tax_amount', cycle."tax_amount",
          'total_amount', cycle."total_amount"
        ),
        "billing_snapshot_hash" = encode(
          digest(
            convert_to(
              jsonb_build_object(
                'plan_version_id', subscription."plan_version_id",
                'currency', cycle."currency",
                'period', jsonb_build_object(
                  'start', cycle."period_start",
                  'end', cycle."period_end"
                ),
                'base_amount', cycle."base_amount",
                'usage_amount', cycle."usage_amount",
                'discount_amount', cycle."discount_amount",
                'tax_amount', cycle."tax_amount",
                'total_amount', cycle."total_amount"
              )::text,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        )
      FROM "company_subscriptions" subscription
      WHERE subscription."id" = cycle."subscription_id"
        AND cycle."billing_snapshot" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "api_clients"
      ADD COLUMN IF NOT EXISTS "owner_user_id" uuid,
      ADD COLUMN IF NOT EXISTS "key_prefix" varchar(32),
      ADD COLUMN IF NOT EXISTS "previous_secret_hash" varchar(255),
      ADD COLUMN IF NOT EXISTS "previous_secret_valid_until" timestamptz,
      ADD COLUMN IF NOT EXISTS "client_type" varchar(30) NOT NULL DEFAULT 'TENANT_INTEGRATION',
      ADD COLUMN IF NOT EXISTS "environment" varchar(20) NOT NULL DEFAULT 'PRODUCTION',
      ADD COLUMN IF NOT EXISTS "ip_whitelist" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "rate_limit_per_minute" integer,
      ADD COLUMN IF NOT EXISTS "last_used_ip" varchar(45),
      ADD COLUMN IF NOT EXISTS "last_used_user_agent" text,
      ADD COLUMN IF NOT EXISTS "usage_count" bigint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "rotated_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "compromised_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "revoked_reason" varchar(255)
    `);

    await queryRunner.query(`
      UPDATE "api_clients"
      SET
        "status" = CASE UPPER("status")
          WHEN 'ACTIVE' THEN 'ACTIVE'
          WHEN 'REVOKED' THEN 'REVOKED'
          WHEN 'SUSPENDED' THEN 'SUSPENDED'
          WHEN 'EXPIRED' THEN 'EXPIRED'
          WHEN 'COMPROMISED' THEN 'COMPROMISED'
          ELSE 'ACTIVE'
        END,
        "key_prefix" = COALESCE("key_prefix", UPPER(LEFT(REPLACE("client_id", 'iam_', 'IMX_'), 18)))
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "api_client_usage_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "api_client_id" uuid NOT NULL,
        "company_id" uuid,
        "outcome" varchar(20) NOT NULL,
        "ip_address" varchar(45),
        "method" varchar(10),
        "request_path" varchar(255),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_client_usage_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_api_client_usage_client_created"
      ON "api_client_usage_events" ("api_client_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_api_client_usage_client_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "api_client_usage_events"`);
    await queryRunner.query(`
      ALTER TABLE "api_clients"
      DROP COLUMN IF EXISTS "revoked_reason",
      DROP COLUMN IF EXISTS "compromised_at",
      DROP COLUMN IF EXISTS "rotated_at",
      DROP COLUMN IF EXISTS "usage_count",
      DROP COLUMN IF EXISTS "last_used_user_agent",
      DROP COLUMN IF EXISTS "last_used_ip",
      DROP COLUMN IF EXISTS "rate_limit_per_minute",
      DROP COLUMN IF EXISTS "ip_whitelist",
      DROP COLUMN IF EXISTS "environment",
      DROP COLUMN IF EXISTS "client_type",
      DROP COLUMN IF EXISTS "previous_secret_valid_until",
      DROP COLUMN IF EXISTS "previous_secret_hash",
      DROP COLUMN IF EXISTS "key_prefix",
      DROP COLUMN IF EXISTS "owner_user_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_changes"`);
    await queryRunner.query(`
      ALTER TABLE "saas_billing_cycles"
      DROP COLUMN IF EXISTS "state_version",
      DROP COLUMN IF EXISTS "plan_version_id",
      DROP COLUMN IF EXISTS "billing_snapshot_hash",
      DROP COLUMN IF EXISTS "billing_snapshot"
    `);
    await queryRunner.query(`
      ALTER TABLE "company_subscriptions"
      DROP COLUMN IF EXISTS "state_version",
      DROP COLUMN IF EXISTS "next_billing_at",
      DROP COLUMN IF EXISTS "last_billed_at",
      DROP COLUMN IF EXISTS "scheduled_change_at",
      DROP COLUMN IF EXISTS "scheduled_plan_version_id",
      DROP COLUMN IF EXISTS "scheduled_plan_id",
      DROP COLUMN IF EXISTS "grace_period_ends_at",
      DROP COLUMN IF EXISTS "plan_snapshot_hash",
      DROP COLUMN IF EXISTS "plan_snapshot",
      DROP COLUMN IF EXISTS "plan_version_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "saas_plan_versions"`);
    await queryRunner.query(`
      ALTER TABLE "saas_plans"
      DROP COLUMN IF EXISTS "current_version_number",
      DROP COLUMN IF EXISTS "active_version_id"
    `);
  }
}
