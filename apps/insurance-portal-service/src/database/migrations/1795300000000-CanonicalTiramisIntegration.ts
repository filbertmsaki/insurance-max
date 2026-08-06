import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalTiramisIntegration1795300000000
  implements MigrationInterface
{
  name = 'CanonicalTiramisIntegration1795300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "schema_version"
      character varying(100)
      NOT NULL DEFAULT 'insurance-max.tiramis.submission.v1'
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "contract_version"
      character varying(20)
      NOT NULL DEFAULT '1.0'
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "workflow_revision"
      integer
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "correlation_id"
      uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "causation_id"
      uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "canonical_status"
      character varying(60)
      NOT NULL DEFAULT 'CREATED'
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "resource_version"
      integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "envelope"
      jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "payload_hash"
      character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "context_hash"
      character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "envelope_hash"
      character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "latest_event_sequence"
      integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "latest_event_id"
      uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "reconciliation_required"
      boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "reconciliation_reason"
      text
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "last_reconciled_at"
      TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_submission_tracking"
      ADD COLUMN IF NOT EXISTS "legacy_portal_submission_id"
      uuid
    `);

    await queryRunner.query(`
      UPDATE "tiramis_submission_tracking"
      SET
        "correlation_id" = COALESCE("correlation_id", uuid_generate_v4()),
        "canonical_status" = CASE "status"
          WHEN 'DRAFT' THEN 'CREATED'
          WHEN 'PENDING' THEN 'QUEUED'
          WHEN 'SUBMITTING' THEN 'QUEUED'
          WHEN 'SENT_TO_TIRAMIS_SERVICE' THEN 'ACCEPTED_BY_TIRAMIS_SERVICE'
          WHEN 'ACK_ACCEPTED' THEN 'ACK_ACCEPTED'
          WHEN 'ACKNOWLEDGED' THEN 'ACK_ACCEPTED'
          WHEN 'ACK_FAILED' THEN 'ACK_REJECTED'
          WHEN 'PENDING_FINAL' THEN 'WAITING_FINAL_RESPONSE'
          WHEN 'FINAL_SUCCESS' THEN 'FINAL_ACCEPTED'
          WHEN 'FINAL_FAILED' THEN 'FINAL_REJECTED'
          WHEN 'RETRY_PENDING' THEN 'TRANSPORT_RETRY_SCHEDULED'
          WHEN 'RETRYING' THEN 'TRANSPORT_RETRYING'
          WHEN 'RETRY_EXHAUSTED' THEN 'RETRY_EXHAUSTED'
          WHEN 'CALLBACK_OVERDUE' THEN 'CALLBACK_OVERDUE'
          WHEN 'FAILED' THEN 'TRANSPORT_FAILED'
          ELSE 'RECONCILIATION_REQUIRED'
        END
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tiramis_tracking_idempotency"
      ON "tiramis_submission_tracking" (
        "source_company_id",
        "request_type",
        "idempotency_key"
      )
      WHERE
        "idempotency_key" IS NOT NULL
        AND "deleted_at" IS NULL
        AND "duplicate_of_tracking_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_canonical_status"
      ON "tiramis_submission_tracking" ("canonical_status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_tracking_canonical_status"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_tiramis_tracking_idempotency"
    `);
  }
}
