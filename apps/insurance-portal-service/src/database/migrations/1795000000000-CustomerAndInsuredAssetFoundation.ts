import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerAndInsuredAssetFoundation1795000000000 implements MigrationInterface {
  name = 'CustomerAndInsuredAssetFoundation1795000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      ALTER TYPE "customer_kyc_status_enum"
      ADD VALUE IF NOT EXISTS 'IN_REVIEW'
    `);
    await queryRunner.query(`
      ALTER TYPE "customer_kyc_status_enum"
      ADD VALUE IF NOT EXISTS 'REQUIRES_UPDATE'
    `);
    await queryRunner.query(`
      ALTER TYPE "customer_kyc_status_enum"
      ADD VALUE IF NOT EXISTS 'EXPIRED'
    `);
    await queryRunner.query(`
      ALTER TYPE "customer_status_enum"
      ADD VALUE IF NOT EXISTS 'MERGED'
    `);

    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "display_name" character varying(180),
      ADD COLUMN IF NOT EXISTS "identity_fingerprint" character varying(64),
      ADD COLUMN IF NOT EXISTS "kyc_version" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "kyc_verified_by" uuid,
      ADD COLUMN IF NOT EXISTS "kyc_verified_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "kyc_expires_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "kyc_rejection_reason" text,
      ADD COLUMN IF NOT EXISTS "merged_into_customer_id" uuid,
      ADD COLUMN IF NOT EXISTS "data_source" character varying(30) NOT NULL DEFAULT 'MANUAL'
    `);

    await queryRunner.query(`
      UPDATE "customers"
      SET
        "display_name" = COALESCE(
          NULLIF(
            trim(
              CASE
                WHEN "customer_type" = 'INDIVIDUAL'
                THEN concat_ws(' ', "first_name", "middle_name", "last_name")
                ELSE COALESCE("company_name", "customer_no")
              END
            ),
            ''
          ),
          "customer_no"
        ),
        "identity_fingerprint" = COALESCE(
          "identity_fingerprint",
          encode(
            digest(
              "company_id"::text || '|' ||
              COALESCE("id_type"::text, '') || '|' ||
              upper(regexp_replace(COALESCE("id_number", ''), '[^A-Za-z0-9]', '', 'g')),
              'sha256'
            ),
            'hex'
          )
        )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customers_identity_fingerprint"
      ON "customers" ("company_id", "identity_fingerprint")
      WHERE "deleted_at" IS NULL AND "merged_into_customer_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
      DROP CONSTRAINT IF EXISTS "FK_customers_merged_into"
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD CONSTRAINT "FK_customers_merged_into"
      FOREIGN KEY ("merged_into_customer_id")
      REFERENCES "customers"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_identifiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "identifier_type" character varying(50) NOT NULL,
        "identifier_value" character varying(150) NOT NULL,
        "normalized_value" character varying(150) NOT NULL,
        "fingerprint" character varying(64) NOT NULL,
        "country_code" character varying(3),
        "is_primary" boolean NOT NULL DEFAULT false,
        "is_verified" boolean NOT NULL DEFAULT false,
        "verified_by" uuid,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "issued_at" date,
        "expires_at" date,
        "source" character varying(30) NOT NULL DEFAULT 'MANUAL',
        "metadata" jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_customer_identifiers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_identifiers_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_identifiers_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customer_identifier_company_type_value"
      ON "customer_identifiers" ("company_id", "identifier_type", "fingerprint")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customer_identifier_primary"
      ON "customer_identifiers" ("customer_id")
      WHERE "is_primary" = true AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "customer_identifiers" (
        "company_id", "customer_id", "identifier_type", "identifier_value",
        "normalized_value", "fingerprint", "country_code", "is_primary",
        "is_verified", "source", "created_by", "updated_by", "created_at", "updated_at"
      )
      SELECT
        c."company_id",
        c."id",
        COALESCE(c."id_type"::text, 'OTHER'),
        c."id_number",
        upper(regexp_replace(c."id_number", '[^A-Za-z0-9]', '', 'g')),
        encode(
          digest(
            c."company_id"::text || '|' ||
            COALESCE(c."id_type"::text, 'OTHER') || '|' ||
            upper(regexp_replace(c."id_number", '[^A-Za-z0-9]', '', 'g')),
            'sha256'
          ),
          'hex'
        ),
        c."country_code",
        true,
        c."document_verified",
        'LEGACY',
        c."created_by",
        c."updated_by",
        c."created_at",
        c."updated_at"
      FROM "customers" c
      WHERE c."id_number" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_addresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "address_type" character varying(40) NOT NULL,
        "country_code" character varying(3) NOT NULL,
        "country" character varying(100),
        "region" character varying(100) NOT NULL,
        "district" character varying(100) NOT NULL,
        "ward" character varying(100),
        "street" character varying(150),
        "postal_address" character varying(150),
        "latitude" numeric(10,6),
        "longitude" numeric(10,6),
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_customer_addresses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_addresses_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_addresses_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customer_address_primary"
      ON "customer_addresses" ("customer_id")
      WHERE "is_primary" = true AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "customer_addresses" (
        "company_id", "customer_id", "address_type", "country_code", "country",
        "region", "district", "ward", "street", "postal_address",
        "latitude", "longitude", "is_primary", "created_by", "updated_by",
        "created_at", "updated_at"
      )
      SELECT
        "company_id", "id", 'PHYSICAL', "country_code", "country",
        "region", "district", "ward", "street", "postal_address",
        "latitude", "longitude", true, "created_by", "updated_by",
        "created_at", "updated_at"
      FROM "customers"
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_contacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "contact_type" character varying(30) NOT NULL,
        "label" character varying(80),
        "contact_name" character varying(150),
        "contact_role" character varying(100),
        "value" character varying(180) NOT NULL,
        "normalized_value" character varying(180) NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "is_verified" boolean NOT NULL DEFAULT false,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_customer_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_contacts_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_contacts_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_contacts_lookup"
      ON "customer_contacts" ("company_id", "contact_type", "normalized_value")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customer_primary_contact_type"
      ON "customer_contacts" ("customer_id", "contact_type")
      WHERE "is_primary" = true AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "customer_contacts" (
        "company_id", "customer_id", "contact_type", "label",
        "contact_name", "contact_role", "value", "normalized_value",
        "is_primary", "created_by", "updated_by", "created_at", "updated_at"
      )
      SELECT
        "company_id", "id", 'PHONE', 'Primary phone',
        NULL, NULL, "phone", regexp_replace("phone", '[\\s()-]', '', 'g'),
        true, "created_by", "updated_by", "created_at", "updated_at"
      FROM "customers"
      WHERE "phone" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "customer_contacts" (
        "company_id", "customer_id", "contact_type", "label",
        "contact_name", "contact_role", "value", "normalized_value",
        "is_primary", "created_by", "updated_by", "created_at", "updated_at"
      )
      SELECT
        "company_id", "id", 'EMAIL', 'Primary email',
        NULL, NULL, "email", lower(trim("email")),
        true, "created_by", "updated_by", "created_at", "updated_at"
      FROM "customers"
      WHERE "email" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "document_type" character varying(50) NOT NULL,
        "document_number" character varying(150),
        "storage_document_id" uuid,
        "original_file_name" character varying(255),
        "file_url" character varying(500),
        "mime_type" character varying(100),
        "checksum" character varying(64),
        "status" character varying(30) NOT NULL DEFAULT 'PENDING',
        "issued_at" date,
        "expires_at" date,
        "verified_by" uuid,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "rejection_reason" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_customer_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_documents_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_documents_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_documents_customer"
      ON "customer_documents" ("customer_id", "document_type")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "customer_documents" (
        "company_id", "customer_id", "document_type", "document_number",
        "original_file_name", "file_url", "mime_type", "status",
        "verified_by", "verified_at", "created_by", "updated_by",
        "created_at", "updated_at"
      )
      SELECT
        "company_id", "id", COALESCE("document_type"::text, 'OTHER'),
        "document_no", "document_file_name", "document_file_url",
        "document_mime_type",
        CASE WHEN "document_verified" = true THEN 'VERIFIED' ELSE 'PENDING' END,
        "document_verified_by", "document_verified_at", "created_by", "updated_by",
        "created_at", "updated_at"
      FROM "customers"
      WHERE
        "document_type" IS NOT NULL
        OR "document_no" IS NOT NULL
        OR "document_file_url" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_kyc_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "kyc_version" integer NOT NULL,
        "status" character varying(30) NOT NULL,
        "submitted_by" uuid,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "decision_reason" text,
        "snapshot" jsonb NOT NULL,
        "snapshot_hash" character varying(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_kyc_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_kyc_reviews_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_kyc_reviews_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customer_kyc_review_version"
      ON "customer_kyc_reviews" ("customer_id", "kyc_version")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insured_assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "asset_number" character varying(50) NOT NULL,
        "asset_type" character varying(40) NOT NULL,
        "customer_id" uuid NOT NULL,
        "owner_customer_id" uuid NOT NULL,
        "display_name" character varying(180) NOT NULL,
        "ownership_type" character varying(30) NOT NULL DEFAULT 'OWNED',
        "declared_value" numeric(20,4) NOT NULL DEFAULT 0,
        "currency_code" character varying(10) NOT NULL DEFAULT 'TZS',
        "status" character varying(30) NOT NULL DEFAULT 'ACTIVE',
        "data_source" character varying(30) NOT NULL DEFAULT 'MANUAL',
        "verification_status" character varying(30) NOT NULL DEFAULT 'NOT_VERIFIED',
        "verification_reference" character varying(100),
        "snapshot_version" integer NOT NULL DEFAULT 1,
        "current_snapshot" jsonb,
        "current_snapshot_hash" character varying(64),
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_insured_assets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_insured_assets_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_insured_assets_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_insured_assets_owner_customer" FOREIGN KEY ("owner_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_insured_assets_company_number"
      ON "insured_assets" ("company_id", "asset_number")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_insured_assets_customer"
      ON "insured_assets" ("company_id", "customer_id", "asset_type")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      ADD COLUMN IF NOT EXISTS "insured_asset_id" uuid,
      ADD COLUMN IF NOT EXISTS "registration_no_normalized" character varying(50),
      ADD COLUMN IF NOT EXISTS "chassis_no_normalized" character varying(100),
      ADD COLUMN IF NOT EXISTS "snapshot_version" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      UPDATE "motor_vehicles"
      SET
        "registration_no_normalized" = NULLIF(upper(regexp_replace(COALESCE("registration_no", ''), '[^A-Za-z0-9]', '', 'g')), ''),
        "chassis_no_normalized" = NULLIF(upper(regexp_replace(COALESCE("chassis_no", ''), '[^A-Za-z0-9]', '', 'g')), '')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_motor_vehicles_normalized_registration"
      ON "motor_vehicles" ("company_id", "registration_no_normalized")
      WHERE "deleted_at" IS NULL AND "registration_no_normalized" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_motor_vehicles_normalized_chassis"
      ON "motor_vehicles" ("company_id", "chassis_no_normalized")
      WHERE "deleted_at" IS NULL AND "chassis_no_normalized" IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "insured_assets" (
        "company_id", "asset_number", "asset_type", "customer_id",
        "owner_customer_id", "display_name", "declared_value",
        "currency_code", "status", "data_source", "created_by", "updated_by",
        "created_at", "updated_at"
      )
      SELECT
        vehicle."company_id",
        'MV-' || vehicle."id"::text,
        'MOTOR_VEHICLE',
        vehicle."customer_id",
        vehicle."customer_id",
        COALESCE(vehicle."registration_no", vehicle."chassis_no", 'Motor vehicle'),
        vehicle."vehicle_value",
        vehicle."currency",
        vehicle."status",
        'LEGACY',
        vehicle."created_by",
        vehicle."updated_by",
        vehicle."created_at",
        vehicle."updated_at"
      FROM "motor_vehicles" vehicle
      WHERE vehicle."insured_asset_id" IS NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "motor_vehicles" vehicle
      SET "insured_asset_id" = asset."id"
      FROM "insured_assets" asset
      WHERE
        asset."asset_number" = 'MV-' || vehicle."id"::text
        AND vehicle."insured_asset_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      DROP CONSTRAINT IF EXISTS "FK_motor_vehicles_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      ADD CONSTRAINT "FK_motor_vehicles_customer"
      FOREIGN KEY ("customer_id")
      REFERENCES "customers"("id")
      ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      DROP CONSTRAINT IF EXISTS "FK_motor_vehicles_insured_asset"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      ADD CONSTRAINT "FK_motor_vehicles_insured_asset"
      FOREIGN KEY ("insured_asset_id")
      REFERENCES "insured_assets"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "motor_vehicle_ownerships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "motor_vehicle_id" uuid NOT NULL,
        "insured_asset_id" uuid NOT NULL,
        "owner_customer_id" uuid NOT NULL,
        "ownership_type" character varying(30) NOT NULL DEFAULT 'OWNED',
        "effective_from" date NOT NULL DEFAULT CURRENT_DATE,
        "effective_to" date,
        "change_reason" text,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_motor_vehicle_ownerships" PRIMARY KEY ("id"),
        CONSTRAINT "FK_motor_vehicle_ownerships_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_motor_vehicle_ownerships_asset" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_motor_vehicle_ownerships_owner" FOREIGN KEY ("owner_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_motor_vehicle_current_ownership"
      ON "motor_vehicle_ownerships" ("motor_vehicle_id")
      WHERE "effective_to" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "motor_vehicle_ownerships" (
        "company_id", "motor_vehicle_id", "insured_asset_id", "owner_customer_id",
        "ownership_type", "effective_from", "created_by", "created_at"
      )
      SELECT
        "company_id", "id", "insured_asset_id", "customer_id",
        'OWNED', COALESCE("created_at"::date, CURRENT_DATE), "created_by", "created_at"
      FROM "motor_vehicles"
      WHERE "insured_asset_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE "motor_fleets"
      ADD COLUMN IF NOT EXISTS "snapshot_version" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "derived_vehicle_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "motor_fleet_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "fleet_id" uuid NOT NULL,
        "motor_vehicle_id" uuid NOT NULL,
        "insured_asset_id" uuid NOT NULL,
        "effective_from" date NOT NULL DEFAULT CURRENT_DATE,
        "effective_to" date,
        "status" character varying(30) NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_motor_fleet_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "FK_motor_fleet_memberships_fleet" FOREIGN KEY ("fleet_id") REFERENCES "motor_fleets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_motor_fleet_memberships_vehicle" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_motor_fleet_memberships_asset" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_motor_fleet_active_membership"
      ON "motor_fleet_memberships" ("fleet_id", "motor_vehicle_id")
      WHERE "effective_to" IS NULL AND "status" = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT INTO "motor_fleet_memberships" (
        "company_id", "fleet_id", "motor_vehicle_id", "insured_asset_id",
        "effective_from", "status", "created_at", "updated_at"
      )
      SELECT
        fleet."company_id", item."fleet_id", item."motor_vehicle_id",
        vehicle."insured_asset_id", COALESCE(item."created_at"::date, CURRENT_DATE),
        item."status", item."created_at", item."updated_at"
      FROM "motor_fleet_items" item
      JOIN "motor_fleets" fleet ON fleet."id" = item."fleet_id"
      JOIN "motor_vehicles" vehicle ON vehicle."id" = item."motor_vehicle_id"
      WHERE vehicle."insured_asset_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "motor_fleets" fleet
      SET "derived_vehicle_count" = membership_counts.count
      FROM (
        SELECT "fleet_id", COUNT(*)::int AS count
        FROM "motor_fleet_memberships"
        WHERE "effective_to" IS NULL AND "status" = 'ACTIVE'
        GROUP BY "fleet_id"
      ) membership_counts
      WHERE membership_counts."fleet_id" = fleet."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      ADD COLUMN IF NOT EXISTS "insured_asset_id" uuid,
      ADD COLUMN IF NOT EXISTS "owner_customer_id" uuid,
      ADD COLUMN IF NOT EXISTS "subject_category" character varying(100),
      ADD COLUMN IF NOT EXISTS "country_code" character varying(3),
      ADD COLUMN IF NOT EXISTS "snapshot_version" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      UPDATE "subject_matters"
      SET
        "owner_customer_id" = COALESCE("owner_customer_id", "customer_id"),
        "subject_code" = upper(regexp_replace("subject_code", '\\s+', '', 'g')),
        "country_code" = COALESCE("country_code", 'TZA')
    `);
    await queryRunner.query(`
      INSERT INTO "insured_assets" (
        "company_id", "asset_number", "asset_type", "customer_id",
        "owner_customer_id", "display_name", "declared_value",
        "currency_code", "status", "data_source", "created_by", "updated_by",
        "created_at", "updated_at"
      )
      SELECT
        subject."company_id",
        'SM-' || subject."id"::text,
        'NON_MOTOR_SUBJECT',
        subject."customer_id",
        COALESCE(subject."owner_customer_id", subject."customer_id"),
        COALESCE(subject."subject_code", 'Subject matter'),
        subject."value",
        subject."currency",
        subject."status",
        'LEGACY',
        subject."created_by",
        subject."updated_by",
        subject."created_at",
        subject."updated_at"
      FROM "subject_matters" subject
      WHERE subject."insured_asset_id" IS NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "subject_matters" subject
      SET "insured_asset_id" = asset."id"
      FROM "insured_assets" asset
      WHERE
        asset."asset_number" = 'SM-' || subject."id"::text
        AND subject."insured_asset_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      DROP CONSTRAINT IF EXISTS "FK_subject_matters_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      ADD CONSTRAINT "FK_subject_matters_customer"
      FOREIGN KEY ("customer_id")
      REFERENCES "customers"("id")
      ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      DROP CONSTRAINT IF EXISTS "FK_subject_matters_owner_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      ADD CONSTRAINT "FK_subject_matters_owner_customer"
      FOREIGN KEY ("owner_customer_id")
      REFERENCES "customers"("id")
      ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      DROP CONSTRAINT IF EXISTS "FK_subject_matters_insured_asset"
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      ADD CONSTRAINT "FK_subject_matters_insured_asset"
      FOREIGN KEY ("insured_asset_id")
      REFERENCES "insured_assets"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "customer_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "customer_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "customer_kyc_version" integer,
      ADD COLUMN IF NOT EXISTS "customer_snapshot_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_customer_snapshot_hash"
      ON "quotations" ("customer_snapshot_hash")
      WHERE "customer_snapshot_hash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quotation_risk_assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quotation_id" uuid NOT NULL,
        "quotation_risk_id" uuid NOT NULL,
        "insured_asset_id" uuid NOT NULL,
        "asset_type" character varying(40) NOT NULL,
        "asset_snapshot" jsonb NOT NULL,
        "asset_snapshot_hash" character varying(64) NOT NULL,
        "asset_snapshot_version" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quotation_risk_assets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quotation_risk_assets_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quotation_risk_assets_risk" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quotation_risk_assets_asset" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quotation_risk_assets_risk"
      ON "quotation_risk_assets" ("quotation_risk_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quotation_risk_assets"`);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_customer_snapshot_hash"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "customer_snapshot_at",
      DROP COLUMN IF EXISTS "customer_kyc_version",
      DROP COLUMN IF EXISTS "customer_snapshot_hash",
      DROP COLUMN IF EXISTS "customer_snapshot"
    `);

    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      DROP CONSTRAINT IF EXISTS "FK_subject_matters_insured_asset"
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      DROP CONSTRAINT IF EXISTS "FK_subject_matters_owner_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      DROP CONSTRAINT IF EXISTS "FK_subject_matters_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      ADD CONSTRAINT "FK_subject_matters_customer"
      FOREIGN KEY ("customer_id")
      REFERENCES "customers"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "subject_matters"
      DROP COLUMN IF EXISTS "snapshot_version",
      DROP COLUMN IF EXISTS "country_code",
      DROP COLUMN IF EXISTS "subject_category",
      DROP COLUMN IF EXISTS "owner_customer_id",
      DROP COLUMN IF EXISTS "insured_asset_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "motor_fleet_memberships"`);
    await queryRunner.query(`
      ALTER TABLE "motor_fleets"
      DROP COLUMN IF EXISTS "derived_vehicle_count",
      DROP COLUMN IF EXISTS "snapshot_version"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "motor_vehicle_ownerships"`);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      DROP CONSTRAINT IF EXISTS "FK_motor_vehicles_insured_asset"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      DROP CONSTRAINT IF EXISTS "FK_motor_vehicles_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      ADD CONSTRAINT "FK_motor_vehicles_customer"
      FOREIGN KEY ("customer_id")
      REFERENCES "customers"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_motor_vehicles_normalized_chassis"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_motor_vehicles_normalized_registration"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_vehicles"
      DROP COLUMN IF EXISTS "snapshot_version",
      DROP COLUMN IF EXISTS "chassis_no_normalized",
      DROP COLUMN IF EXISTS "registration_no_normalized",
      DROP COLUMN IF EXISTS "insured_asset_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "insured_assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_kyc_reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_contacts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_addresses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_identifiers"`);
    await queryRunner.query(`
      ALTER TABLE "customers"
      DROP CONSTRAINT IF EXISTS "FK_customers_merged_into"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_customers_identity_fingerprint"
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
      DROP COLUMN IF EXISTS "data_source",
      DROP COLUMN IF EXISTS "merged_into_customer_id",
      DROP COLUMN IF EXISTS "kyc_rejection_reason",
      DROP COLUMN IF EXISTS "kyc_expires_at",
      DROP COLUMN IF EXISTS "kyc_verified_at",
      DROP COLUMN IF EXISTS "kyc_verified_by",
      DROP COLUMN IF EXISTS "kyc_version",
      DROP COLUMN IF EXISTS "identity_fingerprint",
      DROP COLUMN IF EXISTS "display_name"
    `);
  }
}
