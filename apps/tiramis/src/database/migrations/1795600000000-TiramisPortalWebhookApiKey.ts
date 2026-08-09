import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisPortalWebhookApiKey1795600000000 implements MigrationInterface {
  name = 'TiramisPortalWebhookApiKey1795600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_client_configurations"
      ADD COLUMN IF NOT EXISTS "portal_webhook_api_key_encrypted" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_client_configurations"
      DROP COLUMN IF EXISTS "portal_webhook_api_key_encrypted"
    `);
  }
}
