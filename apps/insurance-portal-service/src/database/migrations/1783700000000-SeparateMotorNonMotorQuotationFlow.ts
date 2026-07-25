import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateMotorNonMotorQuotationFlow1783700000000 implements MigrationInterface {
  name = 'SeparateMotorNonMotorQuotationFlow1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'insurance_business_line_enum'
        ) THEN
          CREATE TYPE "public"."insurance_business_line_enum" AS ENUM (
            'MOTOR',
            'NON_MOTOR'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'quotation_flow_enum'
        ) THEN
          CREATE TYPE "public"."quotation_flow_enum" AS ENUM (
            'NON_MOTOR',
            'MOTOR_SINGLE',
            'MOTOR_FLEET'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_categories"
      ADD COLUMN IF NOT EXISTS "business_line"
      "public"."insurance_business_line_enum" NOT NULL DEFAULT 'NON_MOTOR'
    `);

    await queryRunner.query(`
      UPDATE "insurance_categories"
      SET "business_line" =
        CASE
          WHEN UPPER("code") = 'MOTOR'
            OR UPPER("name") LIKE '%MOTOR%'
          THEN 'MOTOR'::"public"."insurance_business_line_enum"
          ELSE 'NON_MOTOR'::"public"."insurance_business_line_enum"
        END
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD COLUMN IF NOT EXISTS "business_line"
      "public"."insurance_business_line_enum" NOT NULL DEFAULT 'NON_MOTOR'
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD COLUMN IF NOT EXISTS "supports_fleet" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD COLUMN IF NOT EXISTS "tiramis_product_code" character varying(50)
    `);

    await queryRunner.query(`
      UPDATE "insurance_products" p
      SET
        "business_line" = c."business_line",
        "supports_fleet" =
          CASE WHEN c."business_line" = 'MOTOR' THEN true ELSE false END,
        "tiramis_product_code" = COALESCE(p."tiramis_product_code", p."product_code")
      FROM "insurance_categories" c
      WHERE c."id" = p."category_id"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_insurance_categories_business_line"
      ON "insurance_categories" ("company_id", "business_line")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_insurance_products_business_line"
      ON "insurance_products" ("company_id", "business_line")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_insurance_products_supports_fleet"
      ON "insurance_products" ("company_id", "supports_fleet")
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "quotation_flow"
      "public"."quotation_flow_enum" NOT NULL DEFAULT 'NON_MOTOR'
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "is_fleet" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(18,2) NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "cover_note_type" character varying(1) NOT NULL DEFAULT '1'
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "prev_cover_note_reference_number" character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "sale_point_code" character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "payment_mode_tira" character varying(1) NOT NULL DEFAULT '1'
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "officer_name" character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "officer_title" character varying(100)
    `);

    await queryRunner.query(`
      UPDATE "quotations"
      SET
        "quotation_flow" =
          CASE
            WHEN "quotation_type" = 'NON_MOTOR'
              THEN 'NON_MOTOR'::"public"."quotation_flow_enum"
            WHEN "quotation_type" = 'MOTOR'
              AND COALESCE(("rating_metadata" ->> 'is_fleet')::boolean, false) = true
              THEN 'MOTOR_FLEET'::"public"."quotation_flow_enum"
            ELSE 'MOTOR_SINGLE'::"public"."quotation_flow_enum"
          END,
        "is_fleet" =
          CASE
            WHEN "quotation_type" = 'MOTOR'
              AND COALESCE(("rating_metadata" ->> 'is_fleet')::boolean, false) = true
            THEN true
            ELSE false
          END
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_flow"
      ON "quotations" ("company_id", "quotation_flow")
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      ADD COLUMN IF NOT EXISTS "client_ref" character varying(80)
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_factor_values"
      ADD COLUMN IF NOT EXISTS "risk_client_ref" character varying(80)
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_premium_breakdowns"
      ADD COLUMN IF NOT EXISTS "risk_client_ref" character varying(80)
    `);

    await queryRunner.query(`
      ALTER TABLE "motor_quotation_details"
      ADD COLUMN IF NOT EXISTS "risk_client_ref" character varying(80)
    `);

    await queryRunner.query(`
      ALTER TABLE "non_motor_quotation_details"
      ADD COLUMN IF NOT EXISTS "risk_client_ref" character varying(80)
    `);

    await queryRunner.query(`
      ALTER TABLE "motor_fleet_items"
      ADD COLUMN IF NOT EXISTS "risk_client_ref" character varying(80)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quotation_risks_quotation_client_ref"
      ON "quotation_risks" ("quotation_id", "client_ref")
      WHERE "client_ref" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_addons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "addon_reference" character varying(50) NOT NULL,
        "addon_desc" character varying(250) NOT NULL,
        "addon_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "addon_premium_rate" numeric(18,6) NOT NULL DEFAULT 0,
        "premium_excluding_tax" numeric(18,2) NOT NULL DEFAULT 0,
        "premium_excluding_tax_equivalent" numeric(18,2) NOT NULL DEFAULT 0,
        "premium_including_tax" numeric(18,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_quotation_addons" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotation_addons_quotation_id"
      ON "quotation_addons" ("quotation_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_addons"
      DROP CONSTRAINT IF EXISTS "FK_quotation_addons_quotation"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_addons"
      ADD CONSTRAINT "FK_quotation_addons_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_addon_taxes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_addon_id" uuid NOT NULL,
        "tax_code" character varying(50) NOT NULL,
        "is_tax_exempted" character varying(1) NOT NULL DEFAULT 'N',
        "tax_exemption_type" character varying(50),
        "tax_exemption_reference" character varying(50),
        "tax_rate" numeric(18,6) NOT NULL DEFAULT 0,
        "tax_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_addon_taxes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotation_addon_taxes_addon_id"
      ON "quotation_addon_taxes" ("quotation_addon_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_addon_taxes"
      DROP CONSTRAINT IF EXISTS "FK_quotation_addon_taxes_addon"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_addon_taxes"
      ADD CONSTRAINT "FK_quotation_addon_taxes_addon"
      FOREIGN KEY ("quotation_addon_id")
      REFERENCES "quotation_addons"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quotation_addon_taxes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quotation_addons"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotation_risks_quotation_client_ref"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_company_flow"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_insurance_products_supports_fleet"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_insurance_products_business_line"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_insurance_categories_business_line"`,
    );

    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" DROP COLUMN IF EXISTS "risk_client_ref"`,
    );
    await queryRunner.query(
      `ALTER TABLE "non_motor_quotation_details" DROP COLUMN IF EXISTS "risk_client_ref"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_quotation_details" DROP COLUMN IF EXISTS "risk_client_ref"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_premium_breakdowns" DROP COLUMN IF EXISTS "risk_client_ref"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_factor_values" DROP COLUMN IF EXISTS "risk_client_ref"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risks" DROP COLUMN IF EXISTS "client_ref"`,
    );

    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "officer_title"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "officer_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "payment_mode_tira"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "sale_point_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "prev_cover_note_reference_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "cover_note_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "exchange_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "is_fleet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "quotation_flow"`,
    );

    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP COLUMN IF EXISTS "tiramis_product_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP COLUMN IF EXISTS "supports_fleet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP COLUMN IF EXISTS "business_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_categories" DROP COLUMN IF EXISTS "business_line"`,
    );

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."quotation_flow_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."insurance_business_line_enum"`,
    );
  }
}
