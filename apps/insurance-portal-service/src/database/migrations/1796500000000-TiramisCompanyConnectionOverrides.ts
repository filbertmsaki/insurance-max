import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisCompanyConnectionOverrides1796500000000 implements MigrationInterface {
  name = 'TiramisCompanyConnectionOverrides1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD COLUMN IF NOT EXISTS "source_service" character varying(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      DROP COLUMN IF EXISTS "source_service"
    `);
  }
}
