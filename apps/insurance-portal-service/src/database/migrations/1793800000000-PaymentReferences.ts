import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentReferences1793800000000 implements MigrationInterface {
  name = 'PaymentReferences1793800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_references" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "invoice_id" uuid NOT NULL,
        "provider" character varying(50) NOT NULL,
        "method" character varying(50) NOT NULL,
        "channel" character varying(50),
        "control_number" character varying(80),
        "provider_reference" character varying(180) NOT NULL,
        "external_bill_id" character varying(180),
        "amount" numeric(18,2) NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'TZS',
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "provider_metadata" jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_payment_references" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_references"
      ADD CONSTRAINT "FK_payment_references_company"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_references"
      ADD CONSTRAINT "FK_payment_references_invoice"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_references_company_invoice"
      ON "payment_references" ("company_id", "invoice_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_references_company_status"
      ON "payment_references" ("company_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_references_company_method_status"
      ON "payment_references" ("company_id", "invoice_id", "method", "status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payment_references_company_control_number_active"
      ON "payment_references" ("company_id", "control_number")
      WHERE "deleted_at" IS NULL AND "control_number" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payment_references_provider_reference_active"
      ON "payment_references" ("company_id", "provider", "provider_reference")
      WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_payment_references_provider_reference_active"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_payment_references_company_control_number_active"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_payment_references_company_method_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_payment_references_company_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_payment_references_company_invoice"',
    );
    await queryRunner.query(
      'ALTER TABLE "payment_references" DROP CONSTRAINT IF EXISTS "FK_payment_references_invoice"',
    );
    await queryRunner.query(
      'ALTER TABLE "payment_references" DROP CONSTRAINT IF EXISTS "FK_payment_references_company"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "payment_references"');
  }
}
