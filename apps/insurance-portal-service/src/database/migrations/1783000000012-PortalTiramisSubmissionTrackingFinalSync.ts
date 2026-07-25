import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisSubmissionTrackingFinalSync1783000000012 implements MigrationInterface {
  name = 'PortalTiramisSubmissionTrackingFinalSync1783000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "final_response_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "final_response_status_code" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "final_response_status_desc" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "final_response_received_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "final_response_payload" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "sync_attempts" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_final_response_id" ON "tiramis_submission_tracking" ("final_response_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_last_synced_at" ON "tiramis_submission_tracking" ("last_synced_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_last_synced_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_final_response_id"`,
    );
  }
}
