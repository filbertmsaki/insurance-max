import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 16 foundation.
 *
 * This migration is intentionally additive:
 * - it preserves the older reporting/regulatory tables already used by the app
 * - it introduces the Phase 16 canonical tables where none exist yet
 * - it extends existing tables with the contract fields needed to migrate
 *   services and frontend flows incrementally
 */
export class RegulatoryReportingAnalytics1795800000000 implements MigrationInterface {
  name = 'RegulatoryReportingAnalytics1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regulatory_authority_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "authority_code" varchar(50) NOT NULL,
        "authority_name" varchar(200) NOT NULL,
        "authority_type" varchar(50) NOT NULL,
        "jurisdiction_code" varchar(20) NOT NULL,
        "registration_reference" varchar(100),
        "submission_channel" varchar(50),
        "submission_endpoint" varchar(500),
        "contact_email" varchar(255),
        "contact_phone" varchar(50),
        "active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_authority_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_authority_profile" UNIQUE ("company_id", "authority_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regulatory_obligation_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "authority_profile_id" uuid NOT NULL,
        "obligation_code" varchar(80) NOT NULL,
        "obligation_name" varchar(250) NOT NULL,
        "obligation_type" varchar(40) NOT NULL,
        "frequency" varchar(40) NOT NULL,
        "effective_from" date NOT NULL,
        "effective_to" date,
        "due_date_rule" jsonb NOT NULL,
        "warning_days" integer[] NOT NULL DEFAULT ARRAY[30,14,7,1],
        "report_code" varchar(100),
        "requires_approval" boolean NOT NULL DEFAULT true,
        "requires_submission_evidence" boolean NOT NULL DEFAULT true,
        "requires_reconciliation" boolean NOT NULL DEFAULT true,
        "active" boolean NOT NULL DEFAULT true,
        "version_number" integer NOT NULL DEFAULT 1,
        "definition_snapshot" jsonb NOT NULL,
        "definition_snapshot_hash" varchar(64) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_obligation_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_obligation_definition" UNIQUE ("company_id", "obligation_code", "version_number"),
        CONSTRAINT "CHK_regulatory_obligation_dates" CHECK (
          "effective_to" IS NULL OR "effective_to" >= "effective_from"
        )
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_obligation_definitions"
        ADD CONSTRAINT "FK_regulatory_obligation_definition_authority"
        FOREIGN KEY ("authority_profile_id")
        REFERENCES "regulatory_authority_profiles"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regulatory_obligation_instances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "definition_id" uuid NOT NULL,
        "obligation_reference" varchar(100) NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "due_at" timestamptz NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'UPCOMING',
        "assigned_user_id" uuid,
        "assigned_role_id" uuid,
        "active_return_id" uuid,
        "active_levy_assessment_id" uuid,
        "warning_sent_days" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
        "completed_at" timestamptz,
        "waived_by" uuid,
        "waived_at" timestamptz,
        "waiver_reason" text,
        "state_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_obligation_instances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_obligation_period" UNIQUE ("definition_id", "period_start", "period_end")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_obligation_instances"
        ADD CONSTRAINT "FK_regulatory_instance_definition"
        FOREIGN KEY ("definition_id")
        REFERENCES "regulatory_obligation_definitions"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "regulatory_returns"
      ADD COLUMN IF NOT EXISTS "obligation_instance_id" uuid,
      ADD COLUMN IF NOT EXISTS "return_code" varchar(100),
      ADD COLUMN IF NOT EXISTS "version_number" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "report_definition_code" varchar(100),
      ADD COLUMN IF NOT EXISTS "report_definition_version" integer,
      ADD COLUMN IF NOT EXISTS "currency_code" varchar(3),
      ADD COLUMN IF NOT EXISTS "parameters" jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "parameters_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "source_cutoff_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "source_projection_sequence" bigint,
      ADD COLUMN IF NOT EXISTS "return_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "return_snapshot_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "validation_results" jsonb,
      ADD COLUMN IF NOT EXISTS "reconciliation_status" varchar(40) NOT NULL DEFAULT 'NOT_CHECKED',
      ADD COLUMN IF NOT EXISTS "reconciliation_summary" jsonb,
      ADD COLUMN IF NOT EXISTS "report_job_id" uuid,
      ADD COLUMN IF NOT EXISTS "artifact_id" uuid,
      ADD COLUMN IF NOT EXISTS "prepared_at" timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "submitted_for_review_by" uuid,
      ADD COLUMN IF NOT EXISTS "submitted_for_review_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "rejected_by" uuid,
      ADD COLUMN IF NOT EXISTS "rejected_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "rejection_reason" text,
      ADD COLUMN IF NOT EXISTS "supersedes_return_id" uuid,
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      UPDATE "regulatory_returns"
      SET
        "return_code" = COALESCE("return_code", "return_no"),
        "report_definition_code" = COALESCE("report_definition_code", (
          SELECT definition.code
          FROM "regulatory_return_definitions" definition
          WHERE definition.id = "regulatory_returns"."definition_id"
          LIMIT 1
        )),
        "currency_code" = COALESCE("currency_code", NULLIF("currency", '')),
        "parameters_hash" = COALESCE("parameters_hash", md5(COALESCE("parameters"::text, '{}'))),
        "report_definition_version" = COALESCE("report_definition_version", 1)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_returns"
        ADD CONSTRAINT "FK_regulatory_return_instance"
        FOREIGN KEY ("obligation_instance_id")
        REFERENCES "regulatory_obligation_instances"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_returns"
        ADD CONSTRAINT "FK_regulatory_return_supersedes_v2"
        FOREIGN KEY ("supersedes_return_id")
        REFERENCES "regulatory_returns"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_regulatory_return_instance_version"
      ON "regulatory_returns" ("obligation_instance_id", "version_number")
      WHERE "obligation_instance_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regulatory_return_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "regulatory_return_id" uuid NOT NULL,
        "submission_no" varchar(100) NOT NULL,
        "submission_channel" varchar(50) NOT NULL,
        "submission_reference" varchar(150),
        "status" varchar(40) NOT NULL DEFAULT 'SUBMISSION_PROCESSING',
        "submitted_payload_hash" varchar(64) NOT NULL,
        "acknowledgement_reference" varchar(150),
        "acknowledgement_code" varchar(50),
        "acknowledgement_message" text,
        "submitted_by" uuid NOT NULL,
        "submitted_at" timestamptz NOT NULL,
        "acknowledged_at" timestamptz,
        "rejected_at" timestamptz,
        "evidence_document_id" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_return_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_submission_no" UNIQUE ("company_id", "submission_no")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_return_submissions"
        ADD CONSTRAINT "FK_regulatory_submission_return"
        FOREIGN KEY ("regulatory_return_id")
        REFERENCES "regulatory_returns"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regulatory_levy_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "authority_profile_id" uuid NOT NULL,
        "levy_code" varchar(80) NOT NULL,
        "levy_name" varchar(200) NOT NULL,
        "basis_type" varchar(50) NOT NULL,
        "rate_type" varchar(30) NOT NULL,
        "rate_value" numeric(18,10) NOT NULL,
        "minimum_amount" numeric(20,4),
        "maximum_amount" numeric(20,4),
        "currency_code" varchar(3),
        "effective_from" date NOT NULL,
        "effective_to" date,
        "calculation_configuration" jsonb NOT NULL,
        "version_number" integer NOT NULL DEFAULT 1,
        "rule_snapshot" jsonb NOT NULL,
        "rule_snapshot_hash" varchar(64) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_levy_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_levy_rule" UNIQUE ("company_id", "levy_code", "version_number")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_levy_rules"
        ADD CONSTRAINT "FK_regulatory_levy_rule_authority"
        FOREIGN KEY ("authority_profile_id")
        REFERENCES "regulatory_authority_profiles"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regulatory_levy_assessments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "obligation_instance_id" uuid,
        "levy_rule_id" uuid NOT NULL,
        "assessment_no" varchar(100) NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
        "basis_amount" numeric(20,4) NOT NULL,
        "rate_value" numeric(18,10) NOT NULL,
        "assessed_amount" numeric(20,4) NOT NULL,
        "paid_amount" numeric(20,4) NOT NULL DEFAULT 0,
        "outstanding_amount" numeric(20,4) NOT NULL,
        "currency_code" varchar(3) NOT NULL,
        "source_report_code" varchar(100),
        "source_report_job_id" uuid,
        "calculation_snapshot" jsonb NOT NULL,
        "calculation_snapshot_hash" varchar(64) NOT NULL,
        "active_invoice_id" uuid,
        "finance_payment_reference" varchar(150),
        "reconciliation_status" varchar(40) NOT NULL DEFAULT 'NOT_CHECKED',
        "prepared_by" uuid NOT NULL,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "state_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_levy_assessments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_levy_assessment_no" UNIQUE ("company_id", "assessment_no")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_levy_assessments"
        ADD CONSTRAINT "FK_regulatory_levy_assessment_instance"
        FOREIGN KEY ("obligation_instance_id")
        REFERENCES "regulatory_obligation_instances"("id")
        ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_levy_assessments"
        ADD CONSTRAINT "FK_regulatory_levy_assessment_rule"
        FOREIGN KEY ("levy_rule_id")
        REFERENCES "regulatory_levy_rules"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regulatory_ledger_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "source_type" varchar(80) NOT NULL,
        "source_id" uuid NOT NULL,
        "source_event_key" varchar(180) NOT NULL,
        "entry_type" varchar(40) NOT NULL,
        "authority_profile_id" uuid,
        "obligation_instance_id" uuid,
        "regulatory_return_id" uuid,
        "levy_assessment_id" uuid,
        "period_start" date,
        "period_end" date,
        "currency_code" varchar(3),
        "debit_amount" numeric(20,4) NOT NULL DEFAULT 0,
        "credit_amount" numeric(20,4) NOT NULL DEFAULT 0,
        "running_balance" numeric(20,4),
        "entry_snapshot" jsonb NOT NULL DEFAULT '{}',
        "entry_snapshot_hash" varchar(64) NOT NULL,
        "reversal_of_entry_id" uuid,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regulatory_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_regulatory_ledger_source_event" UNIQUE ("company_id", "source_event_key")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "regulatory_ledger_entries"
        ADD CONSTRAINT "FK_regulatory_ledger_reversal"
        FOREIGN KEY ("reversal_of_entry_id")
        REFERENCES "regulatory_ledger_entries"("id")
        ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_regulatory_ledger_entry_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('app.audit_maintenance', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'regulatory_ledger_entries is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_regulatory_ledger_entries_append_only"
      ON "regulatory_ledger_entries"
    `);

    await queryRunner.query(`
      CREATE TRIGGER "TRG_regulatory_ledger_entries_append_only"
      BEFORE UPDATE OR DELETE ON "regulatory_ledger_entries"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_regulatory_ledger_entry_mutation()
    `);

    await queryRunner.query(`
      ALTER TABLE "report_definitions"
      ADD COLUMN IF NOT EXISTS "category" varchar(40),
      ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "sensitivity" varchar(40) NOT NULL DEFAULT 'INTERNAL',
      ADD COLUMN IF NOT EXISTS "permission" varchar(150),
      ADD COLUMN IF NOT EXISTS "maximum_rows" integer,
      ADD COLUMN IF NOT EXISTS "asynchronous_only" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "parameters" jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS "definition_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      UPDATE "report_definitions"
      SET
        "maximum_rows" = COALESCE("maximum_rows", "max_rows"),
        "active" = COALESCE("active", "enabled"),
        "definition_hash" = COALESCE("definition_hash", md5(
          COALESCE("code", '') || ':' ||
          COALESCE("name", '') || ':' ||
          COALESCE("description", '')
        ))
    `);

    await queryRunner.query(`
      ALTER TABLE "report_schedules"
      ADD COLUMN IF NOT EXISTS "report_code" varchar(100),
      ADD COLUMN IF NOT EXISTS "parameter_payload" jsonb,
      ADD COLUMN IF NOT EXISTS "parameter_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "frequency" varchar(40),
      ADD COLUMN IF NOT EXISTS "delivery_channel" varchar(40) NOT NULL DEFAULT 'DOWNLOAD',
      ADD COLUMN IF NOT EXISTS "retention_days" integer,
      ADD COLUMN IF NOT EXISTS "failure_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "last_failure_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "last_failure_reason" text,
      ADD COLUMN IF NOT EXISTS "verified_smtp_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "run_as_user_id" uuid,
      ADD COLUMN IF NOT EXISTS "last_delivery_attempt_at" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "report_schedules" schedule
      SET
        "report_code" = COALESCE("report_code", definition.code),
        "parameter_payload" = COALESCE("parameter_payload", "filters"),
        "parameter_hash" = COALESCE("parameter_hash", md5(COALESCE("filters"::text, '{}')))
      FROM "report_definitions" definition
      WHERE definition.id = schedule.definition_id
    `);

    await queryRunner.query(`
      ALTER TABLE "report_jobs"
      ADD COLUMN IF NOT EXISTS "job_no" varchar(100),
      ADD COLUMN IF NOT EXISTS "report_code" varchar(100),
      ADD COLUMN IF NOT EXISTS "parameter_payload" jsonb,
      ADD COLUMN IF NOT EXISTS "parameter_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "source_cutoff_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "execution_context" jsonb,
      ADD COLUMN IF NOT EXISTS "progress_percent" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "row_count" bigint,
      ADD COLUMN IF NOT EXISTS "failure_code" varchar(80),
      ADD COLUMN IF NOT EXISTS "safe_error_message" text
    `);

    await queryRunner.query(`
      UPDATE "report_jobs" job
      SET
        "job_no" = COALESCE("job_no", 'JOB-' || REPLACE(job.id::text, '-', '')),
        "report_code" = COALESCE("report_code", definition.code),
        "parameter_payload" = COALESCE("parameter_payload", "filters"),
        "parameter_hash" = COALESCE("parameter_hash", md5(COALESCE("filters"::text, '{}'))),
        "safe_error_message" = COALESCE("safe_error_message", "error_message")
      FROM "report_definitions" definition
      WHERE definition.id = job.definition_id
    `);

    await queryRunner.query(`
      ALTER TABLE "report_artifacts"
      ADD COLUMN IF NOT EXISTS "report_code" varchar(100),
      ADD COLUMN IF NOT EXISTS "storage_key" varchar(255),
      ADD COLUMN IF NOT EXISTS "file_hash" varchar(64),
      ADD COLUMN IF NOT EXISTS "retention_until" timestamptz,
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "download_count" bigint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "last_downloaded_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "tenant_scope_hash" varchar(64)
    `);

    await queryRunner.query(`
      UPDATE "report_artifacts" artifact
      SET
        "report_code" = COALESCE("report_code", definition.code),
        "file_hash" = COALESCE("file_hash", "checksum"),
        "retention_until" = COALESCE("retention_until", "expires_at")
      FROM "report_definitions" definition
      WHERE definition.id = artifact.definition_id
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_delivery_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_job_id" uuid NOT NULL,
        "artifact_id" uuid,
        "channel" varchar(40) NOT NULL,
        "recipient" varchar(255),
        "attempt_no" integer NOT NULL DEFAULT 1,
        "status" varchar(40) NOT NULL,
        "failure_code" varchar(80),
        "failure_message" text,
        "attempted_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        "metadata" jsonb,
        CONSTRAINT "PK_report_delivery_attempts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "report_delivery_attempts"
        ADD CONSTRAINT "FK_report_delivery_attempt_job"
        FOREIGN KEY ("report_job_id")
        REFERENCES "report_jobs"("id")
        ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "report_delivery_attempts"
        ADD CONSTRAINT "FK_report_delivery_attempt_artifact"
        FOREIGN KEY ("artifact_id")
        REFERENCES "report_artifacts"("id")
        ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_access_audit_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "user_id" uuid,
        "report_code" varchar(100),
        "artifact_id" uuid,
        "access_type" varchar(60) NOT NULL,
        "purpose" text,
        "ip_address" varchar(64),
        "user_agent" varchar(500),
        "result" varchar(30) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_access_audit_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_metric_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(100) NOT NULL,
        "name" varchar(180) NOT NULL,
        "description" text NOT NULL,
        "category" varchar(80) NOT NULL,
        "value_type" varchar(40) NOT NULL,
        "aggregation_type" varchar(40) NOT NULL,
        "formula_version" integer NOT NULL,
        "formula_description" text NOT NULL,
        "numerator_metric_code" varchar(100),
        "denominator_metric_code" varchar(100),
        "supported_dimensions" jsonb NOT NULL DEFAULT '[]',
        "supported_periods" jsonb NOT NULL DEFAULT '[]',
        "permission" varchar(150) NOT NULL,
        "sensitive" boolean NOT NULL DEFAULT false,
        "target_supported" boolean NOT NULL DEFAULT false,
        "forecast_supported" boolean NOT NULL DEFAULT false,
        "benchmark_supported" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_metric_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_analytics_metric_definition" UNIQUE ("code", "formula_version")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_metric_values" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "metric_code" varchar(100) NOT NULL,
        "period_type" varchar(40) NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "value" numeric(24,8),
        "value_kind" varchar(30) NOT NULL,
        "currency_code" varchar(3),
        "dimensions" jsonb NOT NULL DEFAULT '{}',
        "dimensions_hash" varchar(64) NOT NULL,
        "formula_version" integer NOT NULL,
        "source_event_sequence" bigint NOT NULL DEFAULT 0,
        "calculated_at" timestamptz NOT NULL DEFAULT now(),
        "freshness" varchar(30) NOT NULL DEFAULT 'CURRENT',
        "freshness_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_metric_values" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_analytics_metric_value_period"
      ON "analytics_metric_values" (
        "company_id",
        "metric_code",
        "formula_version",
        "period_type",
        "period_start",
        "period_end",
        "value_kind",
        "dimensions_hash"
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "analytics_projection_checkpoints"
      ADD COLUMN IF NOT EXISTS "company_id" uuid,
      ADD COLUMN IF NOT EXISTS "projection_code" varchar(100),
      ADD COLUMN IF NOT EXISTS "status" varchar(30) NOT NULL DEFAULT 'CURRENT',
      ADD COLUMN IF NOT EXISTS "last_event_sequence" bigint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "last_event_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "last_projected_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "failure_reason" text
    `);

    await queryRunner.query(`
      UPDATE "analytics_projection_checkpoints"
      SET
        "projection_code" = COALESCE("projection_code", "projector_key"),
        "last_event_sequence" = COALESCE("last_event_sequence", "last_sequence_no"),
        "last_projected_at" = COALESCE("last_projected_at", "last_processed_at")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_analytics_projection_checkpoint_company_code"
      ON "analytics_projection_checkpoints" (
        COALESCE("company_id", '00000000-0000-0000-0000-000000000000'::uuid),
        "projection_code"
      )
      WHERE "projection_code" IS NOT NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_regulatory_authority_company" ON "regulatory_authority_profiles" ("company_id", "authority_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_regulatory_definition_company" ON "regulatory_obligation_definitions" ("company_id", "obligation_code", "active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_regulatory_instance_company_due" ON "regulatory_obligation_instances" ("company_id", "due_at", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_regulatory_return_company_status" ON "regulatory_returns" ("company_id", "status", "period_start", "period_end")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_regulatory_submission_return" ON "regulatory_return_submissions" ("regulatory_return_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_regulatory_levy_assessment_company" ON "regulatory_levy_assessments" ("company_id", "status", "period_start", "period_end")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_regulatory_ledger_company_created" ON "regulatory_ledger_entries" ("company_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_schedule_report_code" ON "report_schedules" ("company_id", "report_code", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_job_report_code" ON "report_jobs" ("company_id", "report_code", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_artifact_report_code" ON "report_artifacts" ("company_id", "report_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_access_audit_company" ON "report_access_audit_events" ("company_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_metric_definition_code" ON "analytics_metric_definitions" ("code", "formula_version")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_metric_value_lookup" ON "analytics_metric_values" ("company_id", "metric_code", "period_start", "period_end")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_analytics_metric_value_lookup"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_analytics_metric_definition_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_report_access_audit_company"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_report_artifact_report_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_report_job_report_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_report_schedule_report_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_regulatory_ledger_company_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_regulatory_levy_assessment_company"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_regulatory_submission_return"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_regulatory_return_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_regulatory_instance_company_due"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_regulatory_definition_company"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_regulatory_authority_company"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_analytics_projection_checkpoint_company_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_analytics_metric_value_period"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_regulatory_return_instance_version"`,
    );

    await queryRunner.query(`
      ALTER TABLE "analytics_projection_checkpoints"
      DROP COLUMN IF EXISTS "failure_reason",
      DROP COLUMN IF EXISTS "last_projected_at",
      DROP COLUMN IF EXISTS "last_event_at",
      DROP COLUMN IF EXISTS "last_event_sequence",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "projection_code",
      DROP COLUMN IF EXISTS "company_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_metric_values"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "analytics_metric_definitions"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "report_access_audit_events"`,
    );

    await queryRunner.query(`
      ALTER TABLE "report_artifacts"
      DROP COLUMN IF EXISTS "tenant_scope_hash",
      DROP COLUMN IF EXISTS "last_downloaded_at",
      DROP COLUMN IF EXISTS "download_count",
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "retention_until",
      DROP COLUMN IF EXISTS "file_hash",
      DROP COLUMN IF EXISTS "storage_key",
      DROP COLUMN IF EXISTS "report_code"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "report_delivery_attempts"`);

    await queryRunner.query(`
      ALTER TABLE "report_jobs"
      DROP COLUMN IF EXISTS "safe_error_message",
      DROP COLUMN IF EXISTS "failure_code",
      DROP COLUMN IF EXISTS "row_count",
      DROP COLUMN IF EXISTS "progress_percent",
      DROP COLUMN IF EXISTS "execution_context",
      DROP COLUMN IF EXISTS "source_cutoff_at",
      DROP COLUMN IF EXISTS "parameter_hash",
      DROP COLUMN IF EXISTS "parameter_payload",
      DROP COLUMN IF EXISTS "report_code",
      DROP COLUMN IF EXISTS "job_no"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_schedules"
      DROP COLUMN IF EXISTS "last_delivery_attempt_at",
      DROP COLUMN IF EXISTS "run_as_user_id",
      DROP COLUMN IF EXISTS "verified_smtp_at",
      DROP COLUMN IF EXISTS "last_failure_reason",
      DROP COLUMN IF EXISTS "last_failure_at",
      DROP COLUMN IF EXISTS "failure_count",
      DROP COLUMN IF EXISTS "retention_days",
      DROP COLUMN IF EXISTS "delivery_channel",
      DROP COLUMN IF EXISTS "frequency",
      DROP COLUMN IF EXISTS "parameter_hash",
      DROP COLUMN IF EXISTS "parameter_payload",
      DROP COLUMN IF EXISTS "report_code"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_definitions"
      DROP COLUMN IF EXISTS "active",
      DROP COLUMN IF EXISTS "definition_hash",
      DROP COLUMN IF EXISTS "parameters",
      DROP COLUMN IF EXISTS "asynchronous_only",
      DROP COLUMN IF EXISTS "maximum_rows",
      DROP COLUMN IF EXISTS "permission",
      DROP COLUMN IF EXISTS "sensitivity",
      DROP COLUMN IF EXISTS "version",
      DROP COLUMN IF EXISTS "category"
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_regulatory_ledger_entries_append_only" ON "regulatory_ledger_entries"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_regulatory_ledger_entry_mutation()`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "regulatory_ledger_entries"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "regulatory_levy_assessments"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "regulatory_levy_rules"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "regulatory_return_submissions"`,
    );

    await queryRunner.query(`
      ALTER TABLE "regulatory_returns"
      DROP COLUMN IF EXISTS "state_version",
      DROP COLUMN IF EXISTS "supersedes_return_id",
      DROP COLUMN IF EXISTS "rejection_reason",
      DROP COLUMN IF EXISTS "rejected_at",
      DROP COLUMN IF EXISTS "rejected_by",
      DROP COLUMN IF EXISTS "submitted_for_review_at",
      DROP COLUMN IF EXISTS "submitted_for_review_by",
      DROP COLUMN IF EXISTS "prepared_at",
      DROP COLUMN IF EXISTS "artifact_id",
      DROP COLUMN IF EXISTS "report_job_id",
      DROP COLUMN IF EXISTS "reconciliation_summary",
      DROP COLUMN IF EXISTS "reconciliation_status",
      DROP COLUMN IF EXISTS "validation_results",
      DROP COLUMN IF EXISTS "return_snapshot_hash",
      DROP COLUMN IF EXISTS "return_snapshot",
      DROP COLUMN IF EXISTS "source_projection_sequence",
      DROP COLUMN IF EXISTS "source_cutoff_at",
      DROP COLUMN IF EXISTS "parameters_hash",
      DROP COLUMN IF EXISTS "parameters",
      DROP COLUMN IF EXISTS "currency_code",
      DROP COLUMN IF EXISTS "report_definition_version",
      DROP COLUMN IF EXISTS "report_definition_code",
      DROP COLUMN IF EXISTS "version_number",
      DROP COLUMN IF EXISTS "return_code",
      DROP COLUMN IF EXISTS "obligation_instance_id"
    `);

    await queryRunner.query(
      `DROP TABLE IF EXISTS "regulatory_obligation_instances"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "regulatory_obligation_definitions"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "regulatory_authority_profiles"`,
    );
  }
}
