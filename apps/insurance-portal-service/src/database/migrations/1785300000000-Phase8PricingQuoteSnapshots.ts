import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase8PricingQuoteSnapshots1785300000000
  implements MigrationInterface
{
  name = 'Phase8PricingQuoteSnapshots1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'pricing_quotes_quote_scope_enum'
        ) THEN
          CREATE TYPE "public"."pricing_quotes_quote_scope_enum" AS ENUM(
            'SINGLE_RISK',
            'MULTI_RISK'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'pricing_quotes_calculation_status_enum'
        ) THEN
          CREATE TYPE "public"."pricing_quotes_calculation_status_enum" AS ENUM(
            'CALCULATED'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS pricing_quote_identifier_seq
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
    `);

    await queryRunner.query(`
      CREATE TABLE "pricing_quotes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "pricing_quote_id" character varying(30) NOT NULL,
        "sequence_no" bigint NOT NULL,
        "quote_scope" "public"."pricing_quotes_quote_scope_enum" NOT NULL,
        "calculation_status" "public"."pricing_quotes_calculation_status_enum" NOT NULL DEFAULT 'CALCULATED',
        "calculated_by" uuid,
        "product_id" uuid,
        "risk_id" uuid,
        "quotation_type" character varying(50),
        "currency_code" character varying(10),
        "rate_book_id" uuid,
        "rate_book_version" character varying(30),
        "matched_rule_id" uuid,
        "matched_rule_version" integer,
        "base_premium" numeric(20,4) NOT NULL DEFAULT '0',
        "minimum_premium_adjustment" numeric(20,4) NOT NULL DEFAULT '0',
        "gross_premium" numeric(20,4) NOT NULL DEFAULT '0',
        "final_premium" numeric(20,4) NOT NULL DEFAULT '0',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "calculated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "input_signature" character varying(64) NOT NULL,
        "input_payload" jsonb NOT NULL,
        "factor_payload" jsonb,
        "result_payload" jsonb NOT NULL,
        "warning_messages" jsonb,
        "context_payload" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_pricing_quotes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pricing_quotes_pricing_quote_id" UNIQUE ("pricing_quote_id"),
        CONSTRAINT "UQ_pricing_quotes_sequence_no" UNIQUE ("sequence_no")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pricing_quotes_company_id"
      ON "pricing_quotes" ("company_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pricing_quotes_company_product_id"
      ON "pricing_quotes" ("company_id", "product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pricing_quotes_company_risk_id"
      ON "pricing_quotes" ("company_id", "risk_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_pricing_quotes_pricing_quote_id"
      ON "pricing_quotes" ("pricing_quote_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD CONSTRAINT "FK_pricing_quotes_company"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD CONSTRAINT "FK_pricing_quotes_product"
      FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD CONSTRAINT "FK_pricing_quotes_risk"
      FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD CONSTRAINT "FK_pricing_quotes_rate_book"
      FOREIGN KEY ("rate_book_id") REFERENCES "pricing_rate_books"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD CONSTRAINT "FK_pricing_quotes_matched_rule"
      FOREIGN KEY ("matched_rule_id") REFERENCES "risk_rating_rules"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP CONSTRAINT IF EXISTS "FK_pricing_quotes_matched_rule"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP CONSTRAINT IF EXISTS "FK_pricing_quotes_rate_book"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP CONSTRAINT IF EXISTS "FK_pricing_quotes_risk"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP CONSTRAINT IF EXISTS "FK_pricing_quotes_product"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP CONSTRAINT IF EXISTS "FK_pricing_quotes_company"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pricing_quotes_pricing_quote_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pricing_quotes_company_risk_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pricing_quotes_company_product_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pricing_quotes_company_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "pricing_quotes"
    `);
    await queryRunner.query(`
      DROP SEQUENCE IF EXISTS pricing_quote_identifier_seq
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."pricing_quotes_calculation_status_enum"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."pricing_quotes_quote_scope_enum"
    `);
  }
}
