import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisSubmissionTrackingDashboardIndexes1783000000017 implements MigrationInterface {
  name = 'PortalTiramisSubmissionTrackingDashboardIndexes1783000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_created_at" ON "tiramis_submission_tracking" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_updated_at" ON "tiramis_submission_tracking" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_source_module" ON "tiramis_submission_tracking" ("source_module")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_final_status_code" ON "tiramis_submission_tracking" ("final_response_status_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_company_status" ON "tiramis_submission_tracking" ("source_company_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_request_type_status" ON "tiramis_submission_tracking" ("request_type", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_business_reference_search" ON "tiramis_submission_tracking" ("business_reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_business_fingerprint_search" ON "tiramis_submission_tracking" ("business_fingerprint")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_tracking_source_record_search" ON "tiramis_submission_tracking" ("source_record_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_source_record_search"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_business_reference_search"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_business_fingerprint_search"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_request_type_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_final_status_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_source_module"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_updated_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_tracking_created_at"`,
    );
  }
}
