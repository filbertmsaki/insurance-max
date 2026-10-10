import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records the TIRAMIS environment each submission was sent to, so status sync
 * and retries stay on it after the active environment changes. Existing rows
 * are backfilled from their company's current environment (the only record
 * available), defaulting to test.
 */
export class TiramisTrackingEnvironment1793300000000 implements MigrationInterface {
  name = 'TiramisTrackingEnvironment1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD "tiramis_environment" character varying(10)`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_submission_tracking" t
          SET "tiramis_environment" = CASE
                WHEN c."settings"->>'tiramis_target_environment' = 'live' THEN 'live'
                ELSE 'test'
              END
         FROM "companies" c
        WHERE c."id" = t."source_company_id"`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_submission_tracking"
          SET "tiramis_environment" = 'test'
        WHERE "tiramis_environment" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN "tiramis_environment"`,
    );
  }
}
