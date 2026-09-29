import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Non-Motor risk schemas (additive only).
 *
 * - `product_risk_fields`: the risk fields a non-motor product (optionally a
 *   sub-class) captures, so the Non-Motor wizard renders class-specific forms
 *   from configuration instead of hard-coded screens.
 * - `quotation_non_motor_details`: the captured risk data for a quotation,
 *   with a snapshot of the schema it was captured against. One row per
 *   quotation (entries are rebuilt on every draft save, quotations are not).
 */
export class NonMotorRiskSchemas1790900000000 implements MigrationInterface {
  name = 'NonMotorRiskSchemas1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_risk_fields" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "sub_class_id" uuid,
        "field_key" character varying(80) NOT NULL,
        "label" character varying(150) NOT NULL,
        "data_type" character varying(20) NOT NULL,
        "section" character varying(80),
        "options" jsonb,
        "is_required" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "help_text" character varying(255),
        "validation_rules" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_product_risk_fields" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_product_risk_fields_data_type" CHECK ("data_type" IN (
          'TEXT', 'TEXTAREA', 'NUMBER', 'INTEGER', 'DECIMAL', 'CURRENCY',
          'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT'
        )),
        CONSTRAINT "CHK_product_risk_fields_key" CHECK ("field_key" ~ '^[a-z][a-z0-9_]*$'),
        CONSTRAINT "FK_product_risk_fields_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_risk_fields_product" FOREIGN KEY ("product_id")
          REFERENCES "insurance_products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_risk_fields_sub_class" FOREIGN KEY ("sub_class_id")
          REFERENCES "insurance_sub_classes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_risk_fields_key"
      ON "product_risk_fields" (
        "product_id",
        COALESCE("sub_class_id", '00000000-0000-0000-0000-000000000000'::uuid),
        "field_key"
      )
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_risk_fields_company_product"
      ON "product_risk_fields" ("company_id", "product_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_non_motor_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "quotation_id" uuid NOT NULL,
        "product_id" uuid,
        "sub_class_id" uuid,
        "risk_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "schema_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "risk_location" character varying(255),
        "limit_of_liability" numeric(18,2),
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_non_motor_details" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quotation_non_motor_details_quotation" UNIQUE ("quotation_id"),
        CONSTRAINT "FK_quotation_non_motor_details_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quotation_non_motor_details_quotation" FOREIGN KEY ("quotation_id")
          REFERENCES "quotations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quotation_non_motor_details"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_risk_fields_company_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_product_risk_fields_key"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_risk_fields"`);
  }
}
