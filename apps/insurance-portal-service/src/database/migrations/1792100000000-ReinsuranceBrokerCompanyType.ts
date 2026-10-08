import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReinsuranceBrokerCompanyType1792100000000 implements MigrationInterface {
  name = 'ReinsuranceBrokerCompanyType1792100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "companies_company_type_enum" ADD VALUE IF NOT EXISTS 'REINSURANCE_BROKER'`,
    );
    await queryRunner.query(
      `ALTER TYPE "insurance_company_partners_partner_type_enum" ADD VALUE IF NOT EXISTS 'REINSURANCE_BROKER'`,
    );
  }

  async down(): Promise<void> {
    // PostgreSQL does not support removing enum values safely. Keep the value
    // available on rollback; no rows or application data are deleted.
  }
}
