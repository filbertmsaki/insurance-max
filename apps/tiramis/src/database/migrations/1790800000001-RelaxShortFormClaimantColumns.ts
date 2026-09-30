import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Assessment, discharge-voucher, payment and rejection messages carry only
 * ClaimantCategory/Type/IdNumber/IdType (TIRAMIS v1.3 §11–14), so the
 * name/address columns cannot be mandatory for those claimant rows.
 */
export class RelaxShortFormClaimantColumns1790800000001 implements MigrationInterface {
  name = 'RelaxShortFormClaimantColumns1790800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_claimants"
        ALTER COLUMN "claimant_name" DROP NOT NULL,
        ALTER COLUMN "country_code" DROP NOT NULL,
        ALTER COLUMN "region" DROP NOT NULL,
        ALTER COLUMN "district" DROP NOT NULL,
        ALTER COLUMN "claimant_phone_number" DROP NOT NULL`,
    );
  }

  public async down(): Promise<void> {
    // Restoring NOT NULL would fail for short-form claimant rows already
    // stored; the relaxation is intentionally irreversible.
  }
}
