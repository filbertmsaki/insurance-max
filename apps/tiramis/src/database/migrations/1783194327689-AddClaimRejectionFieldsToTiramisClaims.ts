import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimRejectionFieldsToTiramisClaims1783194327689 implements MigrationInterface {
  name = 'AddClaimRejectionFieldsToTiramisClaims1783194327689';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_rejection_number" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "rejection_date" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "rejection_reason" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_amount" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_claim_rejection_number" ON "tiramis_claims" ("claim_rejection_number")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_claim_rejection_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "rejection_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "rejection_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_rejection_number"`,
    );
  }
}
