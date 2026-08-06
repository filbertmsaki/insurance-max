import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Closes the Phase 7 pricing-authority gaps confirmed against the actual
 * shipped pricing engine (rate books/rating rules/conditions/quotes already
 * exist from earlier "Phase 2-26" migrations) — purely additive, no
 * pre-existing table is recreated or renamed.
 */
export class PricingRateBookVersioning1794900000000 implements MigrationInterface {
  name = 'PricingRateBookVersioning1794900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Risk lifecycle identity ──────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "insurance_risks"
      ADD COLUMN IF NOT EXISTS "lifecycle_status" character varying(30) NOT NULL DEFAULT 'ACTIVE'
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_risks"
      ADD COLUMN IF NOT EXISTS "tiramis_risk_code" character varying(50)
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_risks"
      ADD COLUMN IF NOT EXISTS "code_locked_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      UPDATE "insurance_risks"
      SET
        "lifecycle_status" = CASE WHEN "is_active" = true THEN 'ACTIVE' ELSE 'RETIRED' END,
        "tiramis_risk_code" = COALESCE("tiramis_risk_code", "risk_code"),
        "code_locked_at" = CASE WHEN "is_active" = true THEN now() ELSE NULL END
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_risks"
      DROP CONSTRAINT IF EXISTS "CHK_insurance_risk_lifecycle"
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_risks"
      ADD CONSTRAINT "CHK_insurance_risk_lifecycle"
      CHECK ("lifecycle_status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
    `);

    // ── Rating-factor validation metadata ────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "rating_factors"
      ADD COLUMN IF NOT EXISTS "validation_rules" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "rating_factors"
      ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "rating_factors"
      ADD COLUMN IF NOT EXISTS "code_locked_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      UPDATE "rating_factors"
      SET
        "is_system" = "code" IN ('sum_insured', 'seat_capacity', 'gross_weight_tons', 'year_of_manufacture'),
        "code_locked_at" = CASE
          WHEN EXISTS (
            SELECT 1 FROM "risk_required_factors" assignment
            WHERE assignment."factor_id" = "rating_factors"."id"
          ) THEN now()
          ELSE NULL
        END
    `);

