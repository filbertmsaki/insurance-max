import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyCoverNoteIssuance1795400000000 implements MigrationInterface {
  name = 'PolicyCoverNoteIssuance1795400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cover_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "insurer_company_id" uuid NOT NULL,
        "intermediary_company_id" uuid,
        "branch_id" uuid,
        "sale_point_id" uuid,
        "customer_id" uuid NOT NULL,
        "quotation_id" uuid NOT NULL,
        "quotation_entry_id" uuid NOT NULL,
        "policy_id" uuid,
        "insured_asset_id" uuid,
        "tiramis_tracking_id" uuid NOT NULL,
        "tiramis_transaction_id" character varying(100) NOT NULL,
        "tiramis_request_id" character varying(100) NOT NULL,
        "response_id" character varying(100),
        "cover_note_number" character varying(100) NOT NULL,
        "cover_note_reference_number" character varying(100),
        "sticker_number" character varying(100),
        "entry_type" character varying(40) NOT NULL,
        "fleet_entry" integer,
        "status" character varying(40) NOT NULL DEFAULT 'PENDING_SUBMISSION',
        "regulatory_sync_status" character varying(40) NOT NULL DEFAULT 'PENDING',
        "product_id" uuid NOT NULL,
        "product_version_id" uuid,
        "product_code" character varying(50) NOT NULL,
        "product_definition_hash" character varying(64),
        "customer_snapshot" jsonb NOT NULL,
        "customer_snapshot_hash" character varying(64) NOT NULL,
        "asset_snapshot" jsonb NOT NULL,
        "asset_snapshot_hash" character varying(64) NOT NULL,
        "pricing_snapshot" jsonb NOT NULL,
        "pricing_result_hash" character varying(64) NOT NULL,
        "distribution_snapshot" jsonb,
        "distribution_snapshot_hash" character varying(64),
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "sum_insured" numeric(20,4) NOT NULL DEFAULT 0,
        "premium_excluding_tax" numeric(20,4) NOT NULL DEFAULT 0,
        "premium_including_tax" numeric(20,4) NOT NULL DEFAULT 0,
        "commission_amount" numeric(20,4) NOT NULL DEFAULT 0,
        "commission_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "final_response_status_code" character varying(30),
        "final_response_status_desc" text,
        "final_response_payload" jsonb,
        "final_response_payload_hash" character varying(64),
        "signature_verified" boolean NOT NULL DEFAULT false,
        "issued_at" TIMESTAMP WITH TIME ZONE,
        "rejected_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_cover_notes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cover_note_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cover_note_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_cover_note_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_cover_note_quotation_entry" FOREIGN KEY ("quotation_entry_id") REFERENCES "quotation_cover_note_entries"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_cover_note_asset" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_cover_note_tracking" FOREIGN KEY ("tiramis_tracking_id") REFERENCES "tiramis_submission_tracking"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_cover_note_status" CHECK (
          "status" IN (
            'PENDING_SUBMISSION',
            'SUBMISSION_PROCESSING',
            'ACKNOWLEDGED',
            'ISSUED',
            'REJECTED',
            'CANCELLED',
            'EXPIRED'
          )
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cover_note_quotation_entry"
      ON "cover_notes" ("quotation_entry_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cover_note_regulatory_reference"
      ON "cover_notes" ("insurer_company_id", "cover_note_reference_number")
      WHERE "cover_note_reference_number" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cover_note_customer"
      ON "cover_notes" ("company_id", "customer_id", "status")
    `);

    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "source_quotation_revision" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "source_finalization_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "product_version_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "product_definition_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "customer_snapshot" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "customer_snapshot_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "pricing_snapshot" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "pricing_result_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "distribution_snapshot" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "distribution_snapshot_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "policy_reference_number" character varying(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "regulatory_sync_status" character varying(40) NOT NULL DEFAULT 'PENDING'
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "source_cover_note_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "issued_by_system" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "regulatory_response_payload" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "regulatory_response_hash" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_policy_source_quotation"
      ON "policies" ("company_id", "quotation_id", "current_version_no")
      WHERE "quotation_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_policy_regulatory_reference"
      ON "policies" ("insurer_company_id", "policy_reference_number")
      WHERE "policy_reference_number" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_cover_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "cover_note_id" uuid NOT NULL,
        "sequence_number" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_cover_notes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_cover_note" UNIQUE ("policy_id", "cover_note_id"),
        CONSTRAINT "UQ_policy_cover_note_sequence" UNIQUE ("policy_id", "sequence_number"),
        CONSTRAINT "FK_policy_cover_note_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policy_cover_note_cover_note" FOREIGN KEY ("cover_note_id") REFERENCES "cover_notes"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner
      .query(
        `
      ALTER TABLE "cover_notes"
      ADD CONSTRAINT "FK_cover_note_policy"
      FOREIGN KEY ("policy_id")
      REFERENCES "policies"("id")
      ON DELETE SET NULL
    `,
      )
      .catch(() => undefined);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "version_type" character varying(30) NOT NULL DEFAULT 'NEW_BUSINESS',
        "status" character varying(30) NOT NULL,
        "effective_from" date NOT NULL,
        "effective_to" date NOT NULL,
        "policy_snapshot" jsonb NOT NULL,
        "policy_snapshot_hash" character varying(64) NOT NULL,
        "pricing_snapshot" jsonb NOT NULL,
        "pricing_result_hash" character varying(64) NOT NULL,
        "customer_snapshot" jsonb NOT NULL,
        "customer_snapshot_hash" character varying(64) NOT NULL,
        "asset_manifest" jsonb NOT NULL,
        "asset_manifest_hash" character varying(64) NOT NULL,
        "tiramis_tracking_id" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_version" UNIQUE ("policy_id", "version_number"),
        CONSTRAINT "FK_policy_version_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policy_version_tracking" FOREIGN KEY ("tiramis_tracking_id") REFERENCES "tiramis_submission_tracking"("id") ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_cover_notes"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_policy_regulatory_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_policy_source_quotation"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cover_note_customer"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cover_note_regulatory_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cover_note_quotation_entry"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cover_notes"`);
  }
}
