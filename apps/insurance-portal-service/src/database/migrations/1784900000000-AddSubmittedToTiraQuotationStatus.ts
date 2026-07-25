import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmittedToTiraQuotationStatus1784900000000 implements MigrationInterface {
  name = 'AddSubmittedToTiraQuotationStatus1784900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."quotation_status_enum" ADD VALUE IF NOT EXISTS 'SUBMITTED_TO_TIRA'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."quotation_status_enum" ADD VALUE IF NOT EXISTS 'COMPLETED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."quotation_status_enum" ADD VALUE IF NOT EXISTS 'FAILED'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enum values are not removed in a simple rollback.
  }
}
