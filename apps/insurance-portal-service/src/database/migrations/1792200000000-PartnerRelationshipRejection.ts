import { MigrationInterface, QueryRunner } from 'typeorm';

export class PartnerRelationshipRejection1792200000000 implements MigrationInterface {
  name = 'PartnerRelationshipRejection1792200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "insurance_company_partners_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "insurance_company_partners_status_enum" ADD VALUE IF NOT EXISTS 'WITHDRAWN'`,
    );
  }

  async down(): Promise<void> {
    // Keep enum labels on rollback: PostgreSQL cannot safely remove enum values.
  }
}
