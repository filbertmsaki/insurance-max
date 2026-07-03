import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuotationsModule1783000000003 implements MigrationInterface {
  name = 'QuotationsModule1783000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_type_enum" AS ENUM('MOTOR', 'NON_MOTOR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_channel_type_enum" AS ENUM('DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_status_enum" AS ENUM('DRAFT', 'RATED', 'REFERRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_premium_item_type_enum" AS ENUM('BASIC_PREMIUM', 'DISCOUNT', 'TAX', 'LEVY', 'CHARGE', 'COMMISSION', 'FEE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_calculation_base_enum" AS ENUM('BASIC_PREMIUM', 'NET_PREMIUM', 'GROSS_PREMIUM')`,
    );

    await queryRunner.query(
      `CREATE TABLE "quotations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "branch_id" uuid, "department_id" uuid, "created_by" uuid, "customer_id" uuid NOT NULL, "category_id" uuid NOT NULL, "product_id" uuid NOT NULL, "sub_class_id" uuid, "quotation_no" character varying(30) NOT NULL, "quotation_type" "public"."quotation_type_enum" NOT NULL, "channel_type" "public"."quotation_channel_type_enum" NOT NULL, "status" "public"."quotation_status_enum" NOT NULL DEFAULT 'DRAFT', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "basic_premium" numeric(18,2) NOT NULL DEFAULT '0', "total_discount" numeric(18,2) NOT NULL DEFAULT '0', "total_tax" numeric(18,2) NOT NULL DEFAULT '0', "total_charges" numeric(18,2) NOT NULL DEFAULT '0', "total_commission" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "net_premium" numeric(18,2) NOT NULL DEFAULT '0', "valid_from" date NOT NULL, "valid_until" date NOT NULL, "rating_version" character varying(50), "rating_metadata" jsonb, "rejection_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_quotations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_id" ON "quotations" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_status" ON "quotations" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_customer_id" ON "quotations" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_product_id" ON "quotations" ("company_id", "product_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_quotations_company_quotation_no" ON "quotations" ("company_id", "quotation_no") WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "quotation_risks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "risk_id" uuid NOT NULL, "subject_matter_id" uuid, "motor_vehicle_id" uuid, "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "rate" numeric(18,6) NOT NULL DEFAULT '0', "fixed_amount" numeric(18,2) NOT NULL DEFAULT '0', "basic_premium" numeric(18,2) NOT NULL DEFAULT '0', "discount_amount" numeric(18,2) NOT NULL DEFAULT '0', "tax_amount" numeric(18,2) NOT NULL DEFAULT '0', "charges_amount" numeric(18,2) NOT NULL DEFAULT '0', "commission_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "net_premium" numeric(18,2) NOT NULL DEFAULT '0', "rating_rule_id" uuid, "rating_result_metadata" jsonb, "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_quotation_risks" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotation_risks_quotation_id" ON "quotation_risks" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotation_risks_risk_id" ON "quotation_risks" ("risk_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "quotation_factor_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "quotation_risk_id" uuid, "factor_id" uuid NOT NULL, "value_text" text, "value_number" numeric(18,6), "value_date" date, "value_boolean" boolean, "value_json" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_quotation_factor_values" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qfv_quotation_id" ON "quotation_factor_values" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qfv_quotation_risk_id" ON "quotation_factor_values" ("quotation_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qfv_factor_id" ON "quotation_factor_values" ("factor_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "quotation_premium_breakdowns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "quotation_risk_id" uuid, "item_type" "public"."quotation_premium_item_type_enum" NOT NULL, "item_code" character varying(50) NOT NULL, "item_name" character varying(150) NOT NULL, "rate" numeric(18,6) NOT NULL DEFAULT '0', "amount" numeric(18,2) NOT NULL DEFAULT '0', "calculation_base" "public"."quotation_calculation_base_enum" NOT NULL DEFAULT 'BASIC_PREMIUM', "calculation_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_quotation_premium_breakdowns" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qpb_quotation_id" ON "quotation_premium_breakdowns" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qpb_quotation_risk_id" ON "quotation_premium_breakdowns" ("quotation_risk_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "quotation_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "old_status" "public"."quotation_status_enum" NOT NULL, "new_status" "public"."quotation_status_enum" NOT NULL, "reason" text, "changed_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_quotation_status_history" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qsh_quotation_id" ON "quotation_status_history" ("quotation_id") `,
    );

    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_insurer_company" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_intermediary_company" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_category" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_product" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_quotations_sub_class" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "quotation_risks" ADD CONSTRAINT "FK_quotation_risks_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risks" ADD CONSTRAINT "FK_quotation_risks_risk" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "quotation_factor_values" ADD CONSTRAINT "FK_qfv_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_factor_values" ADD CONSTRAINT "FK_qfv_quotation_risk" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_factor_values" ADD CONSTRAINT "FK_qfv_factor" FOREIGN KEY ("factor_id") REFERENCES "rating_factors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "quotation_premium_breakdowns" ADD CONSTRAINT "FK_qpb_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_premium_breakdowns" ADD CONSTRAINT "FK_qpb_quotation_risk" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" ADD CONSTRAINT "FK_qsh_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" ADD CONSTRAINT "FK_qsh_changed_by" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" DROP CONSTRAINT "FK_qsh_changed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" DROP CONSTRAINT "FK_qsh_quotation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_premium_breakdowns" DROP CONSTRAINT "FK_qpb_quotation_risk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_premium_breakdowns" DROP CONSTRAINT "FK_qpb_quotation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_factor_values" DROP CONSTRAINT "FK_qfv_factor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_factor_values" DROP CONSTRAINT "FK_qfv_quotation_risk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_factor_values" DROP CONSTRAINT "FK_qfv_quotation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risks" DROP CONSTRAINT "FK_quotation_risks_risk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risks" DROP CONSTRAINT "FK_quotation_risks_quotation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_sub_class"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_department"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_intermediary_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_insurer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_quotations_company"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_qsh_quotation_id"`);
    await queryRunner.query(`DROP TABLE "quotation_status_history"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_qpb_quotation_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qpb_quotation_id"`);
    await queryRunner.query(`DROP TABLE "quotation_premium_breakdowns"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_qfv_factor_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qfv_quotation_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qfv_quotation_id"`);
    await queryRunner.query(`DROP TABLE "quotation_factor_values"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotation_risks_risk_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotation_risks_quotation_id"`,
    );
    await queryRunner.query(`DROP TABLE "quotation_risks"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_quotation_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_product_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_quotations_company_id"`);
    await queryRunner.query(`DROP TABLE "quotations"`);

    await queryRunner.query(
      `DROP TYPE "public"."quotation_calculation_base_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."quotation_premium_item_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."quotation_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quotation_channel_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quotation_type_enum"`);
  }
}
