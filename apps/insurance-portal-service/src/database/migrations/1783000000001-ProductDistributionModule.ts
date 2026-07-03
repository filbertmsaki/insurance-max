import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductDistributionModule1783000000001 implements MigrationInterface {
    name = 'ProductDistributionModule1783000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."product_channel_type_enum" AS ENUM('DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API')`);
        await queryRunner.query(`CREATE TYPE "public"."product_commission_type_enum" AS ENUM('PERCENTAGE', 'FIXED', 'TIERED')`);
        await queryRunner.query(`CREATE TYPE "public"."product_tax_type_enum" AS ENUM('PERCENTAGE', 'FIXED')`);
        await queryRunner.query(`CREATE TYPE "public"."product_calculation_base_enum" AS ENUM('GROSS_PREMIUM', 'NET_PREMIUM', 'BASIC_PREMIUM')`);
        await queryRunner.query(`CREATE TYPE "public"."product_rule_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED')`);

        await queryRunner.query(`CREATE TABLE "product_distribution_channels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "category_id" uuid, "product_id" uuid NOT NULL, "sub_class_id" uuid, "channel_type" "public"."product_channel_type_enum" NOT NULL, "can_quote" boolean NOT NULL DEFAULT false, "can_bind" boolean NOT NULL DEFAULT false, "can_issue_policy" boolean NOT NULL DEFAULT false, "can_collect_premium" boolean NOT NULL DEFAULT false, "requires_underwriting" boolean NOT NULL DEFAULT false, "requires_insurer_approval" boolean NOT NULL DEFAULT false, "effective_from" date NOT NULL, "effective_to" date NOT NULL, "status" "public"."product_rule_status_enum" NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_product_distribution_channels" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_pdc_insurer_company_id" ON "product_distribution_channels" ("insurer_company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pdc_intermediary_company_id" ON "product_distribution_channels" ("intermediary_company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pdc_product_id" ON "product_distribution_channels" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pdc_status" ON "product_distribution_channels" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_pdc_channel_type" ON "product_distribution_channels" ("channel_type") `);

        await queryRunner.query(`CREATE TABLE "product_commission_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "category_id" uuid, "product_id" uuid NOT NULL, "risk_id" uuid, "channel_type" "public"."product_channel_type_enum" NOT NULL, "commission_type" "public"."product_commission_type_enum" NOT NULL, "commission_rate" numeric(18,6), "commission_amount" numeric(18,2), "minimum_commission" numeric(18,2), "maximum_commission" numeric(18,2), "calculation_base" "public"."product_calculation_base_enum" NOT NULL DEFAULT 'GROSS_PREMIUM', "effective_from" date NOT NULL, "effective_to" date NOT NULL, "status" "public"."product_rule_status_enum" NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_product_commission_rules" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_pcr_insurer_company_id" ON "product_commission_rules" ("insurer_company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pcr_intermediary_company_id" ON "product_commission_rules" ("intermediary_company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pcr_product_id" ON "product_commission_rules" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pcr_risk_id" ON "product_commission_rules" ("risk_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pcr_status" ON "product_commission_rules" ("status") `);

        await queryRunner.query(`CREATE TABLE "product_tax_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "category_id" uuid, "product_id" uuid, "risk_id" uuid, "tax_name" character varying(150) NOT NULL, "tax_code" character varying(50) NOT NULL, "tax_type" "public"."product_tax_type_enum" NOT NULL, "tax_rate" numeric(18,6), "tax_amount" numeric(18,2), "calculation_base" "public"."product_calculation_base_enum" NOT NULL DEFAULT 'BASIC_PREMIUM', "effective_from" date NOT NULL, "effective_to" date NOT NULL, "status" "public"."product_rule_status_enum" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_product_tax_rules" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ptr_company_id" ON "product_tax_rules" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ptr_category_id" ON "product_tax_rules" ("category_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ptr_product_id" ON "product_tax_rules" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ptr_risk_id" ON "product_tax_rules" ("risk_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ptr_status" ON "product_tax_rules" ("status") `);

        await queryRunner.query(`CREATE TABLE "product_document_requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "risk_id" uuid, "document_type" character varying(80) NOT NULL, "document_name" character varying(150) NOT NULL, "is_required" boolean NOT NULL DEFAULT false, "is_required_before_quote" boolean NOT NULL DEFAULT false, "is_required_before_policy" boolean NOT NULL DEFAULT false, "is_required_before_claim" boolean NOT NULL DEFAULT false, "status" "public"."product_rule_status_enum" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_product_document_requirements" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_pdr_company_id" ON "product_document_requirements" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pdr_product_id" ON "product_document_requirements" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pdr_risk_id" ON "product_document_requirements" ("risk_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pdr_status" ON "product_document_requirements" ("status") `);

        await queryRunner.query(`ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_pdc_insurer_company" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_pdc_intermediary_company" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_pdc_category" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_pdc_product" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_pdc_sub_class" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_pcr_insurer_company" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_pcr_intermediary_company" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_pcr_category" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_pcr_product" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_pcr_risk" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_ptr_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_ptr_category" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_ptr_product" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_ptr_risk" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "product_document_requirements" ADD CONSTRAINT "FK_pdr_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_document_requirements" ADD CONSTRAINT "FK_pdr_product" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_document_requirements" ADD CONSTRAINT "FK_pdr_risk" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_document_requirements" DROP CONSTRAINT "FK_pdr_risk"`);
        await queryRunner.query(`ALTER TABLE "product_document_requirements" DROP CONSTRAINT "FK_pdr_product"`);
        await queryRunner.query(`ALTER TABLE "product_document_requirements" DROP CONSTRAINT "FK_pdr_company"`);
        await queryRunner.query(`ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_ptr_risk"`);
        await queryRunner.query(`ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_ptr_product"`);
        await queryRunner.query(`ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_ptr_category"`);
        await queryRunner.query(`ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_ptr_company"`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_pcr_risk"`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_pcr_product"`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_pcr_category"`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_pcr_intermediary_company"`);
        await queryRunner.query(`ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_pcr_insurer_company"`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_pdc_sub_class"`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_pdc_product"`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_pdc_category"`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_pdc_intermediary_company"`);
        await queryRunner.query(`ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_pdc_insurer_company"`);

        await queryRunner.query(`DROP TABLE "product_document_requirements"`);
        await queryRunner.query(`DROP TABLE "product_tax_rules"`);
        await queryRunner.query(`DROP TABLE "product_commission_rules"`);
        await queryRunner.query(`DROP TABLE "product_distribution_channels"`);

        await queryRunner.query(`DROP TYPE "public"."product_rule_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."product_calculation_base_enum"`);
        await queryRunner.query(`DROP TYPE "public"."product_tax_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."product_commission_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."product_channel_type_enum"`);
    }
}


