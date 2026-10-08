import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsurancePartnerProductScopes1791800000000 implements MigrationInterface {
  name = 'InsurancePartnerProductScopes1791800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners"
      ADD COLUMN "scope_mode" varchar(20) NOT NULL DEFAULT 'LEGACY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners"
      ADD CONSTRAINT "CHK_insurance_company_partners_scope_mode"
      CHECK ("scope_mode" IN ('LEGACY', 'RESTRICTED'))`,
    );
    await queryRunner.query(`
      CREATE TABLE "insurance_company_partner_product_scopes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "relationship_id" uuid NOT NULL REFERENCES "insurance_company_partners"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "insurance_products"("id") ON DELETE RESTRICT,
        "allowed_operations" varchar[] NOT NULL DEFAULT '{}',
        "commission_rate" numeric(18,10),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_insurance_partner_product_scope" UNIQUE ("relationship_id", "product_id"),
        CONSTRAINT "CHK_insurance_partner_product_scopes_operations" CHECK (
          "allowed_operations" <@ ARRAY[
            'QUOTE','SUBMIT','VIEW_QUOTATION','VIEW_POLICY','REQUEST_ENDORSEMENT',
            'REQUEST_RENEWAL','NOTIFY_CLAIM','VIEW_CLAIM','VIEW_PAYMENT','VIEW_COMMISSION'
          ]::varchar[]
        ),
        CONSTRAINT "CHK_insurance_partner_product_scopes_commission_rate" CHECK (
          "commission_rate" IS NULL OR ("commission_rate" >= 0 AND "commission_rate" <= 1)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_insurance_partner_product_scopes_product"
      ON "insurance_company_partner_product_scopes" ("product_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners"
      DROP CONSTRAINT IF EXISTS "CHK_insurance_company_partners_scope_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners"
      DROP COLUMN IF EXISTS "scope_mode"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_insurance_partner_product_scopes_product"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "insurance_company_partner_product_scopes"`,
    );
  }
}
