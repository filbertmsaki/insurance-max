import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisApiKeyTenantContext1795800000000 implements MigrationInterface {
  name = 'TiramisApiKeyTenantContext1795800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      ADD COLUMN IF NOT EXISTS "tenant_company_code" varchar(50)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      ADD COLUMN IF NOT EXISTS "tenant_system_code" varchar(80)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      ADD COLUMN IF NOT EXISTS "tenant_environment" varchar(20)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      DROP COLUMN IF EXISTS "tenant_environment"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      DROP COLUMN IF EXISTS "tenant_system_code"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      DROP COLUMN IF EXISTS "tenant_company_code"
    `);
  }
}
