import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllowExpiredCertificatesToTiramisCompanyConfigurations1787605200000 implements MigrationInterface {
  name =
    'AddAllowExpiredCertificatesToTiramisCompanyConfigurations1787605200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      ADD COLUMN IF NOT EXISTS "allow_expired_certificates" boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_company_configurations"
      DROP COLUMN IF EXISTS "allow_expired_certificates"
    `);
  }
}
