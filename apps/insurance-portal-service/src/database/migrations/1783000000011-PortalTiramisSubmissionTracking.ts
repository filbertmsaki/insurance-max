import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisSubmissionTracking1783000000011 implements MigrationInterface {
  name = 'PortalTiramisSubmissionTracking1783000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "tiramis_submission_tracking" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "request_type" character varying(80) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'PENDING', "source_service" character varying(100) NOT NULL DEFAULT 'insurance-portal-service', "source_company_id" uuid, "source_user_id" uuid, "source_module" character varying(100), "source_record_id" character varying(150), "policy_id" character varying(150), "quotation_id" character varying(150), "business_reference" character varying(150), "business_fingerprint" character varying(255), "idempotency_key" character varying(255), "duplicate_of_tracking_id" uuid, "duplicate_prevention_reason" text, "duplicate_checked_at" TIMESTAMP WITH TIME ZONE, "resubmission_count" integer NOT NULL DEFAULT 0, "force_resubmitted" boolean NOT NULL DEFAULT false, "force_resubmit" boolean NOT NULL DEFAULT false, "return_existing" boolean NOT NULL DEFAULT false, "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "acknowledgement_status_code" character varying(20), "acknowledgement_status_desc" character varying(255), "last_error_message" text, "request_payload" jsonb, "tiramis_response_payload" jsonb, "submitted_at" TIMESTAMP WITH TIME ZONE, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "final_response_id" character varying(100), "final_response_status_code" character varying(20), "final_response_status_desc" character varying(255), "final_response_received_at" TIMESTAMP WITH TIME ZONE, "final_response_payload" jsonb, "last_synced_at" TIMESTAMP WITH TIME ZONE, "sync_attempts" integer NOT NULL DEFAULT 0, "business_record_synced_at" TIMESTAMP WITH TIME ZONE, "business_record_sync_error" text, "business_record_sync_attempts" integer NOT NULL DEFAULT 0, "is_retryable" boolean NOT NULL DEFAULT false, "retry_attempts" integer NOT NULL DEFAULT 0, "max_retry_attempts" integer NOT NULL DEFAULT 3, "next_retry_at" TIMESTAMP WITH TIME ZONE, "last_retry_at" TIMESTAMP WITH TIME ZONE, "retry_lock_id" character varying(120), "retry_locked_at" TIMESTAMP WITH TIME ZONE, "retry_error_message" text, "retry_strategy" character varying(40) DEFAULT 'EXPONENTIAL_BACKOFF', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_tiramis_submission_tracking" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_request_type" ON "tiramis_submission_tracking" ("request_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_business_reference" ON "tiramis_submission_tracking" ("business_reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_business_fingerprint" ON "tiramis_submission_tracking" ("business_fingerprint")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_source_company_id" ON "tiramis_submission_tracking" ("source_company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_source_record_id" ON "tiramis_submission_tracking" ("source_record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_transaction_id" ON "tiramis_submission_tracking" ("tiramis_transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_request_id" ON "tiramis_submission_tracking" ("tiramis_request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_status" ON "tiramis_submission_tracking" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_idempotency_key" ON "tiramis_submission_tracking" ("idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_duplicate_of_tracking_id" ON "tiramis_submission_tracking" ("duplicate_of_tracking_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_is_retryable" ON "tiramis_submission_tracking" ("is_retryable")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_next_retry_at" ON "tiramis_submission_tracking" ("next_retry_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_retry_lock_id" ON "tiramis_submission_tracking" ("retry_lock_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_final_response_id" ON "tiramis_submission_tracking" ("final_response_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_last_synced_at" ON "tiramis_submission_tracking" ("last_synced_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_business_record_synced_at" ON "tiramis_submission_tracking" ("business_record_synced_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_request_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_transaction_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_source_record_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_source_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_business_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_request_type"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tiramis_submission_tracking"`,
    );
  }
}
