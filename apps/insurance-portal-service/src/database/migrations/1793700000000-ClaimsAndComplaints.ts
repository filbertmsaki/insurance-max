import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimsAndComplaints1793700000000 implements MigrationInterface {
  name = 'ClaimsAndComplaints1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claims" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "insurer_company_id" uuid NOT NULL,
        "intermediary_company_id" uuid NULL,
        "reported_by_company_id" uuid NULL,
        "branch_id" uuid NULL,
        "reported_branch_id" uuid NULL,
        "sale_point_id" uuid NULL,
        "policy_id" uuid NOT NULL,
        "policy_risk_id" uuid NULL,
        "customer_id" uuid NOT NULL,
        "assigned_user_id" uuid NULL,
        "reported_by_user_id" uuid NULL,
        "created_by" uuid NULL,
        "claim_no" varchar(60) NOT NULL,
        "claim_notification_number" varchar(80) NOT NULL,
        "claim_reference_number" varchar(100) NULL,
        "cover_note_reference_number" varchar(100) NOT NULL,
        "claim_report_date" timestamptz NOT NULL,
        "loss_date" timestamptz NOT NULL,
        "loss_nature" varchar(150) NOT NULL,
        "loss_type" varchar(100) NOT NULL,
        "loss_location" text NOT NULL,
        "description" text NOT NULL,
        "cause_of_loss" text NULL,
        "police_report_number" varchar(100) NULL,
        "claim_form_dully_filled" varchar(1) NOT NULL DEFAULT 'N',
        "officer_name" varchar(150) NULL,
        "officer_title" varchar(100) NULL,
        "currency_code" varchar(10) NOT NULL DEFAULT 'TZS',
        "exchange_rate" numeric(18, 6) NOT NULL DEFAULT 1,
        "estimated_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "approved_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "paid_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "outstanding_reserve" numeric(18, 2) NOT NULL DEFAULT 0,
        "recovery_expected" numeric(18, 2) NOT NULL DEFAULT 0,
        "recovery_received" numeric(18, 2) NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'NOTIFIED',
        "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "liability_status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "fraud_indicator" boolean NOT NULL DEFAULT false,
        "litigation_indicator" boolean NOT NULL DEFAULT false,
        "closed_by" uuid NULL,
        "closed_at" timestamptz NULL,
        "closure_reason" text NULL,
        "metadata" jsonb NULL,
        "tiramis_submission_tracking_id" uuid NULL,
        "tiramis_status" varchar(50) NULL,
        "tiramis_transaction_id" varchar(100) NULL,
        "tiramis_request_id" varchar(100) NULL,
        "tiramis_service_type" varchar(80) NULL,
        "tiramis_root_element" varchar(100) NULL,
        "tiramis_acknowledgement_status_code" varchar(20) NULL,
        "tiramis_acknowledgement_status_desc" varchar(255) NULL,
        "tiramis_final_response_id" varchar(100) NULL,
        "tiramis_final_response_status_code" varchar(20) NULL,
        "tiramis_final_response_status_desc" varchar(255) NULL,
        "tiramis_last_error_message" text NULL,
        "tiramis_last_synced_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_claimants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "customer_id" uuid NULL,
        "claimant_type" varchar(40) NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "full_name" varchar(180) NOT NULL,
        "identification_type" varchar(50) NULL,
        "identification_number" varchar(100) NULL,
        "phone" varchar(50) NULL,
        "email" varchar(150) NULL,
        "amount_claimed" numeric(18, 2) NOT NULL DEFAULT 0,
        "amount_approved" numeric(18, 2) NOT NULL DEFAULT 0,
        "amount_paid" numeric(18, 2) NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'ACTIVE',
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "document_type" varchar(80) NOT NULL,
        "requirement_code" varchar(80) NULL,
        "title" varchar(180) NOT NULL,
        "storage_key" varchar(500) NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "mime_type" varchar(120) NULL,
        "file_size" bigint NULL,
        "checksum" varchar(128) NULL,
        "status" varchar(30) NOT NULL DEFAULT 'UPLOADED',
        "uploaded_by" uuid NULL,
        "uploaded_at" timestamptz NOT NULL,
        "verified_by" uuid NULL,
        "verified_at" timestamptz NULL,
        "rejection_reason" text NULL,
        "expires_at" timestamptz NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_reserves" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "reserve_no" varchar(60) NOT NULL,
        "reserve_type" varchar(50) NOT NULL,
        "amount" numeric(18, 2) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "reason" text NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "effective_at" timestamptz NOT NULL,
        "created_by" uuid NULL,
        "submitted_by" uuid NULL,
        "submitted_at" timestamptz NULL,
        "approved_by" uuid NULL,
        "approved_at" timestamptz NULL,
        "rejected_by" uuid NULL,
        "rejected_at" timestamptz NULL,
        "rejection_reason" text NULL,
        "released_by" uuid NULL,
        "released_at" timestamptz NULL,
        "release_reason" text NULL,
        "supersedes_reserve_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_intimations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "claim_intimation_number" varchar(80) NOT NULL,
        "claim_reference_number" varchar(100) NULL,
        "cover_note_reference_number" varchar(100) NOT NULL,
        "claim_intimation_date" timestamptz NOT NULL,
        "currency_code" varchar(10) NOT NULL,
        "exchange_rate" numeric(18, 6) NOT NULL DEFAULT 1,
        "claim_estimated_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "claim_reserve_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "claim_reserve_method" varchar(100) NOT NULL,
        "loss_assessment_option" int NOT NULL DEFAULT 1,
        "assessor_name" varchar(180) NULL,
        "assessor_id_number" varchar(100) NULL,
        "assessor_id_type" int NULL,
        "claimants" jsonb NOT NULL DEFAULT '[]',
        "status" varchar(30) NOT NULL DEFAULT 'CREATED',
        "created_by" uuid NULL,
        "tiramis_submission_tracking_id" uuid NULL,
        "tiramis_status" varchar(50) NULL,
        "tiramis_transaction_id" varchar(100) NULL,
        "tiramis_request_id" varchar(100) NULL,
        "tiramis_service_type" varchar(80) NULL,
        "tiramis_root_element" varchar(100) NULL,
        "tiramis_acknowledgement_status_code" varchar(20) NULL,
        "tiramis_acknowledgement_status_desc" varchar(255) NULL,
        "tiramis_final_response_id" varchar(100) NULL,
        "tiramis_final_response_status_code" varchar(20) NULL,
        "tiramis_final_response_status_desc" varchar(255) NULL,
        "tiramis_last_error_message" text NULL,
        "tiramis_last_synced_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_service_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "provider_company_id" uuid NULL,
        "assigned_user_id" uuid NULL,
        "service_type" varchar(80) NOT NULL,
        "assignment_no" varchar(80) NOT NULL,
        "instructions" text NULL,
        "assigned_at" timestamptz NOT NULL,
        "due_at" timestamptz NULL,
        "accepted_at" timestamptz NULL,
        "declined_at" timestamptz NULL,
        "decline_reason" text NULL,
        "report_submitted_at" timestamptz NULL,
        "completed_at" timestamptz NULL,
        "estimated_fee" numeric(18, 2) NOT NULL DEFAULT 0,
        "approved_fee" numeric(18, 2) NOT NULL DEFAULT 0,
        "currency" varchar(10) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'ASSIGNED',
        "created_by" uuid NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_assessments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "service_assignment_id" uuid NULL,
        "claim_assessment_number" varchar(80) NOT NULL,
        "claim_intimation_number" varchar(80) NULL,
        "claim_reference_number" varchar(100) NULL,
        "cover_note_reference_number" varchar(100) NOT NULL,
        "assessment_received_date" timestamptz NOT NULL,
        "assessment_report_summary" text NOT NULL,
        "currency_code" varchar(10) NOT NULL,
        "exchange_rate" numeric(18, 6) NOT NULL DEFAULT 1,
        "assessment_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "approved_claim_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "claim_approval_date" timestamptz NULL,
        "claim_approval_authority" varchar(180) NULL,
        "is_re_assessment" varchar(1) NOT NULL DEFAULT 'N',
        "claimants" jsonb NOT NULL DEFAULT '[]',
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid NULL,
        "submitted_by" uuid NULL,
        "submitted_at" timestamptz NULL,
        "approved_by" uuid NULL,
        "approved_at" timestamptz NULL,
        "rejected_by" uuid NULL,
        "rejected_at" timestamptz NULL,
        "rejection_reason" text NULL,
        "tiramis_submission_tracking_id" uuid NULL,
        "tiramis_status" varchar(50) NULL,
        "tiramis_transaction_id" varchar(100) NULL,
        "tiramis_request_id" varchar(100) NULL,
        "tiramis_service_type" varchar(80) NULL,
        "tiramis_root_element" varchar(100) NULL,
        "tiramis_acknowledgement_status_code" varchar(20) NULL,
        "tiramis_acknowledgement_status_desc" varchar(255) NULL,
        "tiramis_final_response_id" varchar(100) NULL,
        "tiramis_final_response_status_code" varchar(20) NULL,
        "tiramis_final_response_status_desc" varchar(255) NULL,
        "tiramis_last_error_message" text NULL,
        "tiramis_last_synced_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_discharge_vouchers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "claimant_id" uuid NULL,
        "discharge_voucher_number" varchar(80) NOT NULL,
        "claim_assessment_number" varchar(80) NULL,
        "claim_reference_number" varchar(100) NULL,
        "cover_note_reference_number" varchar(100) NOT NULL,
        "discharge_voucher_date" timestamptz NOT NULL,
        "currency_code" varchar(10) NOT NULL,
        "exchange_rate" numeric(18, 6) NOT NULL DEFAULT 1,
        "claim_offer_communication_date" timestamptz NOT NULL,
        "claim_offer_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "claimant_response_date" timestamptz NULL,
        "offer_accepted" varchar(1) NOT NULL DEFAULT 'N',
        "signed_document_id" uuid NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid NULL,
        "submitted_by" uuid NULL,
        "submitted_at" timestamptz NULL,
        "approved_by" uuid NULL,
        "approved_at" timestamptz NULL,
        "rejected_by" uuid NULL,
        "rejected_at" timestamptz NULL,
        "rejection_reason" text NULL,
        "tiramis_submission_tracking_id" uuid NULL,
        "tiramis_status" varchar(50) NULL,
        "tiramis_transaction_id" varchar(100) NULL,
        "tiramis_request_id" varchar(100) NULL,
        "tiramis_service_type" varchar(80) NULL,
        "tiramis_root_element" varchar(100) NULL,
        "tiramis_acknowledgement_status_code" varchar(20) NULL,
        "tiramis_acknowledgement_status_desc" varchar(255) NULL,
        "tiramis_final_response_id" varchar(100) NULL,
        "tiramis_final_response_status_code" varchar(20) NULL,
        "tiramis_final_response_status_desc" varchar(255) NULL,
        "tiramis_last_error_message" text NULL,
        "tiramis_last_synced_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "sale_point_id" uuid NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "claimant_id" uuid NULL,
        "discharge_voucher_id" uuid NULL,
        "claim_payment_number" varchar(80) NOT NULL,
        "claim_reference_number" varchar(100) NULL,
        "claim_intimation_number" varchar(80) NULL,
        "cover_note_reference_number" varchar(100) NOT NULL,
        "payment_date" timestamptz NULL,
        "paid_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "payment_mode" int NOT NULL DEFAULT 1,
        "payment_method" varchar(100) NULL,
        "payment_reference" varchar(120) NULL,
        "parties_notified" varchar(1) NOT NULL DEFAULT 'N',
        "net_premium_earned" numeric(18, 2) NOT NULL DEFAULT 0,
        "claim_resulted_litigation" varchar(1) NOT NULL DEFAULT 'N',
        "litigation_reason" text NULL,
        "currency_code" varchar(10) NOT NULL,
        "exchange_rate" numeric(18, 6) NOT NULL DEFAULT 1,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid NULL,
        "submitted_by" uuid NULL,
        "submitted_at" timestamptz NULL,
        "approved_by" uuid NULL,
        "approved_at" timestamptz NULL,
        "paid_by" uuid NULL,
        "paid_at" timestamptz NULL,
        "rejection_reason" text NULL,
        "tiramis_submission_tracking_id" uuid NULL,
        "tiramis_status" varchar(50) NULL,
        "tiramis_transaction_id" varchar(100) NULL,
        "tiramis_request_id" varchar(100) NULL,
        "tiramis_service_type" varchar(80) NULL,
        "tiramis_root_element" varchar(100) NULL,
        "tiramis_acknowledgement_status_code" varchar(20) NULL,
        "tiramis_acknowledgement_status_desc" varchar(255) NULL,
        "tiramis_final_response_id" varchar(100) NULL,
        "tiramis_final_response_status_code" varchar(20) NULL,
        "tiramis_final_response_status_desc" varchar(255) NULL,
        "tiramis_last_error_message" text NULL,
        "tiramis_last_synced_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_rejections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "claim_rejection_number" varchar(80) NOT NULL,
        "claim_reference_number" varchar(100) NULL,
        "cover_note_reference_number" varchar(100) NOT NULL,
        "rejection_date" timestamptz NOT NULL,
        "rejection_reason" text NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'APPROVED',
        "created_by" uuid NULL,
        "approved_by" uuid NULL,
        "approved_at" timestamptz NULL,
        "tiramis_submission_tracking_id" uuid NULL,
        "tiramis_status" varchar(50) NULL,
        "tiramis_transaction_id" varchar(100) NULL,
        "tiramis_request_id" varchar(100) NULL,
        "tiramis_service_type" varchar(80) NULL,
        "tiramis_root_element" varchar(100) NULL,
        "tiramis_acknowledgement_status_code" varchar(20) NULL,
        "tiramis_acknowledgement_status_desc" varchar(255) NULL,
        "tiramis_final_response_id" varchar(100) NULL,
        "tiramis_final_response_status_code" varchar(20) NULL,
        "tiramis_final_response_status_desc" varchar(255) NULL,
        "tiramis_last_error_message" text NULL,
        "tiramis_last_synced_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_recoveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "recovery_no" varchar(80) NOT NULL,
        "recovery_type" varchar(40) NOT NULL,
        "expected_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "received_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'EXPECTED',
        "notes" text NULL,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_status_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "old_status" varchar(30) NULL,
        "new_status" varchar(30) NOT NULL,
        "reason" text NOT NULL,
        "changed_by" uuid NULL,
        "changed_at" timestamptz NOT NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_sla_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NULL,
        "event_type" varchar(80) NOT NULL,
        "duration_hours" int NOT NULL,
        "warning_hours_before" int NOT NULL DEFAULT 0,
        "effective_from" date NOT NULL,
        "effective_to" date NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_sla_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "claim_id" uuid NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
        "event_type" varchar(80) NOT NULL,
        "started_at" timestamptz NOT NULL,
        "due_at" timestamptz NOT NULL,
        "warning_at" timestamptz NULL,
        "completed_at" timestamptz NULL,
        "breached_at" timestamptz NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "rule_snapshot" jsonb NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "complaints" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "claim_id" uuid NULL,
        "policy_id" uuid NULL,
        "customer_id" uuid NOT NULL,
        "complaint_no" varchar(80) NOT NULL,
        "category" varchar(100) NOT NULL,
        "subject" varchar(180) NOT NULL,
        "description" text NOT NULL,
        "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "status" varchar(30) NOT NULL DEFAULT 'OPEN',
        "reported_channel" varchar(100) NOT NULL,
        "assigned_user_id" uuid NULL,
        "acknowledged_by" uuid NULL,
        "acknowledged_at" timestamptz NULL,
        "resolution" text NULL,
        "resolved_by" uuid NULL,
        "resolved_at" timestamptz NULL,
        "escalated_by" uuid NULL,
        "escalated_at" timestamptz NULL,
        "escalation_reason" text NULL,
        "closed_by" uuid NULL,
        "closed_at" timestamptz NULL,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "complaint_status_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "complaint_id" uuid NOT NULL REFERENCES "complaints"("id") ON DELETE CASCADE,
        "old_status" varchar(30) NULL,
        "new_status" varchar(30) NOT NULL,
        "reason" text NOT NULL,
        "changed_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_claims_company_status"
      ON "claims" ("company_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_claims_assigned_user"
      ON "claims" ("company_id", "assigned_user_id", "status")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_claims_assigned_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_claims_company_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaint_status_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "complaints"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_sla_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_sla_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_status_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_recoveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_rejections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_discharge_vouchers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_assessments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_service_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_intimations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_reserves"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_claimants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claims"`);
  }
}
