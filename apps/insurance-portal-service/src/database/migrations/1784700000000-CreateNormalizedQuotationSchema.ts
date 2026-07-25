import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNormalizedQuotationSchema1784700000000 implements MigrationInterface {
  name = 'CreateNormalizedQuotationSchema1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'quotation_entry_type_enum'
        ) THEN
          CREATE TYPE "public"."quotation_entry_type_enum"
          AS ENUM ('STANDARD', 'FLEET_ITEM');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_company"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_insurer_company"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "customer_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "updated_by" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "submitted_by" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_company"
      FOREIGN KEY ("company_id")
      REFERENCES "companies"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_insurer_company"
      FOREIGN KEY ("insurer_company_id")
      REFERENCES "companies"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_customer"
      FOREIGN KEY ("customer_id")
      REFERENCES "customers"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_updated_by"
      FOREIGN KEY ("updated_by")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_submitted_by"
      FOREIGN KEY ("submitted_by")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_submitted_at"
      ON "quotations" ("submitted_at")
      WHERE "submitted_at" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "CK_quotations_flow_shape"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "CK_quotations_flow_shape"
      CHECK (
        (
          "quotation_type" = 'NON_MOTOR'
          AND "quotation_flow" = 'NON_MOTOR'
          AND "is_fleet" = FALSE
        )
        OR
        (
          "quotation_type" = 'MOTOR'
          AND "quotation_flow" = 'MOTOR_SINGLE'
          AND "is_fleet" = FALSE
        )
        OR
        (
          "quotation_type" = 'MOTOR'
          AND "quotation_flow" = 'MOTOR_FLEET'
          AND "is_fleet" = TRUE
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_cover_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "cover_note_type" smallint NOT NULL,
        "sale_point_code" character varying(50) NOT NULL,
        "cover_note_start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "cover_note_end_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "payment_mode" smallint NOT NULL,
        "currency_code" character varying(10) NOT NULL,
        "exchange_rate" numeric(18,6) NOT NULL DEFAULT 1,
        "total_premium_excluding_tax" numeric(18,2) NOT NULL DEFAULT 0,
        "total_premium_including_tax" numeric(18,2) NOT NULL DEFAULT 0,
        "commission_paid" numeric(18,2) NOT NULL DEFAULT 0,
        "commission_rate" numeric(18,6) NOT NULL DEFAULT 0,
        "officer_name" character varying(150) NOT NULL,
        "officer_title" character varying(150) NOT NULL,
        "product_code" character varying(50) NOT NULL,
        "fleet_id" character varying(100),
        "fleet_type" smallint,
        "fleet_size" integer,
        "comprehensive_insured" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_cover_notes" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qcn_basic_values" CHECK (
          "cover_note_type" > 0
          AND "payment_mode" > 0
          AND "exchange_rate" > 0
        ),
        CONSTRAINT "CK_qcn_dates" CHECK (
          "cover_note_end_date" > "cover_note_start_date"
        ),
        CONSTRAINT "CK_qcn_totals" CHECK (
          "total_premium_excluding_tax" >= 0
          AND "total_premium_including_tax" >= 0
          AND "total_premium_including_tax" >= "total_premium_excluding_tax"
          AND "commission_paid" >= 0
          AND "commission_rate" >= 0
        ),
        CONSTRAINT "CK_qcn_fleet_fields" CHECK (
          (
            "fleet_id" IS NULL
            AND "fleet_type" IS NULL
            AND "fleet_size" IS NULL
            AND "comprehensive_insured" IS NULL
          )
          OR
          (
            "fleet_id" IS NOT NULL
            AND "fleet_type" IS NOT NULL
            AND "fleet_type" > 0
            AND "fleet_size" IS NOT NULL
            AND "fleet_size" > 0
            AND "comprehensive_insured" IS NOT NULL
            AND "comprehensive_insured" >= 0
            AND "comprehensive_insured" <= "fleet_size"
          )
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_quotation_cover_notes_quotation_id"
      ON "quotation_cover_notes" ("quotation_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_quotation_cover_notes_fleet_id"
      ON "quotation_cover_notes" ("fleet_id")
      WHERE "fleet_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qcn_dates"
      ON "quotation_cover_notes" ("cover_note_start_date", "cover_note_end_date")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_cover_notes"
      ADD CONSTRAINT "FK_qcn_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_cover_note_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cover_note_id" uuid NOT NULL,
        "entry_type" "public"."quotation_entry_type_enum" NOT NULL,
        "entry_number" integer NOT NULL,
        "fleet_entry" integer,
        "cover_note_number" character varying(100) NOT NULL,
        "prev_cover_note_reference_number" character varying(100),
        "cover_note_desc" character varying(500) NOT NULL,
        "operative_clause" character varying(500) NOT NULL,
        "endorsement_type" smallint,
        "endorsement_reason" character varying(500),
        "endorsement_premium_earned" numeric(18,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_cover_note_entries" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qcne_entry_number" CHECK ("entry_number" > 0),
        CONSTRAINT "CK_qcne_fleet_entry" CHECK (
          (
            "entry_type" = 'STANDARD'
            AND "fleet_entry" IS NULL
          )
          OR
          (
            "entry_type" = 'FLEET_ITEM'
            AND "fleet_entry" IS NOT NULL
            AND "fleet_entry" > 0
          )
        ),
        CONSTRAINT "CK_qcne_endorsement" CHECK (
          (
            "endorsement_type" IS NULL
            AND "endorsement_reason" IS NULL
            AND "endorsement_premium_earned" IS NULL
          )
          OR
          (
            "endorsement_type" IS NOT NULL
            AND "endorsement_type" > 0
            AND (
              "endorsement_premium_earned" IS NULL
              OR "endorsement_premium_earned" >= 0
            )
          )
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qcne_cover_note_entry_number"
      ON "quotation_cover_note_entries" ("cover_note_id", "entry_number")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qcne_cover_note_number"
      ON "quotation_cover_note_entries" ("cover_note_number")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qcne_cover_note_id"
      ON "quotation_cover_note_entries" ("cover_note_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qcne_fleet_entry"
      ON "quotation_cover_note_entries" ("cover_note_id", "fleet_entry")
      WHERE "fleet_entry" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_cover_note_entries"
      ADD CONSTRAINT "FK_qcne_cover_note"
      FOREIGN KEY ("cover_note_id")
      REFERENCES "quotation_cover_notes"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_policy_holders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "customer_id" uuid,
        "sequence_no" integer NOT NULL,
        "policy_holder_name" character varying(200) NOT NULL,
        "policy_holder_birth_date" date NOT NULL,
        "policy_holder_type" smallint NOT NULL,
        "policy_holder_id_number" character varying(100) NOT NULL,
        "policy_holder_id_type" smallint NOT NULL,
        "gender" character varying(1),
        "country_code" character varying(3) NOT NULL,
        "region" character varying(100) NOT NULL,
        "district" character varying(100) NOT NULL,
        "street" character varying(100),
        "policy_holder_phone_number" character varying(30) NOT NULL,
        "policy_holder_fax" character varying(30),
        "postal_address" character varying(250),
        "email_address" character varying(150),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_policy_holders" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qph_sequence" CHECK ("sequence_no" > 0),
        CONSTRAINT "CK_qph_types" CHECK (
          "policy_holder_type" > 0
          AND "policy_holder_id_type" > 0
        ),
        CONSTRAINT "CK_qph_gender" CHECK (
          "gender" IS NULL
          OR "gender" IN ('M', 'F')
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qph_quotation_sequence"
      ON "quotation_policy_holders" ("quotation_id", "sequence_no")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qph_customer_id"
      ON "quotation_policy_holders" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qph_identity"
      ON "quotation_policy_holders" ("policy_holder_id_type", "policy_holder_id_number")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qph_name"
      ON "quotation_policy_holders" ("policy_holder_name")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_policy_holders"
      ADD CONSTRAINT "FK_qph_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_policy_holders"
      ADD CONSTRAINT "FK_qph_customer"
      FOREIGN KEY ("customer_id")
      REFERENCES "customers"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_entry_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry_id" uuid NOT NULL,
        "insurance_risk_id" uuid,
        "sequence_no" integer NOT NULL,
        "risk_code" character varying(50) NOT NULL,
        "sum_insured" numeric(18,2) NOT NULL,
        "sum_insured_equivalent" numeric(18,2) NOT NULL,
        "premium_rate" numeric(18,6) NOT NULL,
        "premium_before_discount" numeric(18,2) NOT NULL,
        "premium_after_discount" numeric(18,2) NOT NULL,
        "premium_excluding_tax_equivalent" numeric(18,2) NOT NULL,
        "premium_including_tax" numeric(18,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_entry_risks" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qer_values" CHECK (
          "sequence_no" > 0
          AND "sum_insured" >= 0
          AND "sum_insured_equivalent" >= 0
          AND "premium_rate" >= 0
          AND "premium_before_discount" >= 0
          AND "premium_after_discount" >= 0
          AND "premium_after_discount" <= "premium_before_discount"
          AND "premium_excluding_tax_equivalent" >= 0
          AND "premium_including_tax" >= 0
          AND "premium_including_tax" >= "premium_excluding_tax_equivalent"
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qer_entry_sequence"
      ON "quotation_entry_risks" ("entry_id", "sequence_no")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qer_entry_id"
      ON "quotation_entry_risks" ("entry_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qer_risk_code"
      ON "quotation_entry_risks" ("risk_code")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qer_insurance_risk_id"
      ON "quotation_entry_risks" ("insurance_risk_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      ADD CONSTRAINT "FK_qer_entry"
      FOREIGN KEY ("entry_id")
      REFERENCES "quotation_cover_note_entries"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      ADD CONSTRAINT "FK_qer_insurance_risk"
      FOREIGN KEY ("insurance_risk_id")
      REFERENCES "insurance_risks"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_risk_discounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "risk_id" uuid NOT NULL,
        "sequence_no" integer NOT NULL,
        "discount_type" smallint NOT NULL,
        "discount_rate" numeric(18,6) NOT NULL,
        "discount_amount" numeric(18,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_risk_discounts" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qrd_values" CHECK (
          "sequence_no" > 0
          AND "discount_type" > 0
          AND "discount_rate" >= 0
          AND "discount_amount" >= 0
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qrd_risk_sequence"
      ON "quotation_risk_discounts" ("risk_id", "sequence_no")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qrd_risk_id"
      ON "quotation_risk_discounts" ("risk_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risk_discounts"
      ADD CONSTRAINT "FK_qrd_risk"
      FOREIGN KEY ("risk_id")
      REFERENCES "quotation_entry_risks"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_risk_taxes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "risk_id" uuid NOT NULL,
        "sequence_no" integer NOT NULL,
        "tax_code" character varying(50) NOT NULL,
        "is_tax_exempted" character varying(1) NOT NULL DEFAULT 'N',
        "tax_exemption_type" character varying(50),
        "tax_exemption_reference" character varying(100),
        "tax_rate" numeric(18,6) NOT NULL,
        "tax_amount" numeric(18,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_risk_taxes" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qrt_values" CHECK (
          "sequence_no" > 0
          AND "is_tax_exempted" IN ('Y', 'N')
          AND "tax_rate" >= 0
          AND "tax_amount" >= 0
          AND (
            (
              "is_tax_exempted" = 'N'
              AND "tax_exemption_type" IS NULL
              AND "tax_exemption_reference" IS NULL
            )
            OR
            (
              "is_tax_exempted" = 'Y'
              AND "tax_amount" = 0
              AND "tax_exemption_type" IS NOT NULL
              AND "tax_exemption_reference" IS NOT NULL
            )
          )
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qrt_risk_sequence"
      ON "quotation_risk_taxes" ("risk_id", "sequence_no")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qrt_risk_id"
      ON "quotation_risk_taxes" ("risk_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qrt_tax_code"
      ON "quotation_risk_taxes" ("tax_code")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risk_taxes"
      ADD CONSTRAINT "FK_qrt_risk"
      FOREIGN KEY ("risk_id")
      REFERENCES "quotation_entry_risks"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_subject_matters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry_id" uuid NOT NULL,
        "sequence_no" integer NOT NULL,
        "subject_matter_reference" character varying(100) NOT NULL,
        "subject_matter_desc" character varying(500) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_subject_matters" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qsm_sequence" CHECK ("sequence_no" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qsm_entry_sequence"
      ON "quotation_subject_matters" ("entry_id", "sequence_no")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qsm_entry_id"
      ON "quotation_subject_matters" ("entry_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qsm_reference"
      ON "quotation_subject_matters" ("subject_matter_reference")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_subject_matters"
      ADD CONSTRAINT "FK_qsm_entry"
      FOREIGN KEY ("entry_id")
      REFERENCES "quotation_cover_note_entries"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_entry_addons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry_id" uuid NOT NULL,
        "sequence_no" integer NOT NULL,
        "addon_reference" character varying(100) NOT NULL,
        "addon_desc" character varying(500) NOT NULL,
        "addon_amount" numeric(18,2) NOT NULL,
        "addon_premium_rate" numeric(18,6) NOT NULL,
        "premium_excluding_tax" numeric(18,2) NOT NULL,
        "premium_excluding_tax_equivalent" numeric(18,2) NOT NULL,
        "premium_including_tax" numeric(18,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_entry_addons" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qea_values" CHECK (
          "sequence_no" > 0
          AND "addon_amount" >= 0
          AND "addon_premium_rate" >= 0
          AND "premium_excluding_tax" >= 0
          AND "premium_excluding_tax_equivalent" >= 0
          AND "premium_including_tax" >= 0
          AND "premium_including_tax" >= "premium_excluding_tax_equivalent"
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qea_entry_sequence"
      ON "quotation_entry_addons" ("entry_id", "sequence_no")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qea_entry_id"
      ON "quotation_entry_addons" ("entry_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qea_reference"
      ON "quotation_entry_addons" ("addon_reference")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_addons"
      ADD CONSTRAINT "FK_qea_entry"
      FOREIGN KEY ("entry_id")
      REFERENCES "quotation_cover_note_entries"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_entry_addon_taxes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "addon_id" uuid NOT NULL,
        "sequence_no" integer NOT NULL,
        "tax_code" character varying(50) NOT NULL,
        "is_tax_exempted" character varying(1) NOT NULL DEFAULT 'N',
        "tax_exemption_type" character varying(50),
        "tax_exemption_reference" character varying(100),
        "tax_rate" numeric(18,6) NOT NULL,
        "tax_amount" numeric(18,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_entry_addon_taxes" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qeat_values" CHECK (
          "sequence_no" > 0
          AND "is_tax_exempted" IN ('Y', 'N')
          AND "tax_rate" >= 0
          AND "tax_amount" >= 0
          AND (
            (
              "is_tax_exempted" = 'N'
              AND "tax_exemption_type" IS NULL
              AND "tax_exemption_reference" IS NULL
            )
            OR
            (
              "is_tax_exempted" = 'Y'
              AND "tax_amount" = 0
              AND "tax_exemption_type" IS NOT NULL
              AND "tax_exemption_reference" IS NOT NULL
            )
          )
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qeat_addon_sequence"
      ON "quotation_entry_addon_taxes" ("addon_id", "sequence_no")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qeat_addon_id"
      ON "quotation_entry_addon_taxes" ("addon_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qeat_tax_code"
      ON "quotation_entry_addon_taxes" ("tax_code")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_addon_taxes"
      ADD CONSTRAINT "FK_qeat_addon"
      FOREIGN KEY ("addon_id")
      REFERENCES "quotation_entry_addons"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "quotation_motor_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry_id" uuid NOT NULL,
        "motor_category" smallint NOT NULL,
        "motor_type" smallint NOT NULL,
        "registration_number" character varying(50) NOT NULL,
        "chassis_number" character varying(100) NOT NULL,
        "make" character varying(100) NOT NULL,
        "model" character varying(100) NOT NULL,
        "model_number" character varying(100),
        "body_type" character varying(100) NOT NULL,
        "color" character varying(50) NOT NULL,
        "engine_number" character varying(100) NOT NULL,
        "engine_capacity" character varying(50) NOT NULL,
        "fuel_used" character varying(50) NOT NULL,
        "number_of_axles" smallint NOT NULL,
        "axle_distance" numeric(10,2) NOT NULL,
        "sitting_capacity" smallint NOT NULL,
        "year_of_manufacture" smallint NOT NULL,
        "tare_weight" numeric(12,2) NOT NULL,
        "gross_weight" numeric(12,2) NOT NULL,
        "motor_usage" smallint NOT NULL,
        "owner_name" character varying(200) NOT NULL,
        "owner_category" smallint NOT NULL,
        "owner_address" character varying(300) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_motor_details" PRIMARY KEY ("id"),
        CONSTRAINT "CK_qmd_values" CHECK (
          "motor_category" > 0
          AND "motor_type" > 0
          AND "number_of_axles" > 0
          AND "axle_distance" >= 0
          AND "sitting_capacity" > 0
          AND "year_of_manufacture" BETWEEN 1886 AND 2100
          AND "tare_weight" >= 0
          AND "gross_weight" >= "tare_weight"
          AND "motor_usage" > 0
          AND "owner_category" > 0
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_qmd_entry_id"
      ON "quotation_motor_details" ("entry_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qmd_registration_number"
      ON "quotation_motor_details" ("registration_number")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qmd_chassis_number"
      ON "quotation_motor_details" ("chassis_number")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qmd_engine_number"
      ON "quotation_motor_details" ("engine_number")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_motor_details"
      ADD CONSTRAINT "FK_qmd_entry"
      FOREIGN KEY ("entry_id")
      REFERENCES "quotation_cover_note_entries"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_motor_details" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_entry_addon_taxes" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_entry_addons" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_subject_matters" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_risk_taxes" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_risk_discounts" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_entry_risks" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_policy_holders" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_cover_note_entries" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_cover_notes" CASCADE`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "CK_quotations_flow_shape"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_submitted_at"`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_updated_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_submitted_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "submitted_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "submitted_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "updated_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_company"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_insurer_company"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_customer"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "quotations"
          WHERE "customer_id" IS NULL
        ) THEN
          RAISE EXCEPTION
            'Cannot rollback quotation migration because quotations with NULL customer_id exist';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "customer_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_company"
      FOREIGN KEY ("company_id")
      REFERENCES "companies"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_insurer_company"
      FOREIGN KEY ("insurer_company_id")
      REFERENCES "companies"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_customer"
      FOREIGN KEY ("customer_id")
      REFERENCES "customers"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."quotation_entry_type_enum"`,
    );
  }
}
