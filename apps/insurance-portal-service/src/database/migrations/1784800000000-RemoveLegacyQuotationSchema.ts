import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLegacyQuotationSchema1784800000000 implements MigrationInterface {
  name = 'RemoveLegacyQuotationSchema1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "policy_risks"
      DROP CONSTRAINT IF EXISTS "FK_policy_risks_quotation_risk"
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_risks"
      DROP CONSTRAINT IF EXISTS "FK_policy_risks_quotation_entry_risk"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'policy_risks'
            AND column_name = 'quotation_risk_id'
        ) THEN
          ALTER TABLE "policy_risks"
          RENAME COLUMN "quotation_risk_id" TO "quotation_entry_risk_id";
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_risks"
      ADD CONSTRAINT "FK_policy_risks_quotation_entry_risk"
      FOREIGN KEY ("quotation_entry_risk_id")
      REFERENCES "quotation_entry_risks"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "motor_fleet_items"
      DROP CONSTRAINT IF EXISTS "FK_mfi_quotation_risk"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_fleet_items"
      DROP CONSTRAINT IF EXISTS "FK_mfi_quotation_entry_risk"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mfi_quotation_risk_id"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'motor_fleet_items'
            AND column_name = 'quotation_risk_id'
        ) THEN
          ALTER TABLE "motor_fleet_items"
          RENAME COLUMN "quotation_risk_id" TO "quotation_entry_risk_id";
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mfi_quotation_entry_risk_id"
      ON "motor_fleet_items" ("quotation_entry_risk_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_fleet_items"
      ADD CONSTRAINT "FK_mfi_quotation_entry_risk"
      FOREIGN KEY ("quotation_entry_risk_id")
      REFERENCES "quotation_entry_risks"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    const quotationColumnsToDrop = [
      'currency',
      'exchange_rate',
      'cover_note_type',
      'prev_cover_note_reference_number',
      'sale_point_code',
      'payment_mode_tira',
      'officer_name',
      'officer_title',
      'sum_insured',
      'basic_premium',
      'total_discount',
      'total_tax',
      'total_charges',
      'total_commission',
      'total_premium',
      'net_premium',
      'valid_from',
      'valid_until',
      'rating_version',
      'rating_metadata',
    ];

    for (const column of quotationColumnsToDrop) {
      await queryRunner.query(`
        ALTER TABLE "quotations"
        DROP COLUMN IF EXISTS "${column}"
      `);
    }

    const legacyTables = [
      'quotation_addon_taxes',
      'quotation_addons',
      'quotation_factor_values',
      'quotation_premium_breakdowns',
      'motor_quotation_details',
      'non_motor_quotation_details',
      'quotation_risks',
    ];

    for (const table of legacyTables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "policy_risks"
      DROP CONSTRAINT IF EXISTS "FK_policy_risks_quotation_entry_risk"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'policy_risks'
            AND column_name = 'quotation_entry_risk_id'
        ) THEN
          ALTER TABLE "policy_risks"
          RENAME COLUMN "quotation_entry_risk_id" TO "quotation_risk_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "motor_fleet_items"
      DROP CONSTRAINT IF EXISTS "FK_mfi_quotation_entry_risk"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mfi_quotation_entry_risk_id"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'motor_fleet_items'
            AND column_name = 'quotation_entry_risk_id'
        ) THEN
          ALTER TABLE "motor_fleet_items"
          RENAME COLUMN "quotation_entry_risk_id" TO "quotation_risk_id";
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mfi_quotation_risk_id"
      ON "motor_fleet_items" ("quotation_risk_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "currency" character varying(10) NOT NULL DEFAULT 'TZS'
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
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "sum_insured" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "basic_premium" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "total_discount" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "total_tax" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "total_charges" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "total_commission" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "total_premium" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "net_premium" numeric(18,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "valid_from" date NOT NULL DEFAULT CURRENT_DATE
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "valid_until" date NOT NULL DEFAULT CURRENT_DATE
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "rating_version" character varying(50)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "rating_metadata" jsonb
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "subject_matter_id" uuid,
        "motor_vehicle_id" uuid,
        "client_ref" character varying(80),
        "sum_insured" numeric(18,2) NOT NULL DEFAULT '0',
        "rate" numeric(18,6) NOT NULL DEFAULT '0',
        "fixed_amount" numeric(18,2) NOT NULL DEFAULT '0',
        "basic_premium" numeric(18,2) NOT NULL DEFAULT '0',
        "discount_amount" numeric(18,2) NOT NULL DEFAULT '0',
        "tax_amount" numeric(18,2) NOT NULL DEFAULT '0',
        "charges_amount" numeric(18,2) NOT NULL DEFAULT '0',
        "commission_amount" numeric(18,2) NOT NULL DEFAULT '0',
        "total_premium" numeric(18,2) NOT NULL DEFAULT '0',
        "net_premium" numeric(18,2) NOT NULL DEFAULT '0',
        "rating_rule_id" uuid,
        "rating_result_metadata" jsonb,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_quotation_risks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotation_risks_quotation_id"
      ON "quotation_risks" ("quotation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotation_risks_risk_id"
      ON "quotation_risks" ("risk_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quotation_risks_quotation_client_ref"
      ON "quotation_risks" ("quotation_id", "client_ref")
      WHERE "client_ref" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      ADD CONSTRAINT "FK_quotation_risks_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      ADD CONSTRAINT "FK_quotation_risks_risk"
      FOREIGN KEY ("risk_id")
      REFERENCES "insurance_risks"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      ADD CONSTRAINT "FK_quotation_risks_subject_matter"
      FOREIGN KEY ("subject_matter_id")
      REFERENCES "subject_matters"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      ADD CONSTRAINT "FK_quotation_risks_motor_vehicle"
      FOREIGN KEY ("motor_vehicle_id")
      REFERENCES "motor_vehicles"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "policy_risks"
      ADD CONSTRAINT "FK_policy_risks_quotation_risk"
      FOREIGN KEY ("quotation_risk_id")
      REFERENCES "quotation_risks"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_fleet_items"
      ADD CONSTRAINT "FK_mfi_quotation_risk"
      FOREIGN KEY ("quotation_risk_id")
      REFERENCES "quotation_risks"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_factor_values" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "quotation_risk_id" uuid,
        "factor_id" uuid NOT NULL,
        "risk_client_ref" character varying(80),
        "value_text" text,
        "value_number" numeric(18,6),
        "value_date" date,
        "value_boolean" boolean,
        "value_json" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_factor_values" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qfv_quotation_id"
      ON "quotation_factor_values" ("quotation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qfv_quotation_risk_id"
      ON "quotation_factor_values" ("quotation_risk_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qfv_factor_id"
      ON "quotation_factor_values" ("factor_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_factor_values"
      ADD CONSTRAINT "FK_qfv_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_factor_values"
      ADD CONSTRAINT "FK_qfv_quotation_risk"
      FOREIGN KEY ("quotation_risk_id")
      REFERENCES "quotation_risks"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_factor_values"
      ADD CONSTRAINT "FK_qfv_factor"
      FOREIGN KEY ("factor_id")
      REFERENCES "rating_factors"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_premium_breakdowns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "quotation_risk_id" uuid,
        "risk_client_ref" character varying(80),
        "item_type" "public"."quotation_premium_item_type_enum" NOT NULL,
        "item_code" character varying(50) NOT NULL,
        "item_name" character varying(150) NOT NULL,
        "rate" numeric(18,6) NOT NULL DEFAULT '0',
        "amount" numeric(18,2) NOT NULL DEFAULT '0',
        "calculation_base" "public"."quotation_calculation_base_enum" NOT NULL DEFAULT 'BASIC_PREMIUM',
        "calculation_order" integer NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_premium_breakdowns" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qpb_quotation_id"
      ON "quotation_premium_breakdowns" ("quotation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qpb_quotation_risk_id"
      ON "quotation_premium_breakdowns" ("quotation_risk_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_premium_breakdowns"
      ADD CONSTRAINT "FK_qpb_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_premium_breakdowns"
      ADD CONSTRAINT "FK_qpb_quotation_risk"
      FOREIGN KEY ("quotation_risk_id")
      REFERENCES "quotation_risks"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
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
      ADD CONSTRAINT "FK_quotation_addon_taxes_addon"
      FOREIGN KEY ("quotation_addon_id")
      REFERENCES "quotation_addons"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "motor_quotation_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "quotation_risk_id" uuid NOT NULL,
        "motor_vehicle_id" uuid NOT NULL,
        "risk_client_ref" character varying(80),
        "cover_type" character varying(100),
        "usage_type" character varying(100),
        "no_claim_discount_rate" numeric(12,6),
        "no_claim_discount_amount" numeric(18,2),
        "excess_applicable" boolean NOT NULL DEFAULT false,
        "excess_type" character varying(100),
        "excess_rate" numeric(12,6),
        "excess_amount" numeric(18,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_motor_quotation_details" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mqd_quotation_id"
      ON "motor_quotation_details" ("quotation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mqd_quotation_risk_id"
      ON "motor_quotation_details" ("quotation_risk_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mqd_motor_vehicle_id"
      ON "motor_quotation_details" ("motor_vehicle_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_quotation_details"
      ADD CONSTRAINT "FK_mqd_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_quotation_details"
      ADD CONSTRAINT "FK_mqd_quotation_risk"
      FOREIGN KEY ("quotation_risk_id")
      REFERENCES "quotation_risks"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_quotation_details"
      ADD CONSTRAINT "FK_mqd_motor_vehicle"
      FOREIGN KEY ("motor_vehicle_id")
      REFERENCES "motor_vehicles"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "non_motor_quotation_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "quotation_risk_id" uuid NOT NULL,
        "subject_matter_id" uuid NOT NULL,
        "risk_client_ref" character varying(80),
        "cover_description" text,
        "risk_location" text,
        "insured_value" numeric(18,2),
        "limit_of_liability" numeric(18,2),
        "tiramis_payload" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_non_motor_quotation_details" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nmqd_quotation_id"
      ON "non_motor_quotation_details" ("quotation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nmqd_quotation_risk_id"
      ON "non_motor_quotation_details" ("quotation_risk_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nmqd_subject_matter_id"
      ON "non_motor_quotation_details" ("subject_matter_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "non_motor_quotation_details"
      ADD CONSTRAINT "FK_nmqd_quotation"
      FOREIGN KEY ("quotation_id")
      REFERENCES "quotations"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "non_motor_quotation_details"
      ADD CONSTRAINT "FK_nmqd_quotation_risk"
      FOREIGN KEY ("quotation_risk_id")
      REFERENCES "quotation_risks"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "non_motor_quotation_details"
      ADD CONSTRAINT "FK_nmqd_subject_matter"
      FOREIGN KEY ("subject_matter_id")
      REFERENCES "subject_matters"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }
}
