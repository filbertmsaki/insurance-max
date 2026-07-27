import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase7PricingRateBooks1785200000000
  implements MigrationInterface
{
  name = 'Phase7PricingRateBooks1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'pricing_rate_book_status_enum'
        ) THEN
          CREATE TYPE "public"."pricing_rate_book_status_enum" AS ENUM(
            'DRAFT',
            'UNDER_REVIEW',
            'APPROVED',
            'PUBLISHED',
            'RETIRED',
            'REJECTED'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "pricing_rate_books" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "code" character varying(50) NOT NULL,
        "version" character varying(30) NOT NULL,
        "name" character varying(150),
        "currency_code" character varying(10),
        "status" "public"."pricing_rate_book_status_enum" NOT NULL DEFAULT 'DRAFT',
        "effective_from" date NOT NULL,
        "effective_to" date,
        "created_by" uuid,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "approved_by" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "published_by" uuid,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_pricing_rate_books" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pricing_rate_books_company_code_version" UNIQUE ("company_id", "code", "version")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pricing_rate_books_company_product"
      ON "pricing_rate_books" ("company_id", "product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pricing_rate_books_status"
      ON "pricing_rate_books" ("status")
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD CONSTRAINT "FK_pricing_rate_books_company"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD CONSTRAINT "FK_pricing_rate_books_product"
      FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD COLUMN "rate_book_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD COLUMN "rule_version" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "FK_risk_rating_rules_rate_book"
      FOREIGN KEY ("rate_book_id") REFERENCES "pricing_rate_books"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP CONSTRAINT IF EXISTS "UQ_risk_rating_rules_company_risk_name"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_risk_rating_rules_company_risk_name_legacy"
      ON "risk_rating_rules" ("company_id", "risk_id", "rule_name")
      WHERE "rate_book_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_risk_rating_rules_company_risk_book_name"
      ON "risk_rating_rules" ("company_id", "risk_id", "rate_book_id", "rule_name")
      WHERE "rate_book_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_risk_rating_rules_company_risk_book_name"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_risk_rating_rules_company_risk_name_legacy"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP CONSTRAINT IF EXISTS "FK_risk_rating_rules_rate_book"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP COLUMN "rule_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP COLUMN "rate_book_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "UQ_risk_rating_rules_company_risk_name"
      UNIQUE ("company_id", "risk_id", "rule_name")
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "FK_pricing_rate_books_product"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "FK_pricing_rate_books_company"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pricing_rate_books_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pricing_rate_books_company_product"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "pricing_rate_books"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."pricing_rate_book_status_enum"
    `);
  }
}
