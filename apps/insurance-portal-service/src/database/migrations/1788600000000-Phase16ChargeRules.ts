import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase16ChargeRules1788600000000 implements MigrationInterface {
  name = 'Phase16ChargeRules1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."product_charge_category_enum" AS ENUM(
        'TAX',
        'LEVY',
        'FEE',
        'POLICY_FEE',
        'STAMP_DUTY',
        'ADMINISTRATION_FEE',
        'PRODUCT_CHARGE',
        'RISK_CHARGE'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "product_tax_rules"
      ADD COLUMN "charge_category" "public"."product_charge_category_enum" NOT NULL DEFAULT 'TAX',
      ADD COLUMN "is_taxable" boolean NOT NULL DEFAULT false,
      ADD COLUMN "minimum_charge_amount" numeric(20,4),
      ADD COLUMN "maximum_charge_amount" numeric(20,4)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_tax_rules"
      DROP COLUMN "maximum_charge_amount",
      DROP COLUMN "minimum_charge_amount",
      DROP COLUMN "is_taxable",
      DROP COLUMN "charge_category"
    `);
    await queryRunner.query(
      `DROP TYPE "public"."product_charge_category_enum"`,
    );
  }
}
