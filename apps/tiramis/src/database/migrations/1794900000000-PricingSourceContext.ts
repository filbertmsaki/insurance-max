import { MigrationInterface, QueryRunner } from 'typeorm';

export class PricingSourceContext1794900000000 implements MigrationInterface {
  name = 'PricingSourceContext1794900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_pricing_quote_id"
      character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_rate_book_id"
      character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_rate_book_code"
      character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_rate_book_version"
      character varying(30)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_rate_book_definition_hash"
      character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_rating_rule_id"
      character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_rating_rule_code"
      character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_rating_rule_version"
      integer
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_pricing_input_hash"
      character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_pricing_result_hash"
      character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_calculation_version"
      character varying(30)
    `);

    await queryRunner.query(`
      CREATE INDEX
      "IDX_tiramis_source_pricing_quote"
      ON "tiramis_transactions" (
        "source_pricing_quote_id"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
      "IDX_tiramis_source_rate_book"
      ON "tiramis_transactions" (
        "source_rate_book_id"
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_tiramis_source_rate_book"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_tiramis_source_pricing_quote"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      DROP COLUMN IF EXISTS
        "source_calculation_version",
      DROP COLUMN IF EXISTS
        "source_pricing_result_hash",
      DROP COLUMN IF EXISTS
        "source_pricing_input_hash",
      DROP COLUMN IF EXISTS
        "source_rating_rule_version",
      DROP COLUMN IF EXISTS
        "source_rating_rule_code",
      DROP COLUMN IF EXISTS
        "source_rating_rule_id",
      DROP COLUMN IF EXISTS
        "source_rate_book_definition_hash",
      DROP COLUMN IF EXISTS
        "source_rate_book_version",
      DROP COLUMN IF EXISTS
        "source_rate_book_code",
      DROP COLUMN IF EXISTS
        "source_rate_book_id",
      DROP COLUMN IF EXISTS
        "source_pricing_quote_id"
    `);
  }
}
