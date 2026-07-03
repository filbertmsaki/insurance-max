import { MigrationInterface, QueryRunner } from "typeorm";

export class NonMotorModule1783000000005 implements MigrationInterface {
    name = 'NonMotorModule1783000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "subject_matters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "subject_type" character varying(100), "subject_code" character varying(100) NOT NULL, "description" text, "location" text, "country" character varying(100), "region" character varying(100), "district" character varying(100), "ward" character varying(100), "latitude" numeric(10,6), "longitude" numeric(10,6), "value" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_subject_matters" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_subject_matters_company_id" ON "subject_matters" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_subject_matters_company_customer_id" ON "subject_matters" ("company_id", "customer_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_subject_matters_company_subject_code" ON "subject_matters" ("company_id", "subject_code") WHERE deleted_at IS NULL`);

        await queryRunner.query(`CREATE TABLE "subject_matter_factor_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subject_matter_id" uuid NOT NULL, "factor_id" uuid NOT NULL, "value_text" text, "value_number" numeric(18,6), "value_date" date, "value_boolean" boolean, "value_json" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_subject_matter_factor_values" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_smfv_subject_matter_id" ON "subject_matter_factor_values" ("subject_matter_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_smfv_factor_id" ON "subject_matter_factor_values" ("factor_id") `);

        await queryRunner.query(`CREATE TABLE "non_motor_quotation_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "quotation_risk_id" uuid NOT NULL, "subject_matter_id" uuid NOT NULL, "cover_description" text, "risk_location" text, "insured_value" numeric(18,2), "limit_of_liability" numeric(18,2), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_non_motor_quotation_details" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_nmqd_quotation_id" ON "non_motor_quotation_details" ("quotation_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_nmqd_quotation_risk_id" ON "non_motor_quotation_details" ("quotation_risk_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_nmqd_subject_matter_id" ON "non_motor_quotation_details" ("subject_matter_id") `);

        await queryRunner.query(`CREATE TABLE "non_motor_policy_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "policy_risk_id" uuid NOT NULL, "subject_matter_id" uuid NOT NULL, "cover_description" text, "risk_location" text, "insured_value" numeric(18,2), "limit_of_liability" numeric(18,2), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_non_motor_policy_details" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_nmpd_policy_id" ON "non_motor_policy_details" ("policy_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_nmpd_policy_risk_id" ON "non_motor_policy_details" ("policy_risk_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_nmpd_subject_matter_id" ON "non_motor_policy_details" ("subject_matter_id") `);

        await queryRunner.query(`ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_subject_matters_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_subject_matters_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_subject_matters_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_subject_matters_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "subject_matter_factor_values" ADD CONSTRAINT "FK_smfv_subject_matter" FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subject_matter_factor_values" ADD CONSTRAINT "FK_smfv_factor" FOREIGN KEY ("factor_id") REFERENCES "rating_factors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "non_motor_quotation_details" ADD CONSTRAINT "FK_nmqd_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "non_motor_quotation_details" ADD CONSTRAINT "FK_nmqd_quotation_risk" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "non_motor_quotation_details" ADD CONSTRAINT "FK_nmqd_subject_matter" FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "non_motor_policy_details" ADD CONSTRAINT "FK_nmpd_subject_matter" FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "non_motor_policy_details" DROP CONSTRAINT "FK_nmpd_subject_matter"`);
        await queryRunner.query(`ALTER TABLE "non_motor_quotation_details" DROP CONSTRAINT "FK_nmqd_subject_matter"`);
        await queryRunner.query(`ALTER TABLE "non_motor_quotation_details" DROP CONSTRAINT "FK_nmqd_quotation_risk"`);
        await queryRunner.query(`ALTER TABLE "non_motor_quotation_details" DROP CONSTRAINT "FK_nmqd_quotation"`);
        await queryRunner.query(`ALTER TABLE "subject_matter_factor_values" DROP CONSTRAINT "FK_smfv_factor"`);
        await queryRunner.query(`ALTER TABLE "subject_matter_factor_values" DROP CONSTRAINT "FK_smfv_subject_matter"`);
        await queryRunner.query(`ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_subject_matters_updated_by"`);
        await queryRunner.query(`ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_subject_matters_created_by"`);
        await queryRunner.query(`ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_subject_matters_customer"`);
        await queryRunner.query(`ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_subject_matters_company"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_nmpd_subject_matter_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_nmpd_policy_risk_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_nmpd_policy_id"`);
        await queryRunner.query(`DROP TABLE "non_motor_policy_details"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_nmqd_subject_matter_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_nmqd_quotation_risk_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_nmqd_quotation_id"`);
        await queryRunner.query(`DROP TABLE "non_motor_quotation_details"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_smfv_factor_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_smfv_subject_matter_id"`);
        await queryRunner.query(`DROP TABLE "subject_matter_factor_values"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_subject_matters_company_subject_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_subject_matters_company_customer_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_subject_matters_company_id"`);
        await queryRunner.query(`DROP TABLE "subject_matters"`);
    }
}

