import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnterpriseAnalytics1794000000000 implements MigrationInterface {
  name = 'EnterpriseAnalytics1794000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "analytics_projection_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sequence_no" bigserial NOT NULL,

        "event_key" varchar(220) NOT NULL,

        "company_id" uuid,
        "branch_id" uuid,

        "source_module" varchar(80) NOT NULL,
        "aggregate_type" varchar(80) NOT NULL,
        "aggregate_id" uuid NOT NULL,

        "event_type" varchar(40) NOT NULL,
        "event_version" varchar(100) NOT NULL,

        "occurred_at"
          timestamptz NOT NULL,

        "payload"
          jsonb NOT NULL DEFAULT '{}',

        "status"
          varchar(30) NOT NULL DEFAULT 'PENDING',

        "attempt_count"
          integer NOT NULL DEFAULT 0,

        "next_attempt_at"
          timestamptz NOT NULL DEFAULT now(),

        "locked_at" timestamptz,
        "processed_at" timestamptz,

        "last_error" text,

        "created_at"
          timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_projection_events"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_projection_sequence"
          UNIQUE ("sequence_no"),

        CONSTRAINT
          "UQ_analytics_projection_event_key"
          UNIQUE ("event_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_projection_checkpoints" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "projector_key"
          varchar(100) NOT NULL,

        "last_sequence_no"
          bigint NOT NULL DEFAULT 0,

        "last_processed_at" timestamptz,

        "metadata"
          jsonb NOT NULL DEFAULT '{}',

        "created_at"
          timestamptz NOT NULL DEFAULT now(),

        "updated_at"
          timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_projection_checkpoints"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_projector_key"
          UNIQUE ("projector_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_dirty_periods" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "domain" varchar(80) NOT NULL,
        "metric_date" date NOT NULL,

        "status"
          varchar(30) NOT NULL DEFAULT 'PENDING',

        "attempt_count"
          integer NOT NULL DEFAULT 0,

        "next_attempt_at"
          timestamptz NOT NULL DEFAULT now(),

        "locked_at" timestamptz,
        "processed_at" timestamptz,

        "last_error" text,

        "created_at"
          timestamptz NOT NULL DEFAULT now(),

        "updated_at"
          timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_dirty_periods"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "UQ_analytics_dirty_period"
      ON "analytics_dirty_periods" (
        "company_id",
        COALESCE(
          "branch_id",
          '00000000-0000-0000-0000-000000000000'
        ),
        "domain",
        "metric_date"
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_policy_facts" (
        "policy_id" uuid NOT NULL,

        "company_id" uuid NOT NULL,
        "insurer_company_id" uuid NOT NULL,
        "intermediary_company_id" uuid,

        "branch_id" uuid,
        "department_id" uuid,

        "category_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "sub_class_id" uuid,

        "customer_id" uuid NOT NULL,

        "policy_no" varchar(60) NOT NULL,
        "channel_type" varchar(50),

        "policy_status" varchar(40) NOT NULL,

        "issue_date" date NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,

        "currency" varchar(10) NOT NULL,

        "sum_insured"
          numeric(20,2) NOT NULL DEFAULT 0,

        "basic_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "gross_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "net_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "tax_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "commission_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "retention_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "ceded_sum_insured"
          numeric(20,2) NOT NULL DEFAULT 0,

        "ceded_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "reinsurance_required"
          boolean NOT NULL DEFAULT false,

        "tiramis_status" varchar(50),

        "source_created_at" timestamptz,
        "source_updated_at"
          timestamptz NOT NULL,

        "projected_at"
          timestamptz NOT NULL DEFAULT now(),

        "projection_version"
          varchar(100) NOT NULL,

        CONSTRAINT
          "PK_analytics_policy_facts"
          PRIMARY KEY ("policy_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_premium_facts" (
        "ledger_entry_id" uuid NOT NULL,

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "policy_id" uuid NOT NULL,
        "product_id" uuid,
        "category_id" uuid,

        "entry_type" varchar(50) NOT NULL,
        "status" varchar(30) NOT NULL,

        "effective_date" date NOT NULL,

        "currency" varchar(10) NOT NULL,

        "gross_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "tax_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "commission_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "levy_eligible_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "source_updated_at"
          timestamptz NOT NULL,

        "projected_at"
          timestamptz NOT NULL DEFAULT now(),

        "projection_version"
          varchar(100) NOT NULL,

        CONSTRAINT
          "PK_analytics_premium_facts"
          PRIMARY KEY ("ledger_entry_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_claim_facts" (
        "claim_id" uuid NOT NULL,

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "policy_id" uuid NOT NULL,
        "product_id" uuid,
        "category_id" uuid,

        "claim_no" varchar(80) NOT NULL,
        "claim_status" varchar(40) NOT NULL,

        "priority" varchar(30),
        "liability_status" varchar(40),

        "loss_date" timestamptz NOT NULL,
        "report_date" timestamptz NOT NULL,

        "approved_at" timestamptz,
        "closed_at" timestamptz,

        "currency" varchar(10) NOT NULL,

        "estimated_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "approved_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "paid_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "outstanding_reserve"
          numeric(20,2) NOT NULL DEFAULT 0,

        "recovery_expected"
          numeric(20,2) NOT NULL DEFAULT 0,

        "recovery_received"
          numeric(20,2) NOT NULL DEFAULT 0,

        "days_to_approval"
          numeric(18,4),

        "days_to_close"
          numeric(18,4),

        "fraud_indicator"
          boolean NOT NULL DEFAULT false,

        "litigation_indicator"
          boolean NOT NULL DEFAULT false,

        "source_updated_at"
          timestamptz NOT NULL,

        "projected_at"
          timestamptz NOT NULL DEFAULT now(),

        "projection_version"
          varchar(100) NOT NULL,

        CONSTRAINT
          "PK_analytics_claim_facts"
          PRIMARY KEY ("claim_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_reinsurance_facts" (
        "cession_id" uuid NOT NULL,

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "policy_id" uuid NOT NULL,
        "product_id" uuid,
        "category_id" uuid,

        "treaty_id" uuid,
        "facultative_placement_id" uuid,

        "cession_type" varchar(40) NOT NULL,
        "cession_status" varchar(40) NOT NULL,

        "effective_from" date NOT NULL,
        "effective_to" date NOT NULL,

        "currency" varchar(10) NOT NULL,

        "gross_sum_insured"
          numeric(20,2) NOT NULL DEFAULT 0,

        "gross_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "retention_amount"
          numeric(20,2) NOT NULL DEFAULT 0,

        "retained_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "ceded_sum_insured"
          numeric(20,2) NOT NULL DEFAULT 0,

        "ceded_premium"
          numeric(20,2) NOT NULL DEFAULT 0,

        "ceded_share_percent"
          numeric(18,10) NOT NULL DEFAULT 0,

        "source_updated_at"
          timestamptz NOT NULL,

        "projected_at"
          timestamptz NOT NULL DEFAULT now(),

        "projection_version"
          varchar(100) NOT NULL,

        CONSTRAINT
          "PK_analytics_reinsurance_facts"
          PRIMARY KEY ("cession_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_tiramis_facts" (
        "tracking_id" uuid NOT NULL,

        "company_id" uuid,
        "branch_id" uuid,

        "request_type" varchar(100) NOT NULL,
        "service_type" varchar(100),

        "source_module" varchar(100),
        "source_record_id" uuid,

        "status" varchar(50) NOT NULL,

        "submitted_at" timestamptz,
        "acknowledged_at" timestamptz,
        "finalized_at" timestamptz,

        "processing_duration_ms" bigint,

        "retry_count"
          integer NOT NULL DEFAULT 0,

        "successful"
          boolean NOT NULL DEFAULT false,

        "source_updated_at"
          timestamptz NOT NULL,

        "projected_at"
          timestamptz NOT NULL DEFAULT now(),

        "projection_version"
          varchar(100) NOT NULL,

        CONSTRAINT
          "PK_analytics_tiramis_facts"
          PRIMARY KEY ("tracking_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_daily_metrics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "metric_date" date NOT NULL,

        "metric_code"
          varchar(120) NOT NULL,

        "dimension_key"
          varchar(128) NOT NULL DEFAULT 'default',

        "dimensions"
          jsonb NOT NULL DEFAULT '{}',

        "metric_value"
          numeric(30,10) NOT NULL DEFAULT 0,

        "observation_count"
          bigint NOT NULL DEFAULT 0,

        "currency" varchar(10),

        "calculated_at"
          timestamptz NOT NULL DEFAULT now(),

        "projection_version"
          varchar(100) NOT NULL,

        CONSTRAINT
          "PK_analytics_daily_metrics"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "UQ_analytics_daily_metric"
      ON "analytics_daily_metrics" (
        "company_id",
        COALESCE(
          "branch_id",
          '00000000-0000-0000-0000-000000000000'
        ),
        "metric_date",
        "metric_code",
        "dimension_key"
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_kpi_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "code" varchar(100) NOT NULL,
        "name" varchar(180) NOT NULL,
        "description" text,

        "category" varchar(80) NOT NULL,

        "calculator_key"
          varchar(100) NOT NULL,

        "value_type" varchar(30) NOT NULL,

        "direction" varchar(40) NOT NULL,

        "applicable_company_types"
          jsonb NOT NULL DEFAULT '[]',

        "default_target" numeric(30,10),

        "default_warning_threshold" numeric(30,10),

        "default_critical_threshold" numeric(30,10),

        "effective_from" date NOT NULL,
        "effective_to" date,

        "is_active" boolean NOT NULL DEFAULT true,

        "metadata" jsonb NOT NULL DEFAULT '{}',

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_kpi_definitions"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_kpi_version"
          UNIQUE (
            "code",
            "effective_from"
          )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_scorecard_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid,

        "code" varchar(100) NOT NULL,
        "name" varchar(180) NOT NULL,

        "applicable_company_types"
          jsonb NOT NULL DEFAULT '[]',

        "is_default" boolean NOT NULL DEFAULT false,

        "is_active" boolean NOT NULL DEFAULT true,

        "created_by" uuid,

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        "deleted_at" timestamptz,

        CONSTRAINT
          "PK_analytics_scorecard_templates"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_scorecard_template_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "template_id" uuid NOT NULL,
        "kpi_definition_id" uuid NOT NULL,

        "display_order"
          integer NOT NULL DEFAULT 1,

        "weight" numeric(18,6) NOT NULL DEFAULT 1,

        "target_value" numeric(30,10),

        "warning_threshold" numeric(30,10),

        "critical_threshold" numeric(30,10),

        "is_required" boolean NOT NULL DEFAULT true,

        "created_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_scorecard_template_items"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_scorecard_template_kpi"
          UNIQUE (
            "template_id",
            "kpi_definition_id"
          ),

        CONSTRAINT
          "FK_scorecard_item_template"
          FOREIGN KEY ("template_id")
          REFERENCES "analytics_scorecard_templates"("id")
          ON DELETE CASCADE,

        CONSTRAINT
          "FK_scorecard_item_kpi"
          FOREIGN KEY ("kpi_definition_id")
          REFERENCES "analytics_kpi_definitions"("id")
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_scorecard_snapshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "template_id" uuid NOT NULL,

        "period_start" date NOT NULL,
        "period_end" date NOT NULL,

        "version"
          integer NOT NULL DEFAULT 1,

        "overall_score"
          numeric(18,6),

        "overall_status" varchar(30),

        "status"
          varchar(30) NOT NULL DEFAULT 'DRAFT',

        "generated_by" uuid,
        "generated_at" timestamptz,

        "published_by" uuid,
        "published_at" timestamptz,

        "metadata" jsonb NOT NULL DEFAULT '{}',

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_scorecard_snapshots"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_scorecard_version"
          UNIQUE (
            "company_id",
            "template_id",
            "period_start",
            "period_end",
            "version"
          )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_scorecard_values" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "scorecard_snapshot_id" uuid NOT NULL,
        "kpi_definition_id" uuid NOT NULL,

        "value"
          numeric(30,10),

        "numerator"
          numeric(30,10),

        "denominator"
          numeric(30,10),

        "target_value"
          numeric(30,10),

        "score"
          numeric(18,6),

        "status" varchar(30),

        "explanation" text,

        "calculation_metadata"
          jsonb NOT NULL DEFAULT '{}',

        "created_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_scorecard_values"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_scorecard_snapshot_kpi"
          UNIQUE (
            "scorecard_snapshot_id",
            "kpi_definition_id"
          ),

        CONSTRAINT
          "FK_scorecard_value_snapshot"
          FOREIGN KEY ("scorecard_snapshot_id")
          REFERENCES "analytics_scorecard_snapshots"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_anomaly_rules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid,

        "code" varchar(100) NOT NULL,
        "name" varchar(180) NOT NULL,

        "metric_code"
          varchar(120) NOT NULL,

        "method"
          varchar(40) NOT NULL,

        "severity" varchar(20) NOT NULL,

        "lookback_periods"
          integer NOT NULL DEFAULT 30,

        "minimum_observations"
          integer NOT NULL DEFAULT 8,

        "configuration"
          jsonb NOT NULL DEFAULT '{}',

        "dimension_filter"
          jsonb NOT NULL DEFAULT '{}',

        "is_active" boolean NOT NULL DEFAULT true,

        "created_by" uuid,

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        "deleted_at" timestamptz,

        CONSTRAINT
          "PK_analytics_anomaly_rules"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_anomaly_findings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "rule_id" uuid NOT NULL,

        "metric_code"
          varchar(120) NOT NULL,

        "metric_date" date NOT NULL,

        "dimension_key"
          varchar(128) NOT NULL DEFAULT 'default',

        "dimensions"
          jsonb NOT NULL DEFAULT '{}',

        "observed_value"
          numeric(30,10) NOT NULL,

        "expected_value"
          numeric(30,10),

        "deviation_value"
          numeric(30,10),

        "deviation_percent"
          numeric(18,10),

        "severity" varchar(20) NOT NULL,

        "status" varchar(30) NOT NULL DEFAULT 'OPEN',

        "explanation" text NOT NULL,

        "evidence" jsonb NOT NULL DEFAULT '{}',

        "reviewed_by" uuid,
        "reviewed_at" timestamptz,

        "resolution" text,

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_anomaly_findings"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_anomaly_finding"
          UNIQUE (
            "rule_id",
            "company_id",
            "metric_date",
            "dimension_key"
          )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_risk_alerts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "finding_id" uuid,

        "alert_type" varchar(80) NOT NULL,
        "severity" varchar(20) NOT NULL,

        "title" varchar(180) NOT NULL,
        "description" text NOT NULL,

        "resource_type" varchar(80),
        "resource_id" uuid,

        "status"
          varchar(30) NOT NULL DEFAULT 'OPEN',

        "assigned_user_id" uuid,
        "assigned_role" varchar(100),

        "acknowledged_by" uuid,
        "acknowledged_at" timestamptz,

        "resolved_by" uuid,
        "resolved_at" timestamptz,
        "resolution" text,

        "dedupe_key" varchar(220) NOT NULL,

        "metadata" jsonb NOT NULL DEFAULT '{}',

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_risk_alerts"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_alert_dedupe"
          UNIQUE ("dedupe_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_forecast_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid,

        "code" varchar(100) NOT NULL,
        "name" varchar(180) NOT NULL,

        "metric_code"
          varchar(120) NOT NULL,

        "method" varchar(40) NOT NULL DEFAULT 'AUTO',

        "frequency" varchar(20) NOT NULL DEFAULT 'DAILY',

        "history_periods" integer NOT NULL DEFAULT 90,

        "horizon_periods" integer NOT NULL DEFAULT 30,

        "season_length" integer NOT NULL DEFAULT 7,

        "gap_strategy" varchar(30) NOT NULL DEFAULT 'ZERO',

        "configuration" jsonb NOT NULL DEFAULT '{}',

        "is_active" boolean NOT NULL DEFAULT true,

        "created_by" uuid,

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        "deleted_at" timestamptz,

        CONSTRAINT
          "PK_analytics_forecast_definitions"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_forecast_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "branch_id" uuid,

        "definition_id" uuid NOT NULL,

        "run_no" varchar(60) NOT NULL,

        "training_period_start" date NOT NULL,
        "training_period_end" date NOT NULL,

        "forecast_period_start" date NOT NULL,
        "forecast_period_end" date NOT NULL,

        "selected_method" varchar(40),

        "status"
          varchar(30) NOT NULL DEFAULT 'PENDING',

        "mae" numeric(30,10),
        "mape" numeric(30,10),
        "rmse" numeric(30,10),

        "model_parameters" jsonb NOT NULL DEFAULT '{}',

        "started_at" timestamptz,
        "completed_at" timestamptz,

        "error_message" text,

        "created_by" uuid,

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_forecast_runs"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_forecast_run_no"
          UNIQUE ("run_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analytics_forecast_points" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "forecast_run_id" uuid NOT NULL,

        "forecast_date" date NOT NULL,

        "predicted_value"
          numeric(30,10) NOT NULL,

        "lower_bound" numeric(30,10),

        "upper_bound" numeric(30,10),

        "actual_value" numeric(30,10),

        "created_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT
          "PK_analytics_forecast_points"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_analytics_forecast_point"
          UNIQUE (
            "forecast_run_id",
            "forecast_date"
          ),

        CONSTRAINT
          "FK_forecast_point_run"
          FOREIGN KEY ("forecast_run_id")
          REFERENCES "analytics_forecast_runs"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "platform_benchmark_snapshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "metric_code"
          varchar(120) NOT NULL,

        "cohort_key" varchar(180) NOT NULL,

        "cohort_dimensions"
          jsonb NOT NULL DEFAULT '{}',

        "period_start" date NOT NULL,
        "period_end" date NOT NULL,

        "company_count" integer NOT NULL,

        "mean_value" numeric(30,10),

        "minimum_value" numeric(30,10),

        "percentile_25" numeric(30,10),

        "median_value" numeric(30,10),

        "percentile_75" numeric(30,10),

        "maximum_value" numeric(30,10),

        "status" varchar(30) NOT NULL,

        "minimum_cohort_size" integer NOT NULL,

        "calculated_at" timestamptz NOT NULL DEFAULT now(),

        "published_at" timestamptz,

        "metadata" jsonb NOT NULL DEFAULT '{}',

        CONSTRAINT
          "PK_platform_benchmark_snapshots"
          PRIMARY KEY ("id"),

        CONSTRAINT
          "UQ_platform_benchmark_snapshot"
          UNIQUE (
            "metric_code",
            "cohort_key",
            "period_start",
            "period_end"
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_projection_events_pending"
      ON "analytics_projection_events" (
        "status",
        "next_attempt_at",
        "sequence_no"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_dirty_periods_pending"
      ON "analytics_dirty_periods" (
        "status",
        "next_attempt_at",
        "metric_date"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_policy_facts_company_date"
      ON "analytics_policy_facts" (
        "company_id",
        "issue_date",
        "policy_status"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_premium_facts_company_date"
      ON "analytics_premium_facts" (
        "company_id",
        "effective_date",
        "status"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_claim_facts_company_date"
      ON "analytics_claim_facts" (
        "company_id",
        "report_date",
        "claim_status"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_daily_metrics_lookup"
      ON "analytics_daily_metrics" (
        "company_id",
        "metric_code",
        "metric_date"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_anomaly_findings_company"
      ON "analytics_anomaly_findings" (
        "company_id",
        "status",
        "severity",
        "metric_date"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
        "IDX_risk_alerts_company"
      ON "analytics_risk_alerts" (
        "company_id",
        "status",
        "severity",
        "created_at"
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "platform_benchmark_snapshots"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_forecast_points"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_forecast_runs"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_forecast_definitions"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_risk_alerts"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_anomaly_findings"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_anomaly_rules"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_scorecard_values"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_scorecard_snapshots"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_scorecard_template_items"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_scorecard_templates"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_kpi_definitions"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_daily_metrics"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_tiramis_facts"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_reinsurance_facts"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_claim_facts"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_premium_facts"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_policy_facts"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_dirty_periods"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_projection_checkpoints"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "analytics_projection_events"
    `);
  }
}
