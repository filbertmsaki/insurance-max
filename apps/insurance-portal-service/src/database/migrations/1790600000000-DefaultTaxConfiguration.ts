import { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultTaxConfiguration1790600000000 implements MigrationInterface {
  name = 'DefaultTaxConfiguration1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "taxes"
      ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "taxes"
      SET "is_default" = false
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "taxes"
      SET "is_default" = true
      WHERE "deleted_at" IS NULL
        AND "is_active" = true
        AND UPPER("tax_code") = 'VAT-MAINLAND'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_taxes_one_default_per_company"
      ON "taxes" ("company_id")
      WHERE "deleted_at" IS NULL
        AND "is_default" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_taxes_one_default_per_company"`,
    );
    await queryRunner.query(`
      ALTER TABLE "taxes"
      DROP COLUMN IF EXISTS "is_default"
    `);
  }
}
