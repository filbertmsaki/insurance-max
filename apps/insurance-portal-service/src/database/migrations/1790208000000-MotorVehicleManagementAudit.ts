import { MigrationInterface, QueryRunner } from 'typeorm';

export class MotorVehicleManagementAudit1790208000000 implements MigrationInterface {
  name = 'MotorVehicleManagementAudit1790208000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "verification_status" character varying(40) NOT NULL DEFAULT 'NOT_VERIFIED',
      ADD COLUMN IF NOT EXISTS "verification_source" character varying(40),
      ADD COLUMN IF NOT EXISTS "tira_request_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "tira_response_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "tira_vehicle_reference" character varying(100),
      ADD COLUMN IF NOT EXISTS "verification_error" text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "motor_vehicle_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "motor_vehicle_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "is_current_version" boolean NOT NULL DEFAULT false,
        "vehicle_snapshot" jsonb NOT NULL,
        "vehicle_snapshot_hash" character varying(64) NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_motor_vehicle_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_motor_vehicle_versions_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_motor_vehicle_versions_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_motor_vehicle_versions_number"
      ON "motor_vehicle_versions" ("motor_vehicle_id", "version_number")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_motor_vehicle_versions_company_vehicle"
      ON "motor_vehicle_versions" ("company_id", "motor_vehicle_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_motor_vehicle_versions_current"
      ON "motor_vehicle_versions" ("company_id", "motor_vehicle_id")
      WHERE "is_current_version" = true
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "motor_vehicle_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "motor_vehicle_id" uuid NOT NULL,
        "motor_vehicle_version_id" uuid,
        "customer_id" uuid,
        "action" character varying(40) NOT NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "fields_changed" jsonb,
        "user_id" uuid,
        "ip_address" character varying(64),
        "source" character varying(40) NOT NULL DEFAULT 'ADMIN_PORTAL',
        "related_record_type" character varying(40),
        "related_record_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_motor_vehicle_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_motor_vehicle_audit_logs_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_motor_vehicle_audit_logs_version" FOREIGN KEY ("motor_vehicle_version_id") REFERENCES "motor_vehicle_versions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_motor_vehicle_audit_logs_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_motor_vehicle_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_motor_vehicle_audit_logs_company_vehicle"
      ON "motor_vehicle_audit_logs" ("company_id", "motor_vehicle_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_motor_vehicle_audit_logs_version"
      ON "motor_vehicle_audit_logs" ("motor_vehicle_version_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_motor_details"
      ADD COLUMN IF NOT EXISTS "motor_vehicle_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      ADD COLUMN IF NOT EXISTS "motor_vehicle_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_motor_details"
      ADD CONSTRAINT "FK_qmd_motor_vehicle_version"
      FOREIGN KEY ("motor_vehicle_version_id") REFERENCES "motor_vehicle_versions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      ADD CONSTRAINT "FK_mpd_motor_vehicle_version"
      FOREIGN KEY ("motor_vehicle_version_id") REFERENCES "motor_vehicle_versions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qmd_motor_vehicle_version_id"
      ON "quotation_motor_details" ("motor_vehicle_version_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mpd_motor_vehicle_version_id"
      ON "motor_policy_details" ("motor_vehicle_version_id")
    `);

    await queryRunner.query(`
      INSERT INTO "motor_vehicle_versions" (
        "company_id",
        "motor_vehicle_id",
        "version_number",
        "is_current_version",
        "vehicle_snapshot",
        "vehicle_snapshot_hash",
        "created_by",
        "created_at"
      )
      SELECT
        v."company_id",
        v."id",
        1,
        true,
        jsonb_build_object(
          'vehicleId', v."id",
          'customerId', v."customer_id",
          'registrationNo', v."registration_no",
          'registrationNoNormalized', v."registration_no_normalized",
          'chassisNo', v."chassis_no",
          'chassisNoNormalized', v."chassis_no_normalized",
          'engineNo', v."engine_no",
          'make', v."make",
          'model', v."model",
          'modelNo', v."model_no",
          'bodyType', v."body_type",
          'color', v."color",
          'manufactureYear', v."manufacture_year",
          'fuelType', v."fuel_type",
          'motorCategory', v."motor_category",
          'motorType', v."motor_type",
          'motorUsage', v."motor_usage",
          'ownerName', v."owner_name",
          'ownerCategory', v."owner_category",
          'ownerAddress', v."owner_address",
          'status', v."status",
          'createdAt', v."created_at",
          'updatedAt', v."updated_at"
        ),
        md5(v."id"::text || ':' || coalesce(v."updated_at"::text, '')),
        v."created_by",
        v."created_at"
      FROM "motor_vehicles" v
      WHERE NOT EXISTS (
        SELECT 1 FROM "motor_vehicle_versions" mvv
        WHERE mvv."motor_vehicle_id" = v."id" AND mvv."version_number" = 1
      )
    `);

    await queryRunner.query(`
      UPDATE "motor_policy_details" mpd
      SET "motor_vehicle_version_id" = mvv."id"
      FROM "motor_vehicle_versions" mvv
      WHERE mpd."motor_vehicle_id" = mvv."motor_vehicle_id"
        AND mvv."version_number" = 1
        AND mpd."motor_vehicle_version_id" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "quotation_motor_details" qmd
      SET "motor_vehicle_version_id" = mvv."id"
      FROM "quotation_cover_note_entries" entry
      JOIN "quotation_cover_notes" cover_note ON cover_note."id" = entry."cover_note_id"
      JOIN "quotations" quotation ON quotation."id" = cover_note."quotation_id"
      JOIN "quotation_policy_holders" holder
        ON holder."quotation_id" = quotation."id" AND holder."sequence_no" = 1
      JOIN "motor_vehicles" vehicle
        ON vehicle."customer_id" = holder."customer_id"
      JOIN "motor_vehicle_versions" mvv
        ON mvv."motor_vehicle_id" = vehicle."id" AND mvv."version_number" = 1
      WHERE qmd."entry_id" = entry."id"
        AND qmd."motor_vehicle_version_id" IS NULL
        AND (
          (qmd."registration_number" IS NOT NULL AND vehicle."registration_no_normalized" = regexp_replace(upper(qmd."registration_number"), '[^A-Z0-9]', '', 'g'))
          OR (qmd."chassis_number" IS NOT NULL AND vehicle."chassis_no_normalized" = regexp_replace(upper(qmd."chassis_number"), '[^A-Z0-9]', '', 'g'))
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mpd_motor_vehicle_version_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_qmd_motor_vehicle_version_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      DROP CONSTRAINT IF EXISTS "FK_mpd_motor_vehicle_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_motor_details"
      DROP CONSTRAINT IF EXISTS "FK_qmd_motor_vehicle_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      DROP COLUMN IF EXISTS "motor_vehicle_version_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_motor_details"
      DROP COLUMN IF EXISTS "motor_vehicle_version_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "motor_vehicle_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "motor_vehicle_versions"`);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      DROP COLUMN IF EXISTS "verification_error",
      DROP COLUMN IF EXISTS "tira_vehicle_reference",
      DROP COLUMN IF EXISTS "last_verified_at",
      DROP COLUMN IF EXISTS "tira_response_id",
      DROP COLUMN IF EXISTS "tira_request_id",
      DROP COLUMN IF EXISTS "verification_source",
      DROP COLUMN IF EXISTS "verification_status",
      DROP COLUMN IF EXISTS "is_verified"
    `);
  }
}
