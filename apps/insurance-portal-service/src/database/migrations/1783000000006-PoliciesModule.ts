import { MigrationInterface, QueryRunner } from "typeorm";

export class PoliciesModule1783000000006 implements MigrationInterface {
    name = 'PoliciesModule1783000000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."policy_channel_type_enum" AS ENUM('DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API')`);
        await queryRunner.query(`CREATE TYPE "public"."policy_premium_item_type_enum" AS ENUM('BASIC_PREMIUM', 'DISCOUNT', 'TAX', 'LEVY', 'CHARGE', 'COMMISSION', 'FEE')`);
        await queryRunner.query(`CREATE TYPE "public"."policy_calculation_base_enum" AS ENUM('BASIC_PREMIUM', 'NET_PREMIUM', 'GROSS_PREMIUM')`);

        await queryRunner.query(`CREATE TABLE "policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "branch_id" uuid, "department_id" uuid, "created_by" uuid, "customer_id" uuid NOT NULL, "quotation_id" uuid, "proposal_id" uuid, "category_id" uuid NOT NULL, "product_id" uuid NOT NULL, "sub_class_id" uuid, "policy_no" character varying(50) NOT NULL, "cover_note_no" character varying(50), "external_policy_no" character varying(50), "channel_type" "public"."policy_channel_type_enum" NOT NULL, "policy_status" character varying(20) NOT NULL DEFAULT 'DRAFT', "start_date" date NOT NULL, "end_date" date NOT NULL, "issue_date" date NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "basic_premium" numeric(18,2) NOT NULL DEFAULT '0', "total_discount" numeric(18,2) NOT NULL DEFAULT '0', "total_tax" numeric(18,2) NOT NULL DEFAULT '0', "total_charges" numeric(18,2) NOT NULL DEFAULT '0', "total_commission" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "net_premium" numeric(18,2) NOT NULL DEFAULT '0', "reinsurance_required" boolean NOT NULL DEFAULT false, "reinsurance_status" character varying(20) NOT NULL DEFAULT 'NOT_REQUIRED', "retention_amount" numeric(18,2) NOT NULL DEFAULT '0', "ceded_sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "ceded_premium" numeric(18,2) NOT NULL DEFAULT '0', "tira_status" character varying(20) NOT NULL DEFAULT 'PENDING', "tira_portal_transaction_id" character varying(100), "tiramis_transaction_id" character varying(100), "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_policies" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_policies_company_id" ON "policies" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_policies_company_status" ON "policies" ("company_id", "policy_status") `);
        await queryRunner.query(`CREATE INDEX "IDX_policies_company_customer_id" ON "policies" ("company_id", "customer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_policies_company_product_id" ON "policies" ("company_id", "product_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_policies_company_policy_no" ON "policies" ("company_id", "policy_no") WHERE deleted_at IS NULL`);

        await queryRunner.query(`CREATE TABLE "policy_risks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "quotation_risk_id" uuid, "risk_id" uuid NOT NULL, "subject_matter_id" uuid, "motor_vehicle_id" uuid, "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "rate" numeric(18,6) NOT NULL DEFAULT '0', "basic_premium" numeric(18,2) NOT NULL DEFAULT '0', "discount_amount" numeric(18,2) NOT NULL DEFAULT '0', "tax_amount" numeric(18,2) NOT NULL DEFAULT '0', "charges_amount" numeric(18,2) NOT NULL DEFAULT '0', "commission_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "net_premium" numeric(18,2) NOT NULL DEFAULT '0', "reinsurance_required" boolean NOT NULL DEFAULT false, "retention_amount" numeric(18,2) NOT NULL DEFAULT '0', "ceded_sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "ceded_premium" numeric(18,2) NOT NULL DEFAULT '0', "reinsurance_status" character varying(20) NOT NULL DEFAULT 'NOT_REQUIRED', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_policy_risks" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_policy_risks_policy_id" ON "policy_risks" ("policy_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_policy_risks_risk_id" ON "policy_risks" ("risk_id") `);

        await queryRunner.query(`CREATE TABLE "policy_premium_breakdowns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "policy_risk_id" uuid, "item_type" "public"."policy_premium_item_type_enum" NOT NULL, "item_code" character varying(50) NOT NULL, "item_name" character varying(150) NOT NULL, "rate" numeric(18,6) NOT NULL DEFAULT '0', "amount" numeric(18,2) NOT NULL DEFAULT '0', "calculation_base" "public"."policy_calculation_base_enum" NOT NULL DEFAULT 'BASIC_PREMIUM', "calculation_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_policy_premium_breakdowns" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ppb_policy_id" ON "policy_premium_breakdowns" ("policy_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ppb_policy_risk_id" ON "policy_premium_breakdowns" ("policy_risk_id") `);

        await queryRunner.query(`CREATE TABLE "policy_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "old_status" character varying(20) NOT NULL, "new_status" character varying(20) NOT NULL, "reason" text, "changed_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_policy_status_history" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_psh_policy_id" ON "policy_status_history" ("policy_id") `);

        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_insurer_company" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_intermediary_company" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_category" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_product" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_sub_class" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_policy_risks_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_policy_risks_quotation_risk" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_risks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_policy_risks_risk" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_policy_risks_subject_matter" FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_policy_risks_motor_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "policy_premium_breakdowns" ADD CONSTRAINT "FK_ppb_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policy_premium_breakdowns" ADD CONSTRAINT "FK_ppb_policy_risk" FOREIGN KEY ("policy_risk_id") REFERENCES "policy_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "policy_status_history" ADD CONSTRAINT "FK_psh_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "policy_status_history" ADD CONSTRAINT "FK_psh_changed_by" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "policy_status_history" DROP CONSTRAINT "FK_psh_changed_by"`);
        await queryRunner.query(`ALTER TABLE "policy_status_history" DROP CONSTRAINT "FK_psh_policy"`);
        await queryRunner.query(`ALTER TABLE "policy_premium_breakdowns" DROP CONSTRAINT "FK_ppb_policy_risk"`);
        await queryRunner.query(`ALTER TABLE "policy_premium_breakdowns" DROP CONSTRAINT "FK_ppb_policy"`);
        await queryRunner.query(`ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_policy_risks_motor_vehicle"`);
        await queryRunner.query(`ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_policy_risks_subject_matter"`);
        await queryRunner.query(`ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_policy_risks_risk"`);
        await queryRunner.query(`ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_policy_risks_quotation_risk"`);
        await queryRunner.query(`ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_policy_risks_policy"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_sub_class"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_product"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_category"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_quotation"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_customer"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_created_by"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_department"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_branch"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_intermediary_company"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_insurer_company"`);
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_company"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_psh_policy_id"`);
        await queryRunner.query(`DROP TABLE "policy_status_history"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_ppb_policy_risk_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ppb_policy_id"`);
        await queryRunner.query(`DROP TABLE "policy_premium_breakdowns"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_policy_risks_risk_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_policy_risks_policy_id"`);
        await queryRunner.query(`DROP TABLE "policy_risks"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_policies_company_policy_no"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_policies_company_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_policies_company_customer_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_policies_company_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_policies_company_id"`);
        await queryRunner.query(`DROP TABLE "policies"`);

        await queryRunner.query(`DROP TYPE "public"."policy_calculation_base_enum"`);
        await queryRunner.query(`DROP TYPE "public"."policy_premium_item_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."policy_channel_type_enum"`);
    }
}

