import { MigrationInterface, QueryRunner } from 'typeorm';

export class MotorModule1783000000004 implements MigrationInterface {
  name = 'MotorModule1783000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "motor_vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "registration_no" character varying(50), "chassis_no" character varying(50), "engine_no" character varying(50), "make" character varying(100), "model" character varying(100), "body_type" character varying(100), "color" character varying(50), "manufacture_year" smallint, "usage_type" character varying(100), "vehicle_category" character varying(100), "seating_capacity" integer, "tonnage" numeric(12,2), "cubic_capacity" integer, "fuel_type" character varying(50), "vehicle_value" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_motor_vehicles" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_vehicles_company_id" ON "motor_vehicles" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_vehicles_company_customer_id" ON "motor_vehicles" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_vehicles_company_registration_no" ON "motor_vehicles" ("company_id", "registration_no") WHERE deleted_at IS NULL AND registration_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_vehicles_company_chassis_no" ON "motor_vehicles" ("company_id", "chassis_no") WHERE deleted_at IS NULL AND chassis_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_vehicles_company_engine_no" ON "motor_vehicles" ("company_id", "engine_no") WHERE deleted_at IS NULL AND engine_no IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "motor_quotation_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "quotation_risk_id" uuid NOT NULL, "motor_vehicle_id" uuid NOT NULL, "cover_type" character varying(100), "usage_type" character varying(100), "no_claim_discount_rate" numeric(12,6), "no_claim_discount_amount" numeric(18,2), "excess_applicable" boolean NOT NULL DEFAULT false, "excess_type" character varying(100), "excess_rate" numeric(12,6), "excess_amount" numeric(18,2), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_motor_quotation_details" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mqd_quotation_id" ON "motor_quotation_details" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mqd_quotation_risk_id" ON "motor_quotation_details" ("quotation_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mqd_motor_vehicle_id" ON "motor_quotation_details" ("motor_vehicle_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "motor_fleets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "quotation_id" uuid, "policy_id" uuid, "fleet_no" character varying(50) NOT NULL, "fleet_name" character varying(150), "total_vehicles" integer NOT NULL DEFAULT '0', "total_sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_motor_fleets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_fleets_company_id" ON "motor_fleets" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_fleets_company_customer_id" ON "motor_fleets" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_fleets_company_fleet_no" ON "motor_fleets" ("company_id", "fleet_no") WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "motor_fleet_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fleet_id" uuid NOT NULL, "motor_vehicle_id" uuid NOT NULL, "quotation_risk_id" uuid, "policy_risk_id" uuid, "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "premium" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_motor_fleet_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mfi_fleet_id" ON "motor_fleet_items" ("fleet_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mfi_motor_vehicle_id" ON "motor_fleet_items" ("motor_vehicle_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mfi_quotation_risk_id" ON "motor_fleet_items" ("quotation_risk_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "motor_policy_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "policy_risk_id" uuid NOT NULL, "motor_vehicle_id" uuid NOT NULL, "cover_type" character varying(100), "usage_type" character varying(100), "certificate_no" character varying(100), "sticker_no" character varying(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_motor_policy_details" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mpd_policy_id" ON "motor_policy_details" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mpd_policy_risk_id" ON "motor_policy_details" ("policy_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mpd_motor_vehicle_id" ON "motor_policy_details" ("motor_vehicle_id") `,
    );

    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_motor_vehicles_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_motor_vehicles_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_motor_vehicles_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_motor_vehicles_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "motor_quotation_details" ADD CONSTRAINT "FK_mqd_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_quotation_details" ADD CONSTRAINT "FK_mqd_quotation_risk" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_quotation_details" ADD CONSTRAINT "FK_mqd_motor_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "motor_fleets" ADD CONSTRAINT "FK_motor_fleets_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" ADD CONSTRAINT "FK_motor_fleets_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" ADD CONSTRAINT "FK_motor_fleets_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" ADD CONSTRAINT "FK_mfi_fleet" FOREIGN KEY ("fleet_id") REFERENCES "motor_fleets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" ADD CONSTRAINT "FK_mfi_motor_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" ADD CONSTRAINT "FK_mfi_quotation_risk" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_risks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD CONSTRAINT "FK_mpd_motor_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP CONSTRAINT "FK_mpd_motor_vehicle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" DROP CONSTRAINT "FK_mfi_quotation_risk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" DROP CONSTRAINT "FK_mfi_motor_vehicle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" DROP CONSTRAINT "FK_mfi_fleet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" DROP CONSTRAINT "FK_motor_fleets_quotation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" DROP CONSTRAINT "FK_motor_fleets_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" DROP CONSTRAINT "FK_motor_fleets_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_quotation_details" DROP CONSTRAINT "FK_mqd_motor_vehicle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_quotation_details" DROP CONSTRAINT "FK_mqd_quotation_risk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_quotation_details" DROP CONSTRAINT "FK_mqd_quotation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_motor_vehicles_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_motor_vehicles_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_motor_vehicles_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_motor_vehicles_company"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_mpd_motor_vehicle_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mpd_policy_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mpd_policy_id"`);
    await queryRunner.query(`DROP TABLE "motor_policy_details"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_mfi_quotation_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mfi_motor_vehicle_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mfi_fleet_id"`);
    await queryRunner.query(`DROP TABLE "motor_fleet_items"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_fleets_company_fleet_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_fleets_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_fleets_company_id"`,
    );
    await queryRunner.query(`DROP TABLE "motor_fleets"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_mqd_motor_vehicle_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mqd_quotation_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mqd_quotation_id"`);
    await queryRunner.query(`DROP TABLE "motor_quotation_details"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_engine_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_chassis_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_registration_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_id"`,
    );
    await queryRunner.query(`DROP TABLE "motor_vehicles"`);
  }
}
