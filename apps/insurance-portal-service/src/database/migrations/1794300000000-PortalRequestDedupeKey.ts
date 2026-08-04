import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalRequestDedupeKey1794300000000
  implements MigrationInterface
{
  name = 'PortalRequestDedupeKey1794300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "portal_service_requests"
      ADD COLUMN "active_dedupe_key" varchar(250)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_portal_request_active_dedupe"
      ON "portal_service_requests" ("active_dedupe_key")
      WHERE
        "deleted_at" IS NULL
        AND "status" IN (
          'DRAFT', 'SUBMITTED', 'IN_REVIEW',
          'ADDITIONAL_INFO_REQUIRED', 'APPROVED'
        )
        AND "active_dedupe_key" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_portal_request_active_dedupe"`,
    );
    await queryRunner.query(`
      ALTER TABLE "portal_service_requests"
      DROP COLUMN "active_dedupe_key"
    `);
  }
}
