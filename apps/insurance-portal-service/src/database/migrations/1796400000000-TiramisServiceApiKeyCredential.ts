import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisServiceApiKeyCredential1796400000000 implements MigrationInterface {
  name = 'TiramisServiceApiKeyCredential1796400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD COLUMN IF NOT EXISTS "service_api_key_encrypted" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      DROP COLUMN IF EXISTS "service_api_key_encrypted"
    `);
  }
}
