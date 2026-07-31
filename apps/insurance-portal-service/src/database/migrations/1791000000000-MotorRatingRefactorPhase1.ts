import { MigrationInterface, QueryRunner } from 'typeorm';

export class MotorRatingRefactorPhase11791000000000 implements MigrationInterface {
  name = 'MotorRatingRefactorPhase11791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'factor_unit_enum'
        ) THEN
          CREATE TYPE "public"."factor_unit_enum" AS ENUM(
            'CURRENCY',
            'SEAT',
            'TONNE',
            'YEAR'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."rating_factors_data_type_enum"
      ADD VALUE IF NOT EXISTS 'DECIMAL'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."rating_factors_data_type_enum"
      ADD VALUE IF NOT EXISTS 'INTEGER'
    `);

    await queryRunner.query(`
      ALTER TABLE "rating_factors"
      ADD COLUMN IF NOT EXISTS "unit" "public"."factor_unit_enum"
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricing_configuration_archives" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "category_code" character varying(50) NOT NULL,
        "archive_scope" character varying(100) NOT NULL,
        "archive_reason" character varying(255) NOT NULL,
        "payload" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pricing_configuration_archives" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pricing_configuration_archives_company_scope"
      ON "pricing_configuration_archives" ("company_id", "archive_scope")
    `);

    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`
        INSERT INTO "pricing_configuration_archives" (
          "company_id",
          "category_code",
          "archive_scope",
          "archive_reason",
          "payload"
        )
        SELECT
          company_scope."company_id",
          'MOTOR',
          'MOTOR_RATING_PRE_CLEANUP',
          'Motor rating configuration archived before cleanup and rebuild',
          jsonb_build_object(
            'captured_at', now(),
            'rating_factors', (
              SELECT COALESCE(jsonb_agg(to_jsonb(rf) ORDER BY rf.code), '[]'::jsonb)
              FROM "rating_factors" rf
              WHERE rf."company_id" = company_scope."company_id"
            ),
            'risk_required_factors', (
              SELECT COALESCE(jsonb_agg(to_jsonb(rrf) ORDER BY rrf."sort_order", rrf."id"), '[]'::jsonb)
              FROM "risk_required_factors" rrf
              INNER JOIN "insurance_risks" ir ON ir."id" = rrf."risk_id"
              INNER JOIN "insurance_products" ip ON ip."id" = ir."product_id"
              INNER JOIN "insurance_categories" ic ON ic."id" = ip."category_id"
              WHERE rrf."company_id" = company_scope."company_id"
                AND ic."code" = 'MOTOR'
            ),
            'risk_rating_rules', (
              SELECT COALESCE(jsonb_agg(to_jsonb(rrr) ORDER BY rrr."priority", rrr."id"), '[]'::jsonb)
              FROM "risk_rating_rules" rrr
              INNER JOIN "insurance_risks" ir ON ir."id" = rrr."risk_id"
              INNER JOIN "insurance_products" ip ON ip."id" = ir."product_id"
              INNER JOIN "insurance_categories" ic ON ic."id" = ip."category_id"
              WHERE rrr."company_id" = company_scope."company_id"
                AND ic."code" = 'MOTOR'
                AND rrr."deleted_at" IS NULL
            ),
            'risk_rule_conditions', (
              SELECT COALESCE(jsonb_agg(to_jsonb(rrc) ORDER BY rrc."id"), '[]'::jsonb)
              FROM "risk_rule_conditions" rrc
              INNER JOIN "risk_rating_rules" rrr ON rrr."id" = rrc."rule_id"
              INNER JOIN "insurance_risks" ir ON ir."id" = rrr."risk_id"
              INNER JOIN "insurance_products" ip ON ip."id" = ir."product_id"
              INNER JOIN "insurance_categories" ic ON ic."id" = ip."category_id"
              WHERE rrc."company_id" = company_scope."company_id"
                AND ic."code" = 'MOTOR'
            ),
            'pricing_rate_books', (
              SELECT COALESCE(jsonb_agg(to_jsonb(prb) ORDER BY prb."created_at", prb."id"), '[]'::jsonb)
              FROM "pricing_rate_books" prb
              INNER JOIN "insurance_products" ip ON ip."id" = prb."product_id"
              INNER JOIN "insurance_categories" ic ON ic."id" = ip."category_id"
              WHERE prb."company_id" = company_scope."company_id"
                AND ic."code" = 'MOTOR'
                AND prb."deleted_at" IS NULL
            )
          )
        FROM (
          SELECT DISTINCT ic."company_id"
          FROM "insurance_categories" ic
          WHERE ic."code" = 'MOTOR'
            AND ic."deleted_at" IS NULL
        ) company_scope
        WHERE NOT EXISTS (
          SELECT 1
          FROM "pricing_configuration_archives" existing
          WHERE existing."company_id" = company_scope."company_id"
            AND existing."archive_scope" = 'MOTOR_RATING_PRE_CLEANUP'
        )
      `);

      await queryRunner.query(`
        WITH motor_risks AS (
          SELECT
            ir."id" AS "risk_id",
            ir."company_id"
          FROM "insurance_risks" ir
          INNER JOIN "insurance_products" ip ON ip."id" = ir."product_id"
          INNER JOIN "insurance_categories" ic ON ic."id" = ip."category_id"
          WHERE ic."code" = 'MOTOR'
            AND ir."deleted_at" IS NULL
            AND ip."deleted_at" IS NULL
            AND ic."deleted_at" IS NULL
        )
        DELETE FROM "risk_required_factors" rrf
        USING motor_risks mr
        WHERE rrf."company_id" = mr."company_id"
          AND rrf."risk_id" = mr."risk_id"
      `);

      await queryRunner.query(`
        WITH motor_rules AS (
          SELECT DISTINCT rrr."id"
          FROM "risk_rating_rules" rrr
          INNER JOIN "insurance_risks" ir ON ir."id" = rrr."risk_id"
          INNER JOIN "insurance_products" ip ON ip."id" = ir."product_id"
          INNER JOIN "insurance_categories" ic ON ic."id" = ip."category_id"
          WHERE ic."code" = 'MOTOR'
            AND rrr."deleted_at" IS NULL
        )
        UPDATE "risk_rating_rules" rrr
        SET
          "is_active" = false,
          "updated_at" = now()
        WHERE rrr."id" IN (SELECT "id" FROM motor_rules)
      `);

      await queryRunner.query(`
        WITH motor_rate_books AS (
          SELECT DISTINCT prb."id"
          FROM "pricing_rate_books" prb
          INNER JOIN "insurance_products" ip ON ip."id" = prb."product_id"
          INNER JOIN "insurance_categories" ic ON ic."id" = ip."category_id"
          WHERE ic."code" = 'MOTOR'
            AND prb."deleted_at" IS NULL
        )
        UPDATE "pricing_rate_books" prb
        SET
          "status" = 'RETIRED',
          "updated_at" = now()
        WHERE prb."id" IN (SELECT "id" FROM motor_rate_books)
          AND prb."status" <> 'RETIRED'
      `);

      await queryRunner.query(`
        UPDATE "rating_factors"
        SET
          "is_active" = CASE
            WHEN "code" IN (
              'sum_insured',
              'seat_capacity',
              'gross_weight_tons',
              'year_of_manufacture'
            )
            THEN "is_active"
            ELSE false
          END,
          "is_required" = false,
          "updated_at" = now()
        WHERE "deleted_at" IS NULL
      `);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // This migration intentionally keeps archived snapshots and conservative
    // cleanup state in place. Reconstructing historical draft pricing
    // configuration automatically from the archive payload would be unsafe.
  }
}
