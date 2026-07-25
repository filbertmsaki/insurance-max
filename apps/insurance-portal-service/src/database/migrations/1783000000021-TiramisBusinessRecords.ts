import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisBusinessRecords1783000000021 implements MigrationInterface {
  name = 'TiramisBusinessRecords1783000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_business_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "department_id" uuid,
        "created_by" uuid,

        "source_module" character varying(80) NOT NULL,
        "request_type" character varying(80) NOT NULL,
        "business_reference" character varying(150) NOT NULL,

        "policy_id" uuid,
        "customer_id" uuid,
        "motor_vehicle_id" uuid,

        "status" character varying(40) NOT NULL DEFAULT 'DRAFT',

        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "metadata" jsonb,

        "tiramis_submission_tracking_id" uuid,
        "tiramis_status" character varying(50),
        "tiramis_transaction_id" character varying(100),
        "tiramis_request_id" character varying(100),
        "tiramis_service_type" character varying(80),
        "tiramis_root_element" character varying(100),

        "tiramis_acknowledgement_status_code" character varying(20),
        "tiramis_acknowledgement_status_desc" character varying(255),

        "tiramis_final_response_id" character varying(100),
        "tiramis_final_response_status_code" character varying(20),
        "tiramis_final_response_status_desc" character varying(255),

        "tiramis_last_error_message" text,
        "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE,

        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,

        CONSTRAINT "PK_tiramis_business_records"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_tiramis_business_records_company"
          FOREIGN KEY ("company_id")
          REFERENCES "companies"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,

        CONSTRAINT "FK_tiramis_business_records_branch"
          FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION,

        CONSTRAINT "FK_tiramis_business_records_department"
          FOREIGN KEY ("department_id")
          REFERENCES "departments"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION,

        CONSTRAINT "FK_tiramis_business_records_policy"
          FOREIGN KEY ("policy_id")
          REFERENCES "policies"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION,

        CONSTRAINT "FK_tiramis_business_records_customer"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION,

        CONSTRAINT "FK_tiramis_business_records_motor_vehicle"
          FOREIGN KEY ("motor_vehicle_id")
          REFERENCES "motor_vehicles"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_business_records_company"
      ON "tiramis_business_records" ("company_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_business_records_source"
      ON "tiramis_business_records" ("source_module", "request_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_business_records_reference"
      ON "tiramis_business_records" ("business_reference")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_business_records_status"
      ON "tiramis_business_records" ("status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tiramis_business_records_active_reference"
      ON "tiramis_business_records" (
        "company_id",
        "source_module",
        "request_type",
        "business_reference"
      )
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "tiramis_business_records"
    `);
  }
}
