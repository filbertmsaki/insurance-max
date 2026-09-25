import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerVersioningAndAudit1790121600000 implements MigrationInterface {
  name = 'CustomerVersioningAndAudit1790121600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "is_current_version" boolean NOT NULL DEFAULT false,
        "customer_snapshot" jsonb NOT NULL,
        "customer_snapshot_hash" character varying(64) NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_versions_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_versions_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customer_versions_number"
      ON "customer_versions" ("customer_id", "version_number")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_versions_company_customer"
      ON "customer_versions" ("company_id", "customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_versions_current"
      ON "customer_versions" ("company_id", "customer_id")
      WHERE "is_current_version" = true
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "customer_version_id" uuid,
        "action" character varying(30) NOT NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "fields_changed" jsonb,
        "user_id" uuid,
        "user_name" character varying(180),
        "ip_address" character varying(64),
        "source" character varying(40) NOT NULL DEFAULT 'ADMIN_PORTAL',
        "related_record_type" character varying(40),
        "related_record_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_audit_logs_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_audit_logs_version" FOREIGN KEY ("customer_version_id") REFERENCES "customer_versions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_customer_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_audit_logs_company_customer"
      ON "customer_audit_logs" ("company_id", "customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_audit_logs_version"
      ON "customer_audit_logs" ("customer_version_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_policy_holders"
      ADD COLUMN IF NOT EXISTS "customer_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_policy_holders"
      ADD CONSTRAINT "FK_qph_customer_version"
      FOREIGN KEY ("customer_version_id") REFERENCES "customer_versions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qph_customer_version_id"
      ON "quotation_policy_holders" ("customer_version_id")
    `);

    await queryRunner.query(`
      INSERT INTO "customer_versions" (
        "company_id",
        "customer_id",
        "version_number",
        "is_current_version",
        "customer_snapshot",
        "customer_snapshot_hash",
        "created_by",
        "created_at"
      )
      SELECT
        c."company_id",
        c."id",
        1,
        true,
        jsonb_build_object(
          'customerId', c."id",
          'customerNumber', c."customer_no",
          'customerType', c."customer_type",
          'displayName', c."display_name",
          'firstName', c."first_name",
          'middleName', c."middle_name",
          'lastName', c."last_name",
          'companyName', c."company_name",
          'gender', c."gender",
          'dateOfBirth', c."date_of_birth",
          'policyHolderType', c."policy_holder_type",
          'primaryIdType', c."id_type",
          'primaryIdNumber', c."id_number",
          'countryCode', c."country_code",
          'region', c."region",
          'district', c."district",
          'street', c."street",
          'phone', c."phone",
          'fax', c."fax",
          'postalAddress', c."postal_address",
          'email', c."email",
          'status', c."status",
          'createdAt', c."created_at",
          'updatedAt', c."updated_at"
        ),
        md5(c."id"::text || ':' || coalesce(c."updated_at"::text, '')),
        c."created_by",
        c."created_at"
      FROM "customers" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "customer_versions" cv
        WHERE cv."customer_id" = c."id" AND cv."version_number" = 1
      )
    `);

    await queryRunner.query(`
      UPDATE "quotation_policy_holders" qph
      SET "customer_version_id" = cv."id"
      FROM "customer_versions" cv
      WHERE qph."customer_id" = cv."customer_id"
        AND cv."version_number" = 1
        AND qph."customer_version_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_qph_customer_version_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotation_policy_holders"
      DROP CONSTRAINT IF EXISTS "FK_qph_customer_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_policy_holders"
      DROP COLUMN IF EXISTS "customer_version_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_versions"`);
  }
}
