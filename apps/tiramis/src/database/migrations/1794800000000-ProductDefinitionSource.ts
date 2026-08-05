import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductDefinitionSource1794800000000 implements MigrationInterface {
  name = 'ProductDefinitionSource1794800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_product_id"
      character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_product_version_id"
      character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_product_version_number"
      integer
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_product_code"
      character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_tiramis_product_code"
      character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_product_definition_hash"
      character varying(64)
    `);

    await queryRunner.query(`
      CREATE INDEX
      "IDX_tiramis_transaction_product_version"
      ON "tiramis_transactions" (
        "source_product_version_id"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX
      "IDX_tiramis_transaction_definition_hash"
      ON "tiramis_transactions" (
        "source_product_definition_hash"
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_tiramis_transaction_definition_hash"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_tiramis_transaction_product_version"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      DROP COLUMN IF EXISTS
        "source_product_definition_hash",
      DROP COLUMN IF EXISTS
        "source_tiramis_product_code",
      DROP COLUMN IF EXISTS
        "source_product_code",
      DROP COLUMN IF EXISTS
        "source_product_version_number",
      DROP COLUMN IF EXISTS
        "source_product_version_id",
      DROP COLUMN IF EXISTS
        "source_product_id"
    `);
  }
}
