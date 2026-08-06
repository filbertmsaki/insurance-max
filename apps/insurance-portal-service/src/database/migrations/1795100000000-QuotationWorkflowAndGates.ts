import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuotationWorkflowAndGates1795100000000 implements MigrationInterface {
  name = 'QuotationWorkflowAndGates1795100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "quotation_stage" character varying(40) NOT NULL DEFAULT 'DRAFT',
      ADD COLUMN IF NOT EXISTS "approval_status_v2" character varying(40) NOT NULL DEFAULT 'NOT_REQUIRED',
      ADD COLUMN IF NOT EXISTS "payment_status_v2" character varying(40) NOT NULL DEFAULT 'NOT_REQUIRED',
      ADD COLUMN IF NOT EXISTS "submission_status_v2" character varying(40) NOT NULL DEFAULT 'NOT_READY',
      ADD COLUMN IF NOT EXISTS "workflow_revision" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "finalization_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "finalization_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "workflow_gate_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "workflow_completed_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE "quotations"
      SET
        "quotation_stage" = CASE
          WHEN "quotation_status" = 'CANCELLED' THEN 'CANCELLED'
          WHEN "quotation_status" = 'EXPIRED' THEN 'EXPIRED'
          WHEN "quotation_status" IN ('SUBMITTING_TO_TIRA', 'TIRA_PROCESSING')
            OR "tira_status" IN ('SUBMITTING', 'PROCESSING')
            THEN 'SUBMISSION_PROCESSING'
          WHEN "quotation_status" = 'SUBMITTED_TO_TIRA'
            OR "tira_status" IN ('SUBMITTED', 'SUCCESS')
            THEN 'SUBMITTED'
          WHEN "quotation_status" = 'READY_FOR_SUBMISSION'
            THEN 'COMPLETED'
          ELSE 'DRAFT'
        END,
        "approval_status_v2" = CASE
          WHEN COALESCE("requires_approval", false) = false THEN 'NOT_REQUIRED'
          WHEN "approval_status" = 'NOT_SUBMITTED' THEN 'NOT_EVALUATED'
          WHEN "approval_status" = 'PENDING' THEN 'PENDING'
          WHEN "approval_status" = 'APPROVED' THEN 'APPROVED'
          WHEN "approval_status" = 'CHANGES_REQUESTED' THEN 'CHANGES_REQUESTED'
          WHEN "approval_status" = 'REJECTED' THEN 'REJECTED'
          WHEN "approval_status" = 'CANCELLED' THEN 'CANCELLED'
          ELSE 'NOT_EVALUATED'
        END,
        "payment_status_v2" = CASE
          WHEN COALESCE("requires_payment", false) = false THEN 'NOT_REQUIRED'
          WHEN "payment_status" = 'NOT_INITIATED' THEN 'NOT_REQUESTED'
          WHEN "payment_status" = 'REQUESTED' THEN 'REQUESTED'
          WHEN "payment_status" = 'PROCESSING' THEN 'PROCESSING'
          WHEN "payment_status" = 'PARTIALLY_PAID' THEN 'PARTIAL'
          WHEN "payment_status" = 'PAID' THEN 'PAID'
          WHEN "payment_status" IN ('FAILED', 'EXPIRED') THEN 'FAILED'
          WHEN "payment_status" = 'REFUNDED' THEN 'REFUNDED'
          WHEN "payment_status" = 'CANCELLED' THEN 'CANCELLED'
          ELSE 'NOT_REQUESTED'
        END,
        "submission_status_v2" = CASE
          WHEN "tira_status" IN ('SUBMITTING', 'PROCESSING') THEN 'PROCESSING'
          WHEN "tira_status" = 'SUBMITTED' THEN 'ACKNOWLEDGED'
          WHEN "tira_status" = 'SUCCESS' THEN 'ACCEPTED'
          WHEN "tira_status" = 'REJECTED' THEN 'REJECTED'
          WHEN "tira_status" = 'FAILED' THEN 'FAILED'
          WHEN "quotation_status" = 'READY_FOR_SUBMISSION' THEN 'READY'
          ELSE 'NOT_READY'
        END,
        "workflow_completed_at" = CASE
          WHEN "quotation_status" IN ('READY_FOR_SUBMISSION', 'SUBMITTING_TO_TIRA', 'SUBMITTED_TO_TIRA', 'TIRA_PROCESSING', 'COMPLETED')
            OR "tira_status" IN ('SUBMITTING', 'SUBMITTED', 'PROCESSING', 'SUCCESS')
            THEN COALESCE("workflow_completed_at", "submitted_at", "updated_at", "created_at")
          ELSE NULL
        END
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_stage_v2"
      ON "quotations" ("company_id", "quotation_stage")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_approval_status_v2"
      ON "quotations" ("company_id", "approval_status_v2")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_payment_status_v2"
      ON "quotations" ("company_id", "payment_status_v2")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_submission_status_v2"
      ON "quotations" ("company_id", "submission_status_v2")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_finalization_hash"
      ON "quotations" ("finalization_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_workflow_gate_hash"
      ON "quotations" ("workflow_gate_hash")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_workflow_gate_hash"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_finalization_hash"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_company_submission_status_v2"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_company_payment_status_v2"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_company_approval_status_v2"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_company_stage_v2"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "workflow_completed_at",
      DROP COLUMN IF EXISTS "workflow_gate_hash",
      DROP COLUMN IF EXISTS "finalization_hash",
      DROP COLUMN IF EXISTS "finalization_snapshot",
      DROP COLUMN IF EXISTS "state_version",
      DROP COLUMN IF EXISTS "workflow_revision",
      DROP COLUMN IF EXISTS "submission_status_v2",
      DROP COLUMN IF EXISTS "payment_status_v2",
      DROP COLUMN IF EXISTS "approval_status_v2",
      DROP COLUMN IF EXISTS "quotation_stage"
    `);
  }
}
