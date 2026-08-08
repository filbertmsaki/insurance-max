import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyTransactionsEndorsementsRenewals1795500000000 implements MigrationInterface {
  name = 'PolicyTransactionsEndorsementsRenewals1795500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "endorsement_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "code" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "tira_endorsement_type" integer,
        "requires_new_cover_note" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_endorsement_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_endorsement_type_code" UNIQUE ("company_id", "code"),
        CONSTRAINT "FK_endorsement_type_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "transaction_no" character varying(80) NOT NULL,
        "transaction_type" character varying(30) NOT NULL,
        "stage" character varying(40) NOT NULL DEFAULT 'DRAFT',
        "approval_status" character varying(40) NOT NULL DEFAULT 'NOT_EVALUATED',
        "payment_status" character varying(40) NOT NULL DEFAULT 'NOT_EVALUATED',
        "submission_status" character varying(40) NOT NULL DEFAULT 'NOT_READY',
        "source_policy_id" uuid NOT NULL,
        "source_policy_version_id" uuid NOT NULL,
        "source_policy_version_no" integer NOT NULL,
        "source_policy_snapshot" jsonb NOT NULL,
        "source_policy_snapshot_hash" character varying(64) NOT NULL,
        "effective_date" date NOT NULL,
        "reason" text NOT NULL,
        "requested_by" uuid NOT NULL,
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_by" uuid,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "approval_required" boolean NOT NULL DEFAULT false,
        "payment_required" boolean NOT NULL DEFAULT false,
        "premium_effect" character varying(20) NOT NULL DEFAULT 'NONE',
        "additional_premium" numeric(20,4) NOT NULL DEFAULT 0,
        "return_premium" numeric(20,4) NOT NULL DEFAULT 0,
        "net_premium_difference" numeric(20,4) NOT NULL DEFAULT 0,
        "tax_difference" numeric(20,4) NOT NULL DEFAULT 0,
        "commission_difference" numeric(20,4) NOT NULL DEFAULT 0,
        "currency_code" character varying(3) NOT NULL,
        "pricing_snapshot" jsonb,
        "pricing_snapshot_hash" character varying(64),
        "proposed_policy_snapshot" jsonb,
        "proposed_policy_snapshot_hash" character varying(64),
        "active_approval_request_id" uuid,
        "active_invoice_id" uuid,
        "active_refund_id" uuid,
        "tiramis_tracking_id" uuid,
        "tiramis_transaction_id" character varying(100),
        "tiramis_request_id" character varying(100),
        "regulatory_response" jsonb,
        "regulatory_response_hash" character varying(64),
        "target_policy_id" uuid,
        "target_policy_version_id" uuid,
        "state_version" integer NOT NULL DEFAULT 1,
        "idempotency_key" character varying(180),
        "last_command" character varying(80),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "cancelled_by" uuid,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "cancellation_reason" text,
        CONSTRAINT "PK_policy_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_transaction_no" UNIQUE ("company_id", "transaction_no"),
        CONSTRAINT "UQ_policy_transaction_idempotency" UNIQUE ("company_id", "idempotency_key"),
        CONSTRAINT "FK_policy_transaction_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policy_transaction_policy" FOREIGN KEY ("source_policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_policy_transaction_version" FOREIGN KEY ("source_policy_version_id") REFERENCES "policy_versions"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_policy_transaction_type" CHECK (
          "transaction_type" IN ('ENDORSEMENT', 'CANCELLATION', 'RENEWAL')
        ),
        CONSTRAINT "CHK_policy_transaction_amounts" CHECK (
          "additional_premium" >= 0 AND "return_premium" >= 0
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_policy_active_material_transaction"
      ON "policy_transactions" ("source_policy_id")
      WHERE "stage" IN ('DRAFT', 'COMPLETED', 'SUBMISSION_PROCESSING')
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_transactions_company_type_stage"
      ON "policy_transactions" ("company_id", "transaction_type", "stage")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_transaction_changes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_transaction_id" uuid NOT NULL,
        "category" character varying(50) NOT NULL,
        "operation" character varying(20) NOT NULL,
        "field_path" character varying(300) NOT NULL,
        "resource_id" uuid,
        "old_value" jsonb,
        "new_value" jsonb,
        "is_material" boolean NOT NULL DEFAULT true,
        "requires_repricing" boolean NOT NULL DEFAULT false,
        "requires_regulatory_submission" boolean NOT NULL DEFAULT true,
        "change_hash" character varying(64) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_transaction_changes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_policy_transaction_change" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_transaction_changes_transaction"
      ON "policy_transaction_changes" ("policy_transaction_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_endorsements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_transaction_id" uuid NOT NULL,
        "endorsement_type_id" uuid,
        "endorsement_type_code" character varying(50) NOT NULL,
        "endorsement_type_name" character varying(150) NOT NULL,
        "tira_endorsement_type" integer,
        "previous_cover_note_reference" character varying(100) NOT NULL,
        "replacement_cover_note_reference" character varying(100),
        "requires_new_cover_note" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_endorsements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_endorsement_transaction" UNIQUE ("policy_transaction_id"),
        CONSTRAINT "FK_policy_endorsement_transaction" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policy_endorsement_type" FOREIGN KEY ("endorsement_type_id") REFERENCES "endorsement_types"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_cancellations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_transaction_id" uuid NOT NULL,
        "reason_type" character varying(50) NOT NULL,
        "cancellation_method" character varying(40) NOT NULL,
        "requested_effective_date" date NOT NULL,
        "approved_effective_date" date,
        "policy_days" integer NOT NULL,
        "days_on_risk" integer NOT NULL,
        "remaining_days" integer NOT NULL,
        "gross_written_premium" numeric(20,4) NOT NULL,
        "earned_premium" numeric(20,4) NOT NULL,
        "unearned_premium" numeric(20,4) NOT NULL,
        "cancellation_charge" numeric(20,4) NOT NULL DEFAULT 0,
        "refund_amount" numeric(20,4) NOT NULL DEFAULT 0,
        "amount_due" numeric(20,4) NOT NULL DEFAULT 0,
        "claims_review_required" boolean NOT NULL DEFAULT false,
        "claims_review_status" character varying(30) NOT NULL DEFAULT 'NOT_REQUIRED',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_cancellations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_cancellation_transaction" UNIQUE ("policy_transaction_id"),
        CONSTRAINT "FK_policy_cancellation_transaction" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_renewals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_transaction_id" uuid NOT NULL,
        "renewal_no" character varying(80) NOT NULL,
        "renewal_status" character varying(40) NOT NULL DEFAULT 'ELIGIBLE',
        "renewal_start_date" date NOT NULL,
        "renewal_end_date" date NOT NULL,
        "offer_expires_at" TIMESTAMP WITH TIME ZONE,
        "source_cover_note_reference" character varying(100) NOT NULL,
        "renewal_quotation_id" uuid,
        "renewed_policy_id" uuid,
        "customer_accepted_at" TIMESTAMP WITH TIME ZONE,
        "customer_declined_at" TIMESTAMP WITH TIME ZONE,
        "decline_reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_renewals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_renewal_no" UNIQUE ("company_id", "renewal_no"),
        CONSTRAINT "UQ_policy_renewal_transaction" UNIQUE ("policy_transaction_id"),
        CONSTRAINT "FK_policy_renewal_transaction" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policy_renewal_quotation" FOREIGN KEY ("renewal_quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_policy_renewed_policy" FOREIGN KEY ("renewed_policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_transaction_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_transaction_id" uuid NOT NULL,
        "event_type" character varying(100) NOT NULL,
        "actor_type" character varying(30) NOT NULL DEFAULT 'SYSTEM',
        "actor_id" character varying(100),
        "from_stage" character varying(40),
        "to_stage" character varying(40),
        "reason" text,
        "metadata" jsonb,
        "source_event_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_transaction_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_transaction_source_event" UNIQUE ("source_event_id", "event_type"),
        CONSTRAINT "FK_policy_transaction_event" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_transaction_events_transaction"
      ON "policy_transaction_events" ("policy_transaction_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_policy_transaction_event_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('app.audit_maintenance', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'policy_transaction_events is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_policy_transaction_events_append_only" ON "policy_transaction_events"
    `);

    await queryRunner.query(`
      CREATE TRIGGER "TRG_policy_transaction_events_append_only"
      BEFORE UPDATE OR DELETE ON "policy_transaction_events"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_policy_transaction_event_mutation()
    `);

    // Extend policies
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "active_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "pending_transaction_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "last_endorsement_date" date
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "cancellation_effective_date" date
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "renewal_status" character varying(40) NOT NULL DEFAULT 'NOT_STARTED'
    `);

    // Extend policy_versions
    await queryRunner.query(`
      ALTER TABLE "policy_versions"
      ADD COLUMN IF NOT EXISTS "policy_transaction_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_versions"
      ADD COLUMN IF NOT EXISTS "supersedes_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_versions"
      ADD COLUMN IF NOT EXISTS "superseded_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_versions"
      ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_versions"
      ADD COLUMN IF NOT EXISTS "regulatory_reference" character varying(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_versions"
      ADD COLUMN IF NOT EXISTS "effective_transaction_date" date
    `);

    // Backfill: mark the version matching each policy's current_version_no as
    // current, so the new partial unique index below holds for existing data.
    await queryRunner.query(`
      UPDATE "policy_versions" pv
      SET "is_current" = true
      FROM "policies" p
      WHERE pv."policy_id" = p."id"
        AND pv."version_number" = p."current_version_no"
        AND pv."is_current" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_policy_current_version"
      ON "policy_versions" ("policy_id")
      WHERE "is_current" = true
    `);

    await queryRunner
      .query(
        `
      ALTER TABLE "policy_versions"
      ADD CONSTRAINT "FK_policy_version_transaction"
      FOREIGN KEY ("policy_transaction_id")
      REFERENCES "policy_transactions"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);

    await queryRunner
      .query(
        `
      ALTER TABLE "policy_versions"
      ADD CONSTRAINT "FK_policy_version_supersedes"
      FOREIGN KEY ("supersedes_version_id")
      REFERENCES "policy_versions"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);

    await queryRunner
      .query(
        `
      ALTER TABLE "policies"
      ADD CONSTRAINT "FK_policy_active_version"
      FOREIGN KEY ("active_version_id")
      REFERENCES "policy_versions"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);

    await queryRunner
      .query(
        `
      ALTER TABLE "policies"
      ADD CONSTRAINT "FK_policy_pending_transaction"
      FOREIGN KEY ("pending_transaction_id")
      REFERENCES "policy_transactions"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);

    // Portal service requests (§13.28): track the operational transaction an
    // approved request created, for idempotent re-completion.
    await queryRunner.query(`
      ALTER TABLE "portal_service_requests"
      ADD COLUMN IF NOT EXISTS "operational_resource_type" character varying(40)
    `);
    await queryRunner.query(`
      ALTER TABLE "portal_service_requests"
      ADD COLUMN IF NOT EXISTS "operational_resource_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "portal_service_requests"
      ADD COLUMN IF NOT EXISTS "operational_created_at" TIMESTAMP WITH TIME ZONE
    `);

    // Real FKs for the invoice source columns already added in Phase 10/12.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_invoice_endorsement'
        ) THEN
          ALTER TABLE "invoices"
          ADD CONSTRAINT "FK_invoice_endorsement"
          FOREIGN KEY ("endorsement_id")
          REFERENCES "policy_endorsements"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_invoice_cancellation'
        ) THEN
          ALTER TABLE "invoices"
          ADD CONSTRAINT "FK_invoice_cancellation"
          FOREIGN KEY ("cancellation_id")
          REFERENCES "policy_cancellations"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_invoice_renewal'
        ) THEN
          ALTER TABLE "invoices"
          ADD CONSTRAINT "FK_invoice_renewal"
          FOREIGN KEY ("renewal_id")
          REFERENCES "policy_renewals"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "FK_invoice_renewal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "FK_invoice_cancellation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "FK_invoice_endorsement"`,
    );

    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT IF EXISTS "FK_policy_pending_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT IF EXISTS "FK_policy_active_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" DROP CONSTRAINT IF EXISTS "FK_policy_version_supersedes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" DROP CONSTRAINT IF EXISTS "FK_policy_version_transaction"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_policy_current_version"`);
    await queryRunner.query(`
      ALTER TABLE "policy_versions"
      DROP COLUMN IF EXISTS "effective_transaction_date",
      DROP COLUMN IF EXISTS "regulatory_reference",
      DROP COLUMN IF EXISTS "is_current",
      DROP COLUMN IF EXISTS "superseded_at",
      DROP COLUMN IF EXISTS "supersedes_version_id",
      DROP COLUMN IF EXISTS "policy_transaction_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "portal_service_requests"
      DROP COLUMN IF EXISTS "operational_created_at",
      DROP COLUMN IF EXISTS "operational_resource_id",
      DROP COLUMN IF EXISTS "operational_resource_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "policies"
      DROP COLUMN IF EXISTS "renewal_status",
      DROP COLUMN IF EXISTS "cancellation_effective_date",
      DROP COLUMN IF EXISTS "last_endorsement_date",
      DROP COLUMN IF EXISTS "pending_transaction_id",
      DROP COLUMN IF EXISTS "active_version_id"
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_policy_transaction_events_append_only" ON "policy_transaction_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_policy_transaction_event_mutation()`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "policy_transaction_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_renewals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_cancellations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_endorsements"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policy_transaction_changes_transaction"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "policy_transaction_changes"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policy_transactions_company_type_stage"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_policy_active_material_transaction"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "endorsement_types"`);
  }
}