    // ── Rate-book product-version binding and calculation policy ────────
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "product_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "product_definition_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "definition_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "calculation_version" character varying(30) NOT NULL DEFAULT '7.1'
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "rounding_mode" character varying(20) NOT NULL DEFAULT 'HALF_UP'
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "rounding_increment" numeric(20,4) NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "proration_method" character varying(30) NOT NULL DEFAULT 'NONE'
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);

    await queryRunner.query(`
      UPDATE "pricing_rate_books" rate_book
      SET
        "product_version_id" = product."current_version_id",
        "product_definition_hash" = version."definition_hash"
      FROM "insurance_products" product
      LEFT JOIN "insurance_product_versions" version ON version."id" = product."current_version_id"
      WHERE
        rate_book."product_id" = product."id"
        AND rate_book."product_version_id" IS NULL
        AND product."current_version_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "FK_rate_book_product_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD CONSTRAINT "FK_rate_book_product_version"
      FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "CHK_rate_book_rounding_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD CONSTRAINT "CHK_rate_book_rounding_mode"
      CHECK ("rounding_mode" IN ('HALF_UP', 'UP', 'DOWN'))
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "CHK_rate_book_proration_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD CONSTRAINT "CHK_rate_book_proration_method"
      CHECK ("proration_method" IN ('NONE', 'DAILY_365', 'DAILY_366', 'MONTHLY_12'))
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "CHK_rate_book_rounding_increment"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      ADD CONSTRAINT "CHK_rate_book_rounding_increment"
      CHECK ("rounding_increment" > 0)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rate_books_product_version"
      ON "pricing_rate_books" ("product_version_id")
    `);

    // ── Required factors become rate-book scoped (legacy rows kept) ─────
    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      ADD COLUMN IF NOT EXISTS "rate_book_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      ADD COLUMN IF NOT EXISTS "factor_snapshot" jsonb
    `);

    await queryRunner.query(`
      UPDATE "risk_required_factors" assignment
      SET "factor_snapshot" = jsonb_build_object(
        'factorId', factor."id",
        'code', factor."code",
        'name', factor."name",
        'dataType', factor."data_type",
        'unit', factor."unit",
        'options', COALESCE(to_jsonb(factor."options"), '[]'::jsonb),
        'defaultValue', factor."default_value",
        'validationRules', factor."validation_rules"
      )
      FROM "rating_factors" factor
      WHERE factor."id" = assignment."factor_id" AND assignment."factor_snapshot" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      DROP CONSTRAINT IF EXISTS "FK_required_factor_rate_book"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      ADD CONSTRAINT "FK_required_factor_rate_book"
      FOREIGN KEY ("rate_book_id") REFERENCES "pricing_rate_books"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      DROP CONSTRAINT IF EXISTS "UQ_risk_required_factors_company_risk_factor"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_required_factor_rate_book"
      ON "risk_required_factors" ("company_id", "rate_book_id", "risk_id", "factor_id")
      WHERE "rate_book_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_required_factor_legacy"
      ON "risk_required_factors" ("company_id", "risk_id", "factor_id")
      WHERE "rate_book_id" IS NULL
    `);

    // ── Rating-rule maximum premium + specificity ────────────────────────
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD COLUMN IF NOT EXISTS "maximum_amount" numeric(20,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD COLUMN IF NOT EXISTS "specificity_score" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE "risk_rating_rules" rule
      SET "specificity_score" = COALESCE(condition_counts.count, 0)
      FROM (
        SELECT "rule_id", COUNT(*) AS count
        FROM "risk_rule_conditions"
        GROUP BY "rule_id"
      ) condition_counts
      WHERE condition_counts."rule_id" = rule."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP CONSTRAINT IF EXISTS "CHK_rating_rule_min_max"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "CHK_rating_rule_min_max"
      CHECK ("maximum_amount" IS NULL OR "minimum_amount" IS NULL OR "maximum_amount" >= "minimum_amount")
    `);

    // ── Phase 6 add-on pricing rules ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_addon_rate_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "rate_book_id" uuid NOT NULL,
        "product_version_id" uuid NOT NULL,
        "addon_definition_id" uuid NOT NULL,
        "rule_code" character varying(50) NOT NULL,
        "pricing_type" character varying(30) NOT NULL,
        "percentage_rate" numeric(18,10),
        "fixed_amount" numeric(20,4),
        "per_unit_amount" numeric(20,4),
        "per_unit_factor_code" character varying(100),
        "minimum_amount" numeric(20,4),
        "maximum_amount" numeric(20,4),
        "effective_from" date,
        "effective_to" date,
        "priority" integer NOT NULL DEFAULT 100,
        "is_active" boolean NOT NULL DEFAULT true,
        "addon_snapshot" jsonb NOT NULL,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_product_addon_rate_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_addon_rate_rule_code" UNIQUE ("rate_book_id", "rule_code"),
        CONSTRAINT "FK_addon_rate_rule_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_addon_rate_rule_rate_book" FOREIGN KEY ("rate_book_id") REFERENCES "pricing_rate_books"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_addon_rate_rule_product_version" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_addon_rate_rule_definition" FOREIGN KEY ("addon_definition_id") REFERENCES "product_addon_definitions"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_addon_pricing_type" CHECK ("pricing_type" IN ('PERCENTAGE', 'FIXED', 'PER_UNIT', 'INCLUDED')),
        CONSTRAINT "CHK_addon_rule_min_max" CHECK ("maximum_amount" IS NULL OR "minimum_amount" IS NULL OR "maximum_amount" >= "minimum_amount")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_addon_rate_rules_resolution"
      ON "product_addon_rate_rules" ("company_id", "rate_book_id", "addon_definition_id", "is_active", "priority")
    `);

    // ── Pricing quote provenance ──────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD COLUMN IF NOT EXISTS "product_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD COLUMN IF NOT EXISTS "product_definition_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD COLUMN IF NOT EXISTS "rate_book_definition_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD COLUMN IF NOT EXISTS "result_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD COLUMN IF NOT EXISTS "rate_book_snapshot" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD COLUMN IF NOT EXISTS "pricing_result_snapshot" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD COLUMN IF NOT EXISTS "maximum_premium_adjustment" numeric(20,4) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP CONSTRAINT IF EXISTS "FK_pricing_quote_product_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      ADD CONSTRAINT "FK_pricing_quote_product_version"
      FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE RESTRICT
    `);

    // ── Quotation-risk immutable pricing snapshot ────────────────────────
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      ADD COLUMN IF NOT EXISTS "pricing_result_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      ADD COLUMN IF NOT EXISTS "pricing_snapshot" jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      DROP COLUMN IF EXISTS "pricing_snapshot",
      DROP COLUMN IF EXISTS "pricing_result_hash"
    `);

    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP CONSTRAINT IF EXISTS "FK_pricing_quote_product_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_quotes"
      DROP COLUMN IF EXISTS "maximum_premium_adjustment",
      DROP COLUMN IF EXISTS "pricing_result_snapshot",
      DROP COLUMN IF EXISTS "rate_book_snapshot",
      DROP COLUMN IF EXISTS "result_hash",
      DROP COLUMN IF EXISTS "rate_book_definition_hash",
      DROP COLUMN IF EXISTS "product_definition_hash",
      DROP COLUMN IF EXISTS "product_version_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "product_addon_rate_rules"`);

    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP CONSTRAINT IF EXISTS "CHK_rating_rule_min_max"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP COLUMN IF EXISTS "specificity_score",
      DROP COLUMN IF EXISTS "maximum_amount"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_required_factor_legacy"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_required_factor_rate_book"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      ADD CONSTRAINT "UQ_risk_required_factors_company_risk_factor" UNIQUE ("company_id", "risk_id", "factor_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      DROP CONSTRAINT IF EXISTS "FK_required_factor_rate_book"
    `);
    await queryRunner.query(`
      ALTER TABLE "risk_required_factors"
      DROP COLUMN IF EXISTS "factor_snapshot",
      DROP COLUMN IF EXISTS "rate_book_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_rate_books_product_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "CHK_rate_book_rounding_increment"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "CHK_rate_book_proration_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "CHK_rate_book_rounding_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP CONSTRAINT IF EXISTS "FK_rate_book_product_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rate_books"
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "proration_method",
      DROP COLUMN IF EXISTS "rounding_increment",
      DROP COLUMN IF EXISTS "rounding_mode",
      DROP COLUMN IF EXISTS "calculation_version",
      DROP COLUMN IF EXISTS "definition_hash",
      DROP COLUMN IF EXISTS "product_definition_hash",
      DROP COLUMN IF EXISTS "product_version_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "rating_factors"
      DROP COLUMN IF EXISTS "code_locked_at",
      DROP COLUMN IF EXISTS "is_system",
      DROP COLUMN IF EXISTS "validation_rules"
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_risks"
      DROP CONSTRAINT IF EXISTS "CHK_insurance_risk_lifecycle"
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_risks"
      DROP COLUMN IF EXISTS "code_locked_at",
      DROP COLUMN IF EXISTS "tiramis_risk_code",
      DROP COLUMN IF EXISTS "lifecycle_status"
    `);
  }
}
