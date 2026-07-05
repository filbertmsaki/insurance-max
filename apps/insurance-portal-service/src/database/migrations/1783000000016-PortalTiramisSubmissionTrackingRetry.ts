import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisSubmissionTrackingRetry1783000000016
  implements MigrationInterface
{
  name = 'PortalTiramisSubmissionTrackingRetry1783000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "is_retryable" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "retry_attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "max_retry_attempts" integer NOT NULL DEFAULT 5`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "last_retry_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "retry_lock_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "retry_locked_at" TIMESTAMP WITH TIME ZONE`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_retry_lock_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_next_retry_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_is_retryable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "retry_locked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "retry_lock_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "last_retry_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "next_retry_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "max_retry_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "retry_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "is_retryable"`,
    );
  }
}
