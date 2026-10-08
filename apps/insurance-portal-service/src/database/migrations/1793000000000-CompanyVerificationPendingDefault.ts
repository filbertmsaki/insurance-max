import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyVerificationPendingDefault1793000000000 implements MigrationInterface {
  name = 'CompanyVerificationPendingDefault1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ALTER COLUMN "verification_status" SET DEFAULT 'PENDING_REVIEW'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ALTER COLUMN "verification_status" SET DEFAULT 'VERIFIED'`,
    );
  }
}
