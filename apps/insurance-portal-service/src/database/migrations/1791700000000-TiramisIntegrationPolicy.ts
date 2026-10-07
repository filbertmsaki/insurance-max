import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisIntegrationPolicy1791700000000 implements MigrationInterface {
  name = 'TiramisIntegrationPolicy1791700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" ADD COLUMN IF NOT EXISTS "notification_events" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" ADD COLUMN IF NOT EXISTS "integration_permissions" jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" DROP COLUMN IF EXISTS "integration_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" DROP COLUMN IF EXISTS "notification_events"`,
    );
  }
}
