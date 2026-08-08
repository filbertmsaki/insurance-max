import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimsAndComplaintsAuthority1795600000000 implements MigrationInterface {
  name = 'ClaimsAndComplaintsAuthority1795600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------
    // Documents registry (lightweight, populates the previously-empty
    // insurance-documents module)
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "owner_type" character varying(60) NOT NULL,
        "owner_id" uuid,
        "storage_key" character varying(500) NOT NULL,
        "checksum" character varying(128) NOT NULL,
        "content_type" character varying(150),
        "file_name" character varying(255) NOT NULL,
        "file_size" bigint,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "uploaded_by" uuid,
        "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "verified_by" uuid,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "rejection_reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_document_status" CHECK (
          "status" IN ('PENDING', 'VERIFIED', 'REJECTED')
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_owner"
      ON "documents" ("company_id", "owner_type", "owner_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "claim_documents"
      ADD COLUMN IF NOT EXISTS "document_id" uuid
    `);

    await queryRunner
      .query(
        `
      ALTER TABLE "claim_documents"
      ADD CONSTRAINT "FK_claim_document_registry"
      FOREIGN KEY ("document_id")
      REFERENCES "documents"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);

    // ---------------------------------------------------------------
    // Claims: additive status dimensions + coverage/incident snapshots
    // ---------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "claims"
      ADD COLUMN IF NOT EXISTS "claim_stage" character varying(40) NOT NULL DEFAULT 'NOTIFICATION_PENDING',
      ADD COLUMN IF NOT EXISTS "coverage_status" character varying(40) NOT NULL DEFAULT 'NOT_EVALUATED',
      ADD COLUMN IF NOT EXISTS "settlement_status" character varying(40) NOT NULL DEFAULT 'NOT_READY',
      ADD COLUMN IF NOT EXISTS "fraud_status" character varying(40) NOT NULL DEFAULT 'NOT_SCREENED',
      ADD COLUMN IF NOT EXISTS "policy_version_id" uuid,
      ADD COLUMN IF NOT EXISTS "policy_version_number" integer,
      ADD COLUMN IF NOT EXISTS "policy_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "policy_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "coverage_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "coverage_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "incident_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "incident_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "claimant_manifest_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "duplicate_fingerprint" character varying(64),
      ADD COLUMN IF NOT EXISTS "possible_duplicate_of_id" uuid,
      ADD COLUMN IF NOT EXISTS "duplicate_override_reason" text,
      ADD COLUMN IF NOT EXISTS "duplicate_override_by" uuid,
      ADD COLUMN IF NOT EXISTS "gross_case_reserve" numeric(18,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "gross_incurred_amount" numeric(18,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "expense_paid_amount" numeric(18,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "indemnity_paid_amount" numeric(18,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "total_recovery_expected" numeric(18,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "total_recovery_received" numeric(18,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "net_incurred_amount" numeric(18,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "current_assessment_id" uuid,
      ADD COLUMN IF NOT EXISTS "current_discharge_voucher_id" uuid,
      ADD COLUMN IF NOT EXISTS "source_channel" character varying(40) NOT NULL DEFAULT 'INTERNAL',
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner
      .query(
        `
      ALTER TABLE "claims"
      ADD CONSTRAINT "FK_claim_policy_version"
      FOREIGN KEY ("policy_version_id")
      REFERENCES "policy_versions"("id")
      ON DELETE RESTRICT
    `,
      )
      .catch(() => undefined);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_claim_duplicate_fingerprint"
      ON "claims" ("company_id", "duplicate_fingerprint")
      WHERE "deleted_at" IS NULL
    `);

    // ---------------------------------------------------------------
    // Claim regulatory operations
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_regulatory_operations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL,
        "operation_type" character varying(40) NOT NULL,
        "source_record_id" uuid NOT NULL,
        "source_record_number" character varying(100) NOT NULL,
        "sequence_number" integer NOT NULL,
        "status" character varying(40) NOT NULL DEFAULT 'NOT_SUBMITTED',
        "tiramis_tracking_id" uuid,
        "tiramis_transaction_id" character varying(100),
        "tiramis_request_id" character varying(100),
        "regulatory_reference" character varying(150),
        "request_snapshot" jsonb NOT NULL,
        "request_snapshot_hash" character varying(64) NOT NULL,
        "response_snapshot" jsonb,
        "response_snapshot_hash" character varying(64),
        "acknowledgement_code" character varying(40),
        "acknowledgement_message" text,
        "final_response_code" character varying(40),
        "final_response_message" text,
        "signature_verified" boolean,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "acknowledged_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_regulatory_operations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_claim_regulatory_source" UNIQUE ("operation_type", "source_record_id"),
        CONSTRAINT "UQ_claim_regulatory_sequence" UNIQUE ("claim_id", "operation_type", "sequence_number"),
        CONSTRAINT "FK_claim_regulatory_claim" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_claim_regulatory_tracking" FOREIGN KEY ("tiramis_tracking_id") REFERENCES "tiramis_submission_tracking"("id") ON DELETE SET NULL
      )
    `);

    // ---------------------------------------------------------------
    // Append-only reserve movement ledger
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_reserve_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL,
        "reserve_id" uuid NOT NULL,
        "movement_no" character varying(80) NOT NULL,
        "movement_type" character varying(30) NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "signed_amount" numeric(18,2) NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "effective_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "reason" text NOT NULL,
        "source_event_id" character varying(180) NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_reserve_movements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_claim_reserve_movement_no" UNIQUE ("company_id", "movement_no"),
        CONSTRAINT "UQ_claim_reserve_source_event" UNIQUE ("company_id", "source_event_id"),
        CONSTRAINT "FK_claim_reserve_movement_claim" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_claim_reserve_movement_reserve" FOREIGN KEY ("reserve_id") REFERENCES "claim_reserves"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_claim_reserve_signed_amount" CHECK (
          ("movement_type" IN ('INITIAL', 'INCREASE', 'REOPEN') AND "signed_amount" > 0)
          OR ("movement_type" IN ('DECREASE', 'RELEASE') AND "signed_amount" < 0)
        )
      )
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_claim_reserve_movement_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('app.audit_maintenance', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'claim_reserve_movements is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_claim_reserve_movements_append_only" ON "claim_reserve_movements"
    `);

    await queryRunner.query(`
      CREATE TRIGGER "TRG_claim_reserve_movements_append_only"
      BEFORE UPDATE OR DELETE ON "claim_reserve_movements"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_claim_reserve_movement_mutation()
    `);

    // ---------------------------------------------------------------
    // Claim decisions (liability authority, separate from assessment)
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_decisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL,
        "assessment_id" uuid,
        "decision_no" character varying(80) NOT NULL,
        "decision_type" character varying(40) NOT NULL,
        "liability_status" character varying(40) NOT NULL,
        "amount_claimed" numeric(18,2) NOT NULL,
        "amount_admitted" numeric(18,2) NOT NULL,
        "amount_declined" numeric(18,2) NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "reason" text NOT NULL,
        "decision_snapshot" jsonb NOT NULL,
        "decision_snapshot_hash" character varying(64) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid NOT NULL,
        "submitted_by" uuid,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "approved_by" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "rejected_by" uuid,
        "rejected_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_decisions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_claim_decision_no" UNIQUE ("company_id", "decision_no"),
        CONSTRAINT "FK_claim_decision_claim" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_claim_decision_assessment" FOREIGN KEY ("assessment_id") REFERENCES "claim_assessments"("id") ON DELETE SET NULL
      )
    `);

    // ---------------------------------------------------------------
    // Claim payments: finance disbursement authority
    // ---------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "claim_payments"
      ADD COLUMN IF NOT EXISTS "payment_type" character varying(40) NOT NULL DEFAULT 'INDEMNITY',
      ADD COLUMN IF NOT EXISTS "payee_type" character varying(40),
      ADD COLUMN IF NOT EXISTS "payee_id" uuid,
      ADD COLUMN IF NOT EXISTS "payee_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "payment_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "payment_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "finance_disbursement_id" uuid,
      ADD COLUMN IF NOT EXISTS "finance_status" character varying(40) NOT NULL DEFAULT 'NOT_REQUESTED',
      ADD COLUMN IF NOT EXISTS "finance_event_id" character varying(180),
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_disbursements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL,
        "claim_payment_id" uuid NOT NULL,
        "disbursement_no" character varying(80) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'REQUESTED',
        "payment_method" character varying(40),
        "amount" numeric(18,2) NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "payee_snapshot" jsonb,
        "requested_by" uuid NOT NULL,
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "confirmed_by" uuid,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "provider_reference" character varying(180),
        "failed_at" TIMESTAMP WITH TIME ZONE,
        "failure_message" text,
        "idempotency_key" character varying(180) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_disbursements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_claim_disbursement_no" UNIQUE ("company_id", "disbursement_no"),
        CONSTRAINT "UQ_claim_disbursement_idempotency" UNIQUE ("company_id", "idempotency_key"),
        CONSTRAINT "FK_claim_disbursement_claim" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_claim_disbursement_payment" FOREIGN KEY ("claim_payment_id") REFERENCES "claim_payments"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner
      .query(
        `
      ALTER TABLE "claim_payments"
      ADD CONSTRAINT "FK_claim_payment_disbursement"
      FOREIGN KEY ("finance_disbursement_id")
      REFERENCES "claim_disbursements"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);

    // ---------------------------------------------------------------
    // Complaints: complete the lifecycle
    // ---------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "complaints"
      ADD COLUMN IF NOT EXISTS "complainant_type" character varying(40) NOT NULL DEFAULT 'CUSTOMER',
      ADD COLUMN IF NOT EXISTS "complainant_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "source_channel" character varying(40) NOT NULL DEFAULT 'INTERNAL',
      ADD COLUMN IF NOT EXISTS "source_reference" character varying(150),
      ADD COLUMN IF NOT EXISTS "invoice_id" uuid,
      ADD COLUMN IF NOT EXISTS "payment_id" uuid,
      ADD COLUMN IF NOT EXISTS "assigned_team" character varying(100),
      ADD COLUMN IF NOT EXISTS "root_cause" text,
      ADD COLUMN IF NOT EXISTS "corrective_action" text,
      ADD COLUMN IF NOT EXISTS "preventive_action" text,
      ADD COLUMN IF NOT EXISTS "regulatory_reportable" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "customer_acceptance_status" character varying(30) NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "customer_response" text,
      ADD COLUMN IF NOT EXISTS "customer_responded_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "acknowledgement_due_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "resolution_due_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "appeal_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "closure_reason" text,
      ADD COLUMN IF NOT EXISTS "reopened_by" uuid,
      ADD COLUMN IF NOT EXISTS "reopened_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "cancelled_by" uuid,
      ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "complaint_appeals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "complaint_id" uuid NOT NULL,
        "appeal_no" character varying(80) NOT NULL,
        "reason" text NOT NULL,
        "filed_by" uuid NOT NULL,
        "filed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "decision" character varying(30),
        "decided_by" uuid,
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_appeals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_complaint_appeal_no" UNIQUE ("company_id", "appeal_no"),
        CONSTRAINT "FK_complaint_appeal_complaint" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "complaint_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "complaint_id" uuid NOT NULL,
        "body" text NOT NULL,
        "is_customer_visible" boolean NOT NULL DEFAULT false,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_complaint_comment_complaint" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE
      )
    `);

    // ---------------------------------------------------------------
    // Complaint SLA (parallel to, and separately configurable from,
    // claim_sla_rules / claim_sla_events)
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "complaint_sla_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid,
        "event_type" character varying(60) NOT NULL,
        "duration_hours" integer NOT NULL,
        "warning_hours_before" integer NOT NULL DEFAULT 0,
        "effective_from" date NOT NULL DEFAULT CURRENT_DATE,
        "effective_to" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_sla_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "complaint_sla_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "complaint_id" uuid NOT NULL,
        "event_type" character varying(60) NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "due_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "warning_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "breached_at" TIMESTAMP WITH TIME ZONE,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "rule_snapshot" jsonb,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_complaint_sla_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_complaint_sla_event_complaint" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_complaint_sla_events_pending"
      ON "complaint_sla_events" ("status", "due_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_complaint_sla_events_pending"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_sla_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_sla_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_appeals"`);

    await queryRunner.query(`
      ALTER TABLE "complaints"
      DROP COLUMN IF EXISTS "cancelled_at",
      DROP COLUMN IF EXISTS "cancelled_by",
      DROP COLUMN IF EXISTS "reopened_at",
      DROP COLUMN IF EXISTS "reopened_by",
      DROP COLUMN IF EXISTS "closure_reason",
      DROP COLUMN IF EXISTS "state_version",
      DROP COLUMN IF EXISTS "appeal_count",
      DROP COLUMN IF EXISTS "resolution_due_at",
      DROP COLUMN IF EXISTS "acknowledgement_due_at",
      DROP COLUMN IF EXISTS "customer_responded_at",
      DROP COLUMN IF EXISTS "customer_response",
      DROP COLUMN IF EXISTS "customer_acceptance_status",
      DROP COLUMN IF EXISTS "regulatory_reportable",
      DROP COLUMN IF EXISTS "preventive_action",
      DROP COLUMN IF EXISTS "corrective_action",
      DROP COLUMN IF EXISTS "root_cause",
      DROP COLUMN IF EXISTS "assigned_team",
      DROP COLUMN IF EXISTS "payment_id",
      DROP COLUMN IF EXISTS "invoice_id",
      DROP COLUMN IF EXISTS "source_reference",
      DROP COLUMN IF EXISTS "source_channel",
      DROP COLUMN IF EXISTS "complainant_snapshot",
      DROP COLUMN IF EXISTS "complainant_type"
    `);

    await queryRunner.query(
      `ALTER TABLE "claim_payments" DROP CONSTRAINT IF EXISTS "FK_claim_payment_disbursement"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_disbursements"`);
    await queryRunner.query(`
      ALTER TABLE "claim_payments"
      DROP COLUMN IF EXISTS "state_version",
      DROP COLUMN IF EXISTS "finance_event_id",
      DROP COLUMN IF EXISTS "finance_status",
      DROP COLUMN IF EXISTS "finance_disbursement_id",
      DROP COLUMN IF EXISTS "payment_snapshot_hash",
      DROP COLUMN IF EXISTS "payment_snapshot",
      DROP COLUMN IF EXISTS "payee_snapshot",
      DROP COLUMN IF EXISTS "payee_id",
      DROP COLUMN IF EXISTS "payee_type",
      DROP COLUMN IF EXISTS "payment_type"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "claim_decisions"`);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_claim_reserve_movements_append_only" ON "claim_reserve_movements"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_claim_reserve_movement_mutation()`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_reserve_movements"`);

    await queryRunner.query(
      `DROP TABLE IF EXISTS "claim_regulatory_operations"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_claim_duplicate_fingerprint"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "FK_claim_policy_version"`,
    );
    await queryRunner.query(`
      ALTER TABLE "claims"
      DROP COLUMN IF EXISTS "state_version",
      DROP COLUMN IF EXISTS "source_channel",
      DROP COLUMN IF EXISTS "current_discharge_voucher_id",
      DROP COLUMN IF EXISTS "current_assessment_id",
      DROP COLUMN IF EXISTS "net_incurred_amount",
      DROP COLUMN IF EXISTS "total_recovery_received",
      DROP COLUMN IF EXISTS "total_recovery_expected",
      DROP COLUMN IF EXISTS "indemnity_paid_amount",
      DROP COLUMN IF EXISTS "expense_paid_amount",
      DROP COLUMN IF EXISTS "gross_incurred_amount",
      DROP COLUMN IF EXISTS "gross_case_reserve",
      DROP COLUMN IF EXISTS "duplicate_override_by",
      DROP COLUMN IF EXISTS "duplicate_override_reason",
      DROP COLUMN IF EXISTS "possible_duplicate_of_id",
      DROP COLUMN IF EXISTS "duplicate_fingerprint",
      DROP COLUMN IF EXISTS "claimant_manifest_hash",
      DROP COLUMN IF EXISTS "incident_snapshot_hash",
      DROP COLUMN IF EXISTS "incident_snapshot",
      DROP COLUMN IF EXISTS "coverage_snapshot_hash",
      DROP COLUMN IF EXISTS "coverage_snapshot",
      DROP COLUMN IF EXISTS "policy_snapshot_hash",
      DROP COLUMN IF EXISTS "policy_snapshot",
      DROP COLUMN IF EXISTS "policy_version_number",
      DROP COLUMN IF EXISTS "policy_version_id",
      DROP COLUMN IF EXISTS "fraud_status",
      DROP COLUMN IF EXISTS "settlement_status",
      DROP COLUMN IF EXISTS "coverage_status",
      DROP COLUMN IF EXISTS "claim_stage"
    `);

    await queryRunner.query(
      `ALTER TABLE "claim_documents" DROP CONSTRAINT IF EXISTS "FK_claim_document_registry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_documents" DROP COLUMN IF EXISTS "document_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_owner"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
  }
}
