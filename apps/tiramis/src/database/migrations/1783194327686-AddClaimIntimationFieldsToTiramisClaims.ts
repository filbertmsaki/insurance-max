import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimIntimationFieldsToTiramisClaims1783194327686 implements MigrationInterface {
  name = 'AddClaimIntimationFieldsToTiramisClaims1783194327686';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_intimation_number" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_intimation_date" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "currency_code" varchar(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_estimated_amount" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_reserve_amount" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_reserve_method" varchar(150) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "loss_assessment_option" int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "assessor_name" varchar(150) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "assessor_id_number" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "assessor_id_type" int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claimants" jsonb NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_claim_intimation_number" ON "tiramis_claims" ("claim_intimation_number")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_claim_intimation_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claimants"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "assessor_id_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "assessor_id_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "assessor_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "loss_assessment_option"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_reserve_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_reserve_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_estimated_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "exchange_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "currency_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_intimation_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_intimation_number"`,
    );
  }
}
