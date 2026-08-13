import { MigrationInterface, QueryRunner } from 'typeorm';

export class EndorsementReturnPremium1786521549522 implements MigrationInterface {
  name = 'EndorsementReturnPremium1786521549522';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "finance_refunds"
      ADD COLUMN IF NOT EXISTS "source_type" varchar(40) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_refunds"
      ADD COLUMN IF NOT EXISTS "source_record_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_refunds"
      ADD COLUMN IF NOT EXISTS "policy_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_refunds"
      ADD COLUMN IF NOT EXISTS "endorsement_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_finance_refunds_source"
      ON "finance_refunds" ("company_id", "source_type", "source_record_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_finance_refund_source_receipt_invoice"
      ON "finance_refunds" (
        "company_id",
        "source_type",
        "source_record_id",
        "receipt_id",
        "invoice_id"
      )
      WHERE "source_type" IS NOT NULL
        AND "source_record_id" IS NOT NULL
        AND "receipt_id" IS NOT NULL
        AND "invoice_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_finance_refund_source_receipt_invoice"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_finance_refunds_source"
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_refunds" DROP COLUMN IF EXISTS "endorsement_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_refunds" DROP COLUMN IF EXISTS "policy_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_refunds" DROP COLUMN IF EXISTS "source_record_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_refunds" DROP COLUMN IF EXISTS "source_type"
    `);
  }
}
