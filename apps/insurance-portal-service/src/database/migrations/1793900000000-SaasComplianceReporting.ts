import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasComplianceReporting1793900000000 implements MigrationInterface {
  name = 'SaasComplianceReporting1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `
        CREATE TABLE "saas_plans" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "code" varchar(60) NOT NULL,
          "name" varchar(150) NOT NULL,
          "description" text,
          "applicable_company_types" jsonb NOT NULL DEFAULT '[]',
          "billing_interval" varchar(20) NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "base_price" numeric(20,2) NOT NULL DEFAULT 0,
          "trial_days" integer NOT NULL DEFAULT 0,
          "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
          "created_by" uuid,
          "updated_by" uuid,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz,
          CONSTRAINT "PK_saas_plans" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_saas_plan_code" UNIQUE ("code")
        )
      `,
      `
        CREATE TABLE "saas_plan_features" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "plan_id" uuid NOT NULL,
          "feature_code" varchar(100) NOT NULL,
          "value_type" varchar(20) NOT NULL,
          "value" jsonb NOT NULL,
          "description" text,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_saas_plan_features" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_saas_plan_feature" UNIQUE ("plan_id", "feature_code")
        )
      `,
      `
        CREATE TABLE "saas_plan_meter_rates" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "plan_id" uuid NOT NULL,
          "metric_code" varchar(100) NOT NULL,
          "included_quantity" numeric(20,6) NOT NULL DEFAULT 0,
          "billing_unit" numeric(20,6) NOT NULL DEFAULT 1,
          "unit_price" numeric(20,6) NOT NULL DEFAULT 0,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_saas_plan_meter_rates" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_saas_plan_meter_rate" UNIQUE ("plan_id", "metric_code")
        )
      `,
      `
        CREATE TABLE "company_subscriptions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "plan_id" uuid NOT NULL,
          "subscription_no" varchar(60) NOT NULL,
          "status" varchar(30) NOT NULL DEFAULT 'TRIALING',
          "billing_interval" varchar(20) NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "base_price" numeric(20,2) NOT NULL DEFAULT 0,
          "started_at" timestamptz NOT NULL,
          "trial_ends_at" timestamptz,
          "current_period_start" timestamptz NOT NULL,
          "current_period_end" timestamptz NOT NULL,
          "cancel_at_period_end" boolean NOT NULL DEFAULT false,
          "cancelled_at" timestamptz,
          "suspended_at" timestamptz,
          "suspension_reason" text,
          "created_by" uuid,
          "updated_by" uuid,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz,
          CONSTRAINT "PK_company_subscriptions" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_company_subscription_no" UNIQUE ("subscription_no")
        )
      `,
      `
        CREATE TABLE "subscription_entitlements" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "subscription_id" uuid NOT NULL,
          "company_id" uuid NOT NULL,
          "feature_code" varchar(100) NOT NULL,
          "value_type" varchar(20) NOT NULL,
          "value" jsonb NOT NULL,
          "source" varchar(30) NOT NULL DEFAULT 'PLAN',
          "effective_from" timestamptz NOT NULL DEFAULT now(),
          "effective_to" timestamptz,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_subscription_entitlements" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_subscription_entitlement" UNIQUE ("subscription_id", "feature_code")
        )
      `,
      `
        CREATE TABLE "platform_usage_events" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "subscription_id" uuid,
          "metric_code" varchar(100) NOT NULL,
          "quantity" numeric(20,6) NOT NULL,
          "idempotency_key" varchar(180) NOT NULL,
          "resource_type" varchar(80),
          "resource_id" uuid,
          "dimension_key" varchar(128) NOT NULL DEFAULT 'default',
          "dimensions" jsonb NOT NULL DEFAULT '{}',
          "occurred_at" timestamptz NOT NULL,
          "recorded_at" timestamptz NOT NULL DEFAULT now(),
          "metadata" jsonb,
          CONSTRAINT "PK_platform_usage_events" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_platform_usage_event" UNIQUE ("company_id", "metric_code", "idempotency_key")
        )
      `,
      `
        CREATE TABLE "platform_usage_snapshots" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "subscription_id" uuid,
          "metric_code" varchar(100) NOT NULL,
          "period_start" timestamptz NOT NULL,
          "period_end" timestamptz NOT NULL,
          "dimension_key" varchar(128) NOT NULL DEFAULT 'default',
          "dimensions" jsonb NOT NULL DEFAULT '{}',
          "quantity" numeric(20,6) NOT NULL DEFAULT 0,
          "calculated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_platform_usage_snapshots" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_platform_usage_snapshot" UNIQUE ("company_id", "subscription_id", "metric_code", "period_start", "period_end", "dimension_key")
        )
      `,
      `
        CREATE TABLE "saas_billing_cycles" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "subscription_id" uuid NOT NULL,
          "company_id" uuid NOT NULL,
          "period_start" timestamptz NOT NULL,
          "period_end" timestamptz NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "base_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "usage_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "discount_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "tax_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "total_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "status" varchar(30) NOT NULL DEFAULT 'OPEN',
          "calculated_at" timestamptz,
          "closed_at" timestamptz,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_saas_billing_cycles" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_saas_billing_cycle" UNIQUE ("subscription_id", "period_start", "period_end")
        )
      `,
      `
        CREATE TABLE "saas_invoices" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "cycle_id" uuid NOT NULL,
          "subscription_id" uuid NOT NULL,
          "company_id" uuid NOT NULL,
          "invoice_no" varchar(60) NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "subtotal_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "tax_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "total_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "paid_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "balance_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
          "due_at" timestamptz,
          "issued_at" timestamptz,
          "voided_at" timestamptz,
          "created_by" uuid,
          "updated_by" uuid,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_saas_invoices" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_saas_invoice_no" UNIQUE ("invoice_no"),
          CONSTRAINT "UQ_saas_invoice_cycle" UNIQUE ("cycle_id")
        )
      `,
      `
        CREATE TABLE "saas_invoice_items" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "invoice_id" uuid NOT NULL,
          "item_type" varchar(50) NOT NULL,
          "description" text NOT NULL,
          "quantity" numeric(20,6) NOT NULL DEFAULT 1,
          "unit_price" numeric(20,6) NOT NULL DEFAULT 0,
          "amount" numeric(20,2) NOT NULL DEFAULT 0,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_saas_invoice_items" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "saas_payments" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "invoice_id" uuid NOT NULL,
          "company_id" uuid NOT NULL,
          "payment_reference" varchar(100) NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "amount" numeric(20,2) NOT NULL DEFAULT 0,
          "status" varchar(20) NOT NULL DEFAULT 'CONFIRMED',
          "payment_date" date NOT NULL,
          "recorded_by" uuid,
          "notes" text,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_saas_payments" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "company_regulatory_profiles" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "financial_year_start_month" integer NOT NULL DEFAULT 1,
          "regulator_name" varchar(120) NOT NULL DEFAULT 'TIRA',
          "regulator_code" varchar(40),
          "timezone" varchar(60) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
          "levy_frequency" varchar(20) NOT NULL DEFAULT 'MONTHLY',
          "levy_rate" numeric(18,10) NOT NULL DEFAULT 1.5,
          "metadata" jsonb,
          "created_by" uuid,
          "updated_by" uuid,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz,
          CONSTRAINT "PK_company_regulatory_profiles" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_company_regulatory_profile" UNIQUE ("company_id")
        )
      `,
      `
        CREATE TABLE "regulatory_obligation_templates" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "code" varchar(80) NOT NULL,
          "name" varchar(160) NOT NULL,
          "obligation_type" varchar(50) NOT NULL,
          "applicable_company_types" jsonb NOT NULL DEFAULT '[]',
          "frequency" varchar(20) NOT NULL,
          "due_rule_type" varchar(30) NOT NULL,
          "offset_unit" varchar(30),
          "offset_value" integer,
          "fixed_month" integer,
          "fixed_day" integer,
          "effective_from" date,
          "effective_to" date,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_regulatory_obligation_templates" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_regulatory_obligation_template" UNIQUE ("code")
        )
      `,
      `
        CREATE TABLE "regulatory_return_definitions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "code" varchar(80) NOT NULL,
          "name" varchar(160) NOT NULL,
          "generator_key" varchar(80) NOT NULL,
          "applicable_company_types" jsonb NOT NULL DEFAULT '[]',
          "frequency" varchar(20) NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "is_premium_levy" boolean NOT NULL DEFAULT false,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_regulatory_return_definitions" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_regulatory_return_definition" UNIQUE ("code")
        )
      `,
      `
        CREATE TABLE "regulatory_obligations" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "template_id" uuid,
          "return_definition_id" uuid,
          "code" varchar(80) NOT NULL,
          "name" varchar(160) NOT NULL,
          "period_start" date NOT NULL,
          "period_end" date NOT NULL,
          "due_at" timestamptz NOT NULL,
          "status" varchar(40) NOT NULL DEFAULT 'UPCOMING',
          "return_id" uuid,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_regulatory_obligations" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_regulatory_obligation" UNIQUE ("company_id", "code")
        )
      `,
      `
        CREATE TABLE "regulatory_returns" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "definition_id" uuid NOT NULL,
          "obligation_id" uuid,
          "return_no" varchar(60) NOT NULL,
          "status" varchar(40) NOT NULL DEFAULT 'DRAFT',
          "period_start" date NOT NULL,
          "period_end" date NOT NULL,
          "due_at" timestamptz,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "prepared_by" uuid,
          "approved_by" uuid,
          "approved_at" timestamptz,
          "submitted_at" timestamptz,
          "submission_reference" varchar(120),
          "data" jsonb,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz,
          CONSTRAINT "PK_regulatory_returns" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_regulatory_return_no" UNIQUE ("return_no")
        )
      `,
      `
        CREATE TABLE "regulatory_return_attachments" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "return_id" uuid NOT NULL,
          "company_id" uuid NOT NULL,
          "file_name" varchar(160) NOT NULL,
          "evidence_type" varchar(120),
          "storage_path" varchar(255),
          "mime_type" varchar(120),
          "uploaded_by" uuid,
          "uploaded_at" timestamptz NOT NULL DEFAULT now(),
          "metadata" jsonb,
          CONSTRAINT "PK_regulatory_return_attachments" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "regulatory_submission_events" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "return_id" uuid,
          "levy_return_id" uuid,
          "event_type" varchar(60) NOT NULL,
          "event_at" timestamptz NOT NULL DEFAULT now(),
          "actor_id" uuid,
          "notes" text,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_regulatory_submission_events" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "premium_ledger_entries" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "branch_id" uuid,
          "policy_id" uuid,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "entry_type" varchar(40) NOT NULL,
          "status" varchar(20) NOT NULL DEFAULT 'POSTED',
          "transaction_date" date NOT NULL,
          "period_year" integer NOT NULL,
          "period_month" integer NOT NULL,
          "gross_written_premium" numeric(20,2) NOT NULL DEFAULT 0,
          "net_written_premium" numeric(20,2) NOT NULL DEFAULT 0,
          "tax_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "commission_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "brokerage_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "source_type" varchar(80),
          "source_id" uuid,
          "narrative" text,
          "created_by" uuid,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_premium_ledger_entries" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "premium_levy_returns" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "regulatory_return_id" uuid,
          "levy_no" varchar(60) NOT NULL,
          "status" varchar(40) NOT NULL DEFAULT 'DRAFT',
          "period_start" date NOT NULL,
          "period_end" date NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "levy_rate" numeric(18,10) NOT NULL DEFAULT 0,
          "gross_premium" numeric(20,2) NOT NULL DEFAULT 0,
          "adjustments_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "levy_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "billed_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "paid_amount" numeric(20,2) NOT NULL DEFAULT 0,
          "statement_received_at" timestamptz,
          "statement_due_at" timestamptz,
          "control_number" varchar(80),
          "control_number_received_at" timestamptz,
          "payment_due_at" timestamptz,
          "paid_at" timestamptz,
          "prepared_by" uuid,
          "confirmed_by" uuid,
          "notes" text,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz,
          CONSTRAINT "PK_premium_levy_returns" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_premium_levy_return_no" UNIQUE ("levy_no"),
          CONSTRAINT "UQ_premium_levy_regulatory_return" UNIQUE ("regulatory_return_id")
        )
      `,
      `
        CREATE TABLE "premium_levy_return_lines" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "levy_return_id" uuid NOT NULL,
          "line_type" varchar(50) NOT NULL,
          "description" text,
          "amount" numeric(20,2) NOT NULL DEFAULT 0,
          "evidence_reference" varchar(160),
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_premium_levy_return_lines" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "report_definitions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "code" varchar(80) NOT NULL,
          "name" varchar(160) NOT NULL,
          "description" text,
          "generator_key" varchar(80) NOT NULL,
          "default_format" varchar(20) NOT NULL,
          "supported_formats" jsonb NOT NULL DEFAULT '[]',
          "enabled" boolean NOT NULL DEFAULT true,
          "feature_code" varchar(100),
          "usage_metric_code" varchar(100),
          "max_rows" integer,
          "default_filters" jsonb,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_report_definitions" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_report_definition_code" UNIQUE ("code")
        )
      `,
      `
        CREATE TABLE "report_schedules" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "definition_id" uuid NOT NULL,
          "created_by" uuid,
          "name" varchar(160) NOT NULL,
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
          "cron_expression" varchar(120) NOT NULL,
          "timezone" varchar(60) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
          "format" varchar(20) NOT NULL,
          "recipient_emails" jsonb NOT NULL DEFAULT '[]',
          "filters" jsonb,
          "next_run_at" timestamptz,
          "last_run_at" timestamptz,
          "last_job_id" uuid,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz,
          CONSTRAINT "PK_report_schedules" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "report_jobs" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "schedule_id" uuid,
          "definition_id" uuid NOT NULL,
          "requested_by" uuid,
          "status" varchar(20) NOT NULL DEFAULT 'PENDING',
          "format" varchar(20) NOT NULL,
          "execution_key" varchar(120) NOT NULL,
          "filters" jsonb,
          "delivery_status" varchar(20) NOT NULL DEFAULT 'PENDING',
          "claimed_at" timestamptz,
          "claimed_by" varchar(80),
          "started_at" timestamptz,
          "completed_at" timestamptz,
          "failed_at" timestamptz,
          "error_message" text,
          "delivery_error" text,
          "artifact_id" uuid,
          "attempts" integer NOT NULL DEFAULT 0,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_report_jobs" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_report_job_execution_key" UNIQUE ("execution_key")
        )
      `,
      `
        CREATE TABLE "report_artifacts" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "job_id" uuid NOT NULL,
          "definition_id" uuid NOT NULL,
          "format" varchar(20) NOT NULL,
          "file_name" varchar(180) NOT NULL,
          "mime_type" varchar(120) NOT NULL,
          "content" text,
          "size_bytes" bigint NOT NULL DEFAULT 0,
          "checksum" varchar(120),
          "expires_at" timestamptz,
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_report_artifacts" PRIMARY KEY ("id")
        )
      `,
      `
        CREATE TABLE "product_performance_snapshots" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "company_id" uuid NOT NULL,
          "branch_id" uuid,
          "product_id" uuid NOT NULL,
          "currency" varchar(10) NOT NULL DEFAULT 'TZS',
          "snapshot_date" date NOT NULL,
          "period_start" date NOT NULL,
          "period_end" date NOT NULL,
          "gross_written_premium" numeric(20,2) NOT NULL DEFAULT 0,
          "earned_premium" numeric(20,2) NOT NULL DEFAULT 0,
          "premium_collected" numeric(20,2) NOT NULL DEFAULT 0,
          "claims_incurred" numeric(20,2) NOT NULL DEFAULT 0,
          "claims_paid" numeric(20,2) NOT NULL DEFAULT 0,
          "outstanding_reserve" numeric(20,2) NOT NULL DEFAULT 0,
          "ceded_premium" numeric(20,2) NOT NULL DEFAULT 0,
          "commissions" numeric(20,2) NOT NULL DEFAULT 0,
          "policies_count" integer NOT NULL DEFAULT 0,
          "claims_count" integer NOT NULL DEFAULT 0,
          "loss_ratio" numeric(18,6),
          "metadata" jsonb,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_product_performance_snapshots" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_product_performance_snapshot" UNIQUE ("company_id", "branch_id", "product_id", "snapshot_date", "period_start", "period_end")
        )
      `,
      `ALTER TABLE "saas_plan_features" ADD CONSTRAINT "FK_saas_plan_features_plan" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE CASCADE`,
      `ALTER TABLE "saas_plan_meter_rates" ADD CONSTRAINT "FK_saas_plan_meter_rate_plan" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE CASCADE`,
      `ALTER TABLE "company_subscriptions" ADD CONSTRAINT "FK_company_subscription_plan" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "FK_subscription_entitlement_subscription" FOREIGN KEY ("subscription_id") REFERENCES "company_subscriptions"("id") ON DELETE CASCADE`,
      `ALTER TABLE "saas_billing_cycles" ADD CONSTRAINT "FK_saas_billing_cycle_subscription" FOREIGN KEY ("subscription_id") REFERENCES "company_subscriptions"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "saas_invoices" ADD CONSTRAINT "FK_saas_invoice_cycle" FOREIGN KEY ("cycle_id") REFERENCES "saas_billing_cycles"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "saas_invoice_items" ADD CONSTRAINT "FK_saas_invoice_item_invoice" FOREIGN KEY ("invoice_id") REFERENCES "saas_invoices"("id") ON DELETE CASCADE`,
      `ALTER TABLE "saas_payments" ADD CONSTRAINT "FK_saas_payment_invoice" FOREIGN KEY ("invoice_id") REFERENCES "saas_invoices"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "regulatory_obligations" ADD CONSTRAINT "FK_regulatory_obligation_template" FOREIGN KEY ("template_id") REFERENCES "regulatory_obligation_templates"("id") ON DELETE SET NULL`,
      `ALTER TABLE "regulatory_obligations" ADD CONSTRAINT "FK_regulatory_obligation_return_definition" FOREIGN KEY ("return_definition_id") REFERENCES "regulatory_return_definitions"("id") ON DELETE SET NULL`,
      `ALTER TABLE "regulatory_returns" ADD CONSTRAINT "FK_regulatory_return_definition" FOREIGN KEY ("definition_id") REFERENCES "regulatory_return_definitions"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "regulatory_returns" ADD CONSTRAINT "FK_regulatory_return_obligation" FOREIGN KEY ("obligation_id") REFERENCES "regulatory_obligations"("id") ON DELETE SET NULL`,
      `ALTER TABLE "regulatory_return_attachments" ADD CONSTRAINT "FK_regulatory_return_attachment_return" FOREIGN KEY ("return_id") REFERENCES "regulatory_returns"("id") ON DELETE CASCADE`,
      `ALTER TABLE "premium_levy_returns" ADD CONSTRAINT "FK_premium_levy_regulatory_return" FOREIGN KEY ("regulatory_return_id") REFERENCES "regulatory_returns"("id") ON DELETE SET NULL`,
      `ALTER TABLE "premium_levy_return_lines" ADD CONSTRAINT "FK_premium_levy_return_line_return" FOREIGN KEY ("levy_return_id") REFERENCES "premium_levy_returns"("id") ON DELETE CASCADE`,
      `ALTER TABLE "report_schedules" ADD CONSTRAINT "FK_report_schedule_definition" FOREIGN KEY ("definition_id") REFERENCES "report_definitions"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "report_jobs" ADD CONSTRAINT "FK_report_job_definition" FOREIGN KEY ("definition_id") REFERENCES "report_definitions"("id") ON DELETE RESTRICT`,
      `ALTER TABLE "report_jobs" ADD CONSTRAINT "FK_report_job_schedule" FOREIGN KEY ("schedule_id") REFERENCES "report_schedules"("id") ON DELETE SET NULL`,
      `ALTER TABLE "report_artifacts" ADD CONSTRAINT "FK_report_artifact_job" FOREIGN KEY ("job_id") REFERENCES "report_jobs"("id") ON DELETE CASCADE`,
    ];

    for (const statement of statements) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `ALTER TABLE "report_artifacts" DROP CONSTRAINT IF EXISTS "FK_report_artifact_job"`,
      `ALTER TABLE "report_jobs" DROP CONSTRAINT IF EXISTS "FK_report_job_schedule"`,
      `ALTER TABLE "report_jobs" DROP CONSTRAINT IF EXISTS "FK_report_job_definition"`,
      `ALTER TABLE "report_schedules" DROP CONSTRAINT IF EXISTS "FK_report_schedule_definition"`,
      `ALTER TABLE "premium_levy_return_lines" DROP CONSTRAINT IF EXISTS "FK_premium_levy_return_line_return"`,
      `ALTER TABLE "premium_levy_returns" DROP CONSTRAINT IF EXISTS "FK_premium_levy_regulatory_return"`,
      `ALTER TABLE "regulatory_return_attachments" DROP CONSTRAINT IF EXISTS "FK_regulatory_return_attachment_return"`,
      `ALTER TABLE "regulatory_returns" DROP CONSTRAINT IF EXISTS "FK_regulatory_return_obligation"`,
      `ALTER TABLE "regulatory_returns" DROP CONSTRAINT IF EXISTS "FK_regulatory_return_definition"`,
      `ALTER TABLE "regulatory_obligations" DROP CONSTRAINT IF EXISTS "FK_regulatory_obligation_return_definition"`,
      `ALTER TABLE "regulatory_obligations" DROP CONSTRAINT IF EXISTS "FK_regulatory_obligation_template"`,
      `ALTER TABLE "saas_payments" DROP CONSTRAINT IF EXISTS "FK_saas_payment_invoice"`,
      `ALTER TABLE "saas_invoice_items" DROP CONSTRAINT IF EXISTS "FK_saas_invoice_item_invoice"`,
      `ALTER TABLE "saas_invoices" DROP CONSTRAINT IF EXISTS "FK_saas_invoice_cycle"`,
      `ALTER TABLE "saas_billing_cycles" DROP CONSTRAINT IF EXISTS "FK_saas_billing_cycle_subscription"`,
      `ALTER TABLE "subscription_entitlements" DROP CONSTRAINT IF EXISTS "FK_subscription_entitlement_subscription"`,
      `ALTER TABLE "company_subscriptions" DROP CONSTRAINT IF EXISTS "FK_company_subscription_plan"`,
      `ALTER TABLE "saas_plan_meter_rates" DROP CONSTRAINT IF EXISTS "FK_saas_plan_meter_rate_plan"`,
      `ALTER TABLE "saas_plan_features" DROP CONSTRAINT IF EXISTS "FK_saas_plan_features_plan"`,
      `DROP TABLE IF EXISTS "product_performance_snapshots"`,
      `DROP TABLE IF EXISTS "report_artifacts"`,
      `DROP TABLE IF EXISTS "report_jobs"`,
      `DROP TABLE IF EXISTS "report_schedules"`,
      `DROP TABLE IF EXISTS "report_definitions"`,
      `DROP TABLE IF EXISTS "premium_levy_return_lines"`,
      `DROP TABLE IF EXISTS "premium_levy_returns"`,
      `DROP TABLE IF EXISTS "premium_ledger_entries"`,
      `DROP TABLE IF EXISTS "regulatory_submission_events"`,
      `DROP TABLE IF EXISTS "regulatory_return_attachments"`,
      `DROP TABLE IF EXISTS "regulatory_returns"`,
      `DROP TABLE IF EXISTS "regulatory_obligations"`,
      `DROP TABLE IF EXISTS "regulatory_return_definitions"`,
      `DROP TABLE IF EXISTS "regulatory_obligation_templates"`,
      `DROP TABLE IF EXISTS "company_regulatory_profiles"`,
      `DROP TABLE IF EXISTS "saas_payments"`,
      `DROP TABLE IF EXISTS "saas_invoice_items"`,
      `DROP TABLE IF EXISTS "saas_invoices"`,
      `DROP TABLE IF EXISTS "saas_billing_cycles"`,
      `DROP TABLE IF EXISTS "platform_usage_snapshots"`,
      `DROP TABLE IF EXISTS "platform_usage_events"`,
      `DROP TABLE IF EXISTS "subscription_entitlements"`,
      `DROP TABLE IF EXISTS "company_subscriptions"`,
      `DROP TABLE IF EXISTS "saas_plan_meter_rates"`,
      `DROP TABLE IF EXISTS "saas_plan_features"`,
      `DROP TABLE IF EXISTS "saas_plans"`,
    ];

    for (const statement of statements) {
      await queryRunner.query(statement);
    }
  }
}
