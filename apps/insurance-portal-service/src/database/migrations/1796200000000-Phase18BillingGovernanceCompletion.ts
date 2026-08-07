import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase18BillingGovernanceCompletion1796200000000
  implements MigrationInterface
{
  name = 'Phase18BillingGovernanceCompletion1796200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saas_invoice_adjustments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "invoice_id" uuid NOT NULL,
        "adjustment_no" varchar(80) NOT NULL,
        "adjustment_type" varchar(30) NOT NULL,
        "amount" numeric(20,4) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "reason" text NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid NOT NULL,
        "approved_by" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saas_invoice_adjustments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saas_invoice_adjustments_no" UNIQUE ("adjustment_no")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_saas_invoice_adjustments_invoice_created"
      ON "saas_invoice_adjustments" ("invoice_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_saas_invoice_adjustments_invoice_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "saas_invoice_adjustments"`);
  }
}
