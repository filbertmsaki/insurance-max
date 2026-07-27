import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2PricingStandards1785100000000
  implements MigrationInterface
{
  name = 'Phase2PricingStandards1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "risk_rating_rules"
      SET "percentage_rate" = "percentage_rate" / 100
      WHERE "percentage_rate" IS NOT NULL AND "percentage_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "product_tax_rules"
      SET "tax_rate" = "tax_rate" / 100
      WHERE "tax_rate" IS NOT NULL AND "tax_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "product_commission_rules"
      SET "commission_rate" = "commission_rate" / 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "insurance_company_partners"
      SET "commission_rate" = "commission_rate" / 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "commission_transactions"
      SET "commission_rate" = "commission_rate" / 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_cover_notes"
      SET "commission_rate" = "commission_rate" / 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_entry_risks"
      SET "premium_rate" = "premium_rate" / 100
      WHERE "premium_rate" IS NOT NULL AND "premium_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_risk_discounts"
      SET "discount_rate" = "discount_rate" / 100
      WHERE "discount_rate" IS NOT NULL AND "discount_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_risk_taxes"
      SET "tax_rate" = "tax_rate" / 100
      WHERE "tax_rate" IS NOT NULL AND "tax_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_entry_addons"
      SET "addon_premium_rate" = "addon_premium_rate" / 100
      WHERE "addon_premium_rate" IS NOT NULL AND "addon_premium_rate" > 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_entry_addon_taxes"
      SET "tax_rate" = "tax_rate" / 100
      WHERE "tax_rate" IS NOT NULL AND "tax_rate" > 1
    `);

    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ALTER COLUMN "percentage_rate" TYPE numeric(18,10),
      ALTER COLUMN "fixed_amount" TYPE numeric(20,4),
      ALTER COLUMN "per_unit_amount" TYPE numeric(20,4),
      ALTER COLUMN "minimum_amount" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "risk_rating_rules"."percentage_rate"
      IS 'Rate as a decimal fraction (e.g. 0.035 means 3.5%)'
    `);

    await queryRunner.query(`
      ALTER TABLE "product_tax_rules"
      ALTER COLUMN "tax_rate" TYPE numeric(18,10),
      ALTER COLUMN "tax_amount" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "product_commission_rules"
      ALTER COLUMN "commission_rate" TYPE numeric(18,10),
      ALTER COLUMN "commission_amount" TYPE numeric(20,4),
      ALTER COLUMN "minimum_commission" TYPE numeric(20,4),
      ALTER COLUMN "maximum_commission" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partners"
      ALTER COLUMN "commission_rate" TYPE numeric(18,10)
    `);
    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      ALTER COLUMN "gross_premium" TYPE numeric(20,4),
      ALTER COLUMN "net_premium" TYPE numeric(20,4),
      ALTER COLUMN "commission_rate" TYPE numeric(18,10),
      ALTER COLUMN "commission_amount" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_cover_notes"
      ALTER COLUMN "exchange_rate" TYPE numeric(18,10),
      ALTER COLUMN "total_premium_excluding_tax" TYPE numeric(20,4),
      ALTER COLUMN "total_premium_including_tax" TYPE numeric(20,4),
      ALTER COLUMN "commission_paid" TYPE numeric(20,4),
      ALTER COLUMN "commission_rate" TYPE numeric(18,10)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      ALTER COLUMN "sum_insured" TYPE numeric(20,4),
      ALTER COLUMN "sum_insured_equivalent" TYPE numeric(20,4),
      ALTER COLUMN "premium_rate" TYPE numeric(18,10),
      ALTER COLUMN "premium_before_discount" TYPE numeric(20,4),
      ALTER COLUMN "premium_after_discount" TYPE numeric(20,4),
      ALTER COLUMN "premium_excluding_tax_equivalent" TYPE numeric(20,4),
      ALTER COLUMN "premium_including_tax" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risk_discounts"
      ALTER COLUMN "discount_rate" TYPE numeric(18,10),
      ALTER COLUMN "discount_amount" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risk_taxes"
      ALTER COLUMN "tax_rate" TYPE numeric(18,10),
      ALTER COLUMN "tax_amount" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_addons"
      ALTER COLUMN "addon_amount" TYPE numeric(20,4),
      ALTER COLUMN "addon_premium_rate" TYPE numeric(18,10),
      ALTER COLUMN "premium_excluding_tax" TYPE numeric(20,4),
      ALTER COLUMN "premium_excluding_tax_equivalent" TYPE numeric(20,4),
      ALTER COLUMN "premium_including_tax" TYPE numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_addon_taxes"
      ALTER COLUMN "tax_rate" TYPE numeric(18,10),
      ALTER COLUMN "tax_amount" TYPE numeric(20,4)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_addon_taxes"
      ALTER COLUMN "tax_rate" TYPE numeric(18,6),
      ALTER COLUMN "tax_amount" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_addons"
      ALTER COLUMN "addon_amount" TYPE numeric(18,2),
      ALTER COLUMN "addon_premium_rate" TYPE numeric(18,6),
      ALTER COLUMN "premium_excluding_tax" TYPE numeric(18,2),
      ALTER COLUMN "premium_excluding_tax_equivalent" TYPE numeric(18,2),
      ALTER COLUMN "premium_including_tax" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risk_taxes"
      ALTER COLUMN "tax_rate" TYPE numeric(18,6),
      ALTER COLUMN "tax_amount" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risk_discounts"
      ALTER COLUMN "discount_rate" TYPE numeric(18,6),
      ALTER COLUMN "discount_amount" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      ALTER COLUMN "sum_insured" TYPE numeric(18,2),
      ALTER COLUMN "sum_insured_equivalent" TYPE numeric(18,2),
      ALTER COLUMN "premium_rate" TYPE numeric(18,6),
      ALTER COLUMN "premium_before_discount" TYPE numeric(18,2),
      ALTER COLUMN "premium_after_discount" TYPE numeric(18,2),
      ALTER COLUMN "premium_excluding_tax_equivalent" TYPE numeric(18,2),
      ALTER COLUMN "premium_including_tax" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_cover_notes"
      ALTER COLUMN "exchange_rate" TYPE numeric(18,6),
      ALTER COLUMN "total_premium_excluding_tax" TYPE numeric(18,2),
      ALTER COLUMN "total_premium_including_tax" TYPE numeric(18,2),
      ALTER COLUMN "commission_paid" TYPE numeric(18,2),
      ALTER COLUMN "commission_rate" TYPE numeric(18,6)
    `);
    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      ALTER COLUMN "gross_premium" TYPE numeric(18,2),
      ALTER COLUMN "net_premium" TYPE numeric(18,2),
      ALTER COLUMN "commission_rate" TYPE numeric(18,6),
      ALTER COLUMN "commission_amount" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partners"
      ALTER COLUMN "commission_rate" TYPE numeric(5,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "product_commission_rules"
      ALTER COLUMN "commission_rate" TYPE numeric(18,6),
      ALTER COLUMN "commission_amount" TYPE numeric(18,2),
      ALTER COLUMN "minimum_commission" TYPE numeric(18,2),
      ALTER COLUMN "maximum_commission" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "product_tax_rules"
      ALTER COLUMN "tax_rate" TYPE numeric(18,6),
      ALTER COLUMN "tax_amount" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ALTER COLUMN "percentage_rate" TYPE numeric(18,6),
      ALTER COLUMN "fixed_amount" TYPE numeric(18,2),
      ALTER COLUMN "per_unit_amount" TYPE numeric(18,6),
      ALTER COLUMN "minimum_amount" TYPE numeric(18,2)
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "risk_rating_rules"."percentage_rate"
      IS 'Rate as percentage (e.g. 3.5 means 3.5%)'
    `);

    await queryRunner.query(`
      UPDATE "quotation_entry_addon_taxes"
      SET "tax_rate" = "tax_rate" * 100
      WHERE "tax_rate" IS NOT NULL AND "tax_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_entry_addons"
      SET "addon_premium_rate" = "addon_premium_rate" * 100
      WHERE "addon_premium_rate" IS NOT NULL AND "addon_premium_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_risk_taxes"
      SET "tax_rate" = "tax_rate" * 100
      WHERE "tax_rate" IS NOT NULL AND "tax_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_risk_discounts"
      SET "discount_rate" = "discount_rate" * 100
      WHERE "discount_rate" IS NOT NULL AND "discount_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_entry_risks"
      SET "premium_rate" = "premium_rate" * 100
      WHERE "premium_rate" IS NOT NULL AND "premium_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "quotation_cover_notes"
      SET "commission_rate" = "commission_rate" * 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "commission_transactions"
      SET "commission_rate" = "commission_rate" * 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "insurance_company_partners"
      SET "commission_rate" = "commission_rate" * 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "product_commission_rules"
      SET "commission_rate" = "commission_rate" * 100
      WHERE "commission_rate" IS NOT NULL AND "commission_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "product_tax_rules"
      SET "tax_rate" = "tax_rate" * 100
      WHERE "tax_rate" IS NOT NULL AND "tax_rate" <= 1
    `);
    await queryRunner.query(`
      UPDATE "risk_rating_rules"
      SET "percentage_rate" = "percentage_rate" * 100
      WHERE "percentage_rate" IS NOT NULL AND "percentage_rate" <= 1
    `);
  }
}
