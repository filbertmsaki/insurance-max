import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisSubmissionTrackingIdempotency1783000000015 implements MigrationInterface {
  name = 'PortalTiramisSubmissionTrackingIdempotency1783000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "idempotency_key" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "duplicate_of_tracking_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "resubmission_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "force_resubmitted" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_idempotency_key" ON "tiramis_submission_tracking" ("idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_duplicate_of_tracking_id" ON "tiramis_submission_tracking" ("duplicate_of_tracking_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_tiramis_active_submission_idempotency" ON "tiramis_submission_tracking" ("idempotency_key") WHERE "deleted_at" IS NULL AND "idempotency_key" IS NOT NULL AND "status" IN ('PENDING', 'SENT_TO_TIRAMIS_SERVICE', 'ACKNOWLEDGED', 'FINAL_SUCCESS')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_tiramis_active_submission_idempotency"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_duplicate_of_tracking_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "force_resubmitted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "resubmission_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "duplicate_of_tracking_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "idempotency_key"`,
    );
  }
}
