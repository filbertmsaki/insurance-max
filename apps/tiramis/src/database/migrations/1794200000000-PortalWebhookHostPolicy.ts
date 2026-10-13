import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalWebhookHostPolicy1794200000000 implements MigrationInterface {
  name = 'PortalWebhookHostPolicy1794200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_system_profiles" ADD COLUMN IF NOT EXISTS "portal_webhook_allowed_hosts" jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_system_profiles" DROP COLUMN IF EXISTS "portal_webhook_allowed_hosts"`,
    );
  }
}
