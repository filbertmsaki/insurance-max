import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimPaymentFieldsToTiramisClaims1783194327688 implements MigrationInterface {
  name = 'AddClaimPaymentFieldsToTiramisClaims1783194327688';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "discharge_voucher_number" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_payment_number" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "payment_date" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "payment_mode" varchar(1) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "parties_notified" varchar(1) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "net_premium_earned" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_resulted_litigation" varchar(1) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "litigation_reason" text NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_discharge_voucher_number" ON "tiramis_claims" ("discharge_voucher_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_claim_payment_number" ON "tiramis_claims" ("claim_payment_number")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_claim_payment_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_discharge_voucher_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "litigation_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_resulted_litigation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "net_premium_earned"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "parties_notified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "payment_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "paid_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "payment_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_payment_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "discharge_voucher_number"`,
    );
  }
}
