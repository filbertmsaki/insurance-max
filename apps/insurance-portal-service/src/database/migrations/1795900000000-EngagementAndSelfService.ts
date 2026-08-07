import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 17 engagement foundation.
 *
 * This migration keeps the existing portal/work-item/document footprint
 * usable, then extends it into the shared engagement layer expected by the
 * next services and frontend workspaces.
 */
export class EngagementAndSelfService1795900000000
  implements MigrationInterface
{
  name = 'EngagementAndSelfService1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const documentStatusConstraint = `
      ALTER TABLE "documents"
      ADD CONSTRAINT "CHK_document_status" CHECK (
        "status" IN (
          'UPLOAD_PENDING',
          'UPLOADED',
          'SCAN_PENDING',
          'SCANNING',
          'AVAILABLE',
          'QUARANTINED',
          'REJECTED',
          'SUPERSEDED',
          'REVOKED',
          'ARCHIVED',
          'DELETED'
        )
      )
    `;

    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD COLUMN IF NOT EXISTS "document_no" varchar(100),
      ADD COLUMN IF NOT EXISTS "title" varchar(255),
      ADD COLUMN IF NOT EXISTS "document_type" varchar(80),
      ADD COLUMN IF NOT EXISTS "classification" varchar(30) NOT NULL DEFAULT 'INTERNAL',
      ADD COLUMN IF NOT EXISTS "source_type" varchar(30),
      ADD COLUMN IF NOT EXISTS "current_version_id" uuid,
      ADD COLUMN IF NOT EXISTS "customer_visible" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "intermediary_visible" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "public_verification_enabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "public_verification_code" varchar(120),
      ADD COLUMN IF NOT EXISTS "retention_policy_code" varchar(80),
      ADD COLUMN IF NOT EXISTS "retention_until" timestamptz,
      ADD COLUMN IF NOT EXISTS "legal_hold" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "legal_hold_reason" text,
      ADD COLUMN IF NOT EXISTS "created_by" uuid,
      ADD COLUMN IF NOT EXISTS "archived_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      ALTER COLUMN "status" TYPE varchar(30),
      ALTER COLUMN "status" SET DEFAULT 'UPLOAD_PENDING'
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP CONSTRAINT IF EXISTS "CHK_document_status"
    `);

    await queryRunner.query(`
      UPDATE "documents"
      SET
        "document_no" = COALESCE("document_no", CONCAT('DOC-', UPPER(SUBSTRING("id"::text, 1, 8)))),
        "title" = COALESCE("title", NULLIF("file_name", ''), 'Document'),
        "document_type" = COALESCE("document_type", NULLIF(UPPER("owner_type"), ''), 'GENERAL'),
        "source_type" = COALESCE("source_type", 'MIGRATED'),
        "created_by" = COALESCE("created_by", "uploaded_by"),
        "status" = CASE
          WHEN "status" = 'PENDING' THEN 'UPLOAD_PENDING'
          WHEN "status" = 'VERIFIED' THEN 'AVAILABLE'
          WHEN "status" = 'REJECTED' THEN 'REJECTED'
          ELSE COALESCE("status", 'UPLOAD_PENDING')
        END
    `);

    await queryRunner.query(documentStatusConstraint);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_documents_document_no"
      ON "documents" ("company_id", "document_no")
      WHERE "document_no" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_documents_verification_code"
      ON "documents" ("public_verification_code")
      WHERE "public_verification_code" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "status" varchar(30) NOT NULL,
        "storage_provider" varchar(40) NOT NULL,
        "storage_bucket" varchar(150),
        "storage_key" varchar(500) NOT NULL,
        "original_file_name" varchar(255),
        "safe_file_name" varchar(255) NOT NULL,
        "declared_mime_type" varchar(100),
        "detected_mime_type" varchar(100) NOT NULL,
        "detected_extension" varchar(20),
        "file_size" bigint NOT NULL,
        "sha256_hash" varchar(64) NOT NULL,
        "encryption_key_reference" varchar(200),
        "source_snapshot" jsonb,
        "source_snapshot_hash" varchar(64),
        "template_code" varchar(100),
        "template_version" integer,
        "generator_version" varchar(50),
        "page_count" integer,
        "scan_status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "scan_provider" varchar(50),
        "scan_reference" varchar(150),
        "scanned_at" timestamptz,
        "scan_result" jsonb,
        "uploaded_by" uuid,
        "uploaded_at" timestamptz NOT NULL DEFAULT now(),
        "supersedes_version_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_version" UNIQUE ("document_id", "version_number"),
        CONSTRAINT "UQ_document_storage_object" UNIQUE ("storage_provider", "storage_bucket", "storage_key")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "document_versions"
        ADD CONSTRAINT "FK_document_version_document"
        FOREIGN KEY ("document_id")
        REFERENCES "documents"("id")
        ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      INSERT INTO "document_versions" (
        "company_id",
        "document_id",
        "version_number",
        "status",
        "storage_provider",
        "storage_bucket",
        "storage_key",
        "original_file_name",
        "safe_file_name",
        "declared_mime_type",
        "detected_mime_type",
        "detected_extension",
        "file_size",
        "sha256_hash",
        "scan_status",
        "scan_provider",
        "scanned_at",
        "scan_result",
        "uploaded_by",
        "uploaded_at"
      )
      SELECT
        d."company_id",
        d."id",
        1,
        COALESCE(d."status", 'UPLOAD_PENDING'),
        'legacy_local',
        NULL,
        d."storage_key",
        d."file_name",
        REGEXP_REPLACE(COALESCE(d."file_name", 'document.bin'), '[^a-zA-Z0-9._-]', '_', 'g'),
        d."content_type",
        COALESCE(d."content_type", 'application/octet-stream'),
        CASE
          WHEN POSITION('.' IN REVERSE(COALESCE(d."file_name", ''))) > 0
            THEN LOWER(RIGHT(COALESCE(d."file_name", ''), POSITION('.' IN REVERSE(COALESCE(d."file_name", '')))))
          ELSE NULL
        END,
        COALESCE(d."file_size", 0),
        d."checksum",
        CASE
          WHEN d."status" = 'AVAILABLE' THEN 'CLEAN'
          WHEN d."status" = 'REJECTED' THEN 'FAILED'
          ELSE 'PENDING'
        END,
        'legacy_import',
        d."verified_at",
        CASE
          WHEN d."status" = 'REJECTED' THEN jsonb_build_object('reason', d."rejection_reason")
          ELSE NULL
        END,
        d."uploaded_by",
        COALESCE(d."uploaded_at", d."created_at", now())
      FROM "documents" d
      LEFT JOIN "document_versions" dv
        ON dv."document_id" = d."id"
       AND dv."version_number" = 1
      WHERE dv."id" IS NULL
        AND d."storage_key" IS NOT NULL
        AND d."checksum" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "documents" d
      SET "current_version_id" = dv."id"
      FROM "document_versions" dv
      WHERE dv."document_id" = d."id"
        AND dv."version_number" = 1
        AND d."current_version_id" IS NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "documents"
        ADD CONSTRAINT "FK_documents_current_version"
        FOREIGN KEY ("current_version_id")
        REFERENCES "document_versions"("id")
        ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "link_type" varchar(40) NOT NULL,
        "linked_record_type" varchar(60) NOT NULL,
        "linked_record_id" uuid NOT NULL,
        "customer_visible" boolean NOT NULL DEFAULT false,
        "intermediary_visible" boolean NOT NULL DEFAULT false,
        "label" varchar(180),
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_links" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_resource_link" UNIQUE ("document_id", "linked_record_type", "linked_record_id", "link_type")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "document_links"
        ADD CONSTRAINT "FK_document_link_document"
        FOREIGN KEY ("document_id")
        REFERENCES "documents"("id")
        ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_upload_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "requested_by_type" varchar(30) NOT NULL,
        "requested_by_id" uuid NOT NULL,
        "resource_type" varchar(50) NOT NULL,
        "resource_id" uuid NOT NULL,
        "document_type" varchar(80) NOT NULL,
        "classification" varchar(30) NOT NULL,
        "maximum_bytes" bigint NOT NULL,
        "allowed_mime_types" jsonb NOT NULL,
        "customer_visible" boolean NOT NULL DEFAULT false,
        "intermediary_visible" boolean NOT NULL DEFAULT false,
        "link_type" varchar(40),
        "link_label" varchar(180),
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "upload_token_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "document_id" uuid,
        "document_version_id" uuid,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_upload_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_upload_token" UNIQUE ("upload_token_hash")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_security_scans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "document_version_id" uuid NOT NULL,
        "scan_type" varchar(40) NOT NULL,
        "provider" varchar(50) NOT NULL,
        "status" varchar(30) NOT NULL,
        "result_code" varchar(80),
        "result_message" text,
        "details" jsonb,
        "started_at" timestamptz NOT NULL,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_security_scans" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_access_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "document_version_id" uuid,
        "actor_type" varchar(30) NOT NULL,
        "actor_id" uuid,
        "action" varchar(30) NOT NULL,
        "access_channel" varchar(30) NOT NULL,
        "purpose" varchar(500),
        "ip_address" inet,
        "user_agent" text,
        "result" varchar(30) NOT NULL,
        "failure_reason" varchar(200),
        "occurred_at" timestamptz NOT NULL,
        CONSTRAINT "PK_document_access_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "tenant_notifications"
      ADD COLUMN IF NOT EXISTS "notification_no" varchar(100),
      ADD COLUMN IF NOT EXISTS "channel" varchar(20) NOT NULL DEFAULT 'IN_APP',
      ADD COLUMN IF NOT EXISTS "priority" varchar(20) NOT NULL DEFAULT 'NORMAL',
      ADD COLUMN IF NOT EXISTS "status" varchar(30) NOT NULL DEFAULT 'DELIVERED',
      ADD COLUMN IF NOT EXISTS "deep_link" varchar(255),
      ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(180),
      ADD COLUMN IF NOT EXISTS "dismissed_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "expires_at" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "tenant_notifications"
      SET
        "notification_no" = COALESCE("notification_no", CONCAT('NTF-', UPPER(SUBSTRING("id"::text, 1, 8)))),
        "deep_link" = COALESCE("deep_link", "action_url"),
        "status" = COALESCE("status", CASE WHEN "read_at" IS NOT NULL THEN 'DELIVERED' ELSE 'CREATED' END)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenant_notifications_notification_no"
      ON "tenant_notifications" ("company_id", "notification_no")
      WHERE "notification_no" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "notification_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "provider" varchar(50),
        "provider_message_id" varchar(150),
        "attempt_count" integer NOT NULL DEFAULT 0,
        "last_attempt_at" timestamptz,
        "next_retry_at" timestamptz,
        "failure_code" varchar(80),
        "failure_message" text,
        "payload_snapshot" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_deliveries" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "event_code" varchar(120) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "mode" varchar(20) NOT NULL DEFAULT 'INHERIT',
        "quiet_hours_from" varchar(5),
        "quiet_hours_to" varchar(5),
        "marketing_consent" boolean NOT NULL DEFAULT false,
        "transactional_required" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preference" UNIQUE ("company_id", "user_id", "event_code", "channel")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "work_items"
      ADD COLUMN IF NOT EXISTS "work_item_no" varchar(100),
      ADD COLUMN IF NOT EXISTS "work_item_type" varchar(80),
      ADD COLUMN IF NOT EXISTS "assignment_type" varchar(20) NOT NULL DEFAULT 'USER',
      ADD COLUMN IF NOT EXISTS "assigned_team" varchar(100),
      ADD COLUMN IF NOT EXISTS "queue_code" varchar(100),
      ADD COLUMN IF NOT EXISTS "source_module" varchar(80),
      ADD COLUMN IF NOT EXISTS "source_record_id" uuid,
      ADD COLUMN IF NOT EXISTS "source_record_version" integer,
      ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(180),
      ADD COLUMN IF NOT EXISTS "sla_status" varchar(30) NOT NULL DEFAULT 'ON_TRACK',
      ADD COLUMN IF NOT EXISTS "deep_link" varchar(255),
      ADD COLUMN IF NOT EXISTS "claimed_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "started_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "cancelled_by" uuid,
      ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "cancellation_reason" text,
      ADD COLUMN IF NOT EXISTS "delegated_by" uuid,
      ADD COLUMN IF NOT EXISTS "delegated_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "warning_sent_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "escalated_at" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "work_items"
      SET
        "work_item_no" = COALESCE("work_item_no", CONCAT('WIT-', UPPER(SUBSTRING("id"::text, 1, 8)))),
        "work_item_type" = COALESCE("work_item_type", NULLIF(UPPER("resource_type"), ''), 'GENERAL'),
        "source_record_id" = COALESCE("source_record_id", "resource_id"),
        "source_module" = COALESCE("source_module", NULLIF("domain", ''), 'operations'),
        "idempotency_key" = COALESCE("idempotency_key", "dedupe_key")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_work_items_work_item_no"
      ON "work_items" ("company_id", "work_item_no")
      WHERE "work_item_no" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_work_items_idempotency"
      ON "work_items" ("company_id", "idempotency_key")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_item_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "work_item_id" uuid NOT NULL,
        "event_type" varchar(30) NOT NULL,
        "actor_id" uuid,
        "actor_type" varchar(30) NOT NULL DEFAULT 'USER',
        "comment" text,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_item_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "communication_threads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "thread_no" varchar(100) NOT NULL,
        "thread_type" varchar(40) NOT NULL DEFAULT 'GENERAL',
        "subject" varchar(255) NOT NULL,
        "resource_type" varchar(80),
        "resource_id" uuid,
        "customer_visible" boolean NOT NULL DEFAULT false,
        "intermediary_visible" boolean NOT NULL DEFAULT false,
        "closed_at" timestamptz,
        "closed_by" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_communication_threads" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_communication_thread_no" UNIQUE ("company_id", "thread_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "communication_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "thread_id" uuid NOT NULL,
        "direction" varchar(20) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "channel" varchar(20) NOT NULL DEFAULT 'IN_APP',
        "subject" varchar(255),
        "body_text" text,
        "body_html" text,
        "sender_type" varchar(30),
        "sender_id" uuid,
        "recipient_type" varchar(30),
        "recipient_id" uuid,
        "provider" varchar(50),
        "provider_message_id" varchar(150),
        "internal_only" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_communication_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid,
        "template_code" varchar(100) NOT NULL,
        "template_name" varchar(200) NOT NULL,
        "document_type" varchar(80) NOT NULL,
        "engine" varchar(30) NOT NULL,
        "scope" varchar(30) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "active_version_id" uuid,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_template" UNIQUE ("company_id", "template_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_template_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "template_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "template_content" text NOT NULL,
        "stylesheet_content" text,
        "header_content" text,
        "footer_content" text,
        "variable_schema" jsonb NOT NULL,
        "sample_data" jsonb,
        "template_hash" varchar(64) NOT NULL,
        "created_by" uuid NOT NULL,
        "approved_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz,
        CONSTRAINT "PK_document_template_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_template_version" UNIQUE ("template_id", "version_number")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "signature_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "request_no" varchar(100) NOT NULL,
        "document_id" uuid NOT NULL,
        "document_version_id" uuid NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "signature_provider" varchar(50) NOT NULL,
        "provider_request_id" varchar(150),
        "signing_order_required" boolean NOT NULL DEFAULT false,
        "expires_at" timestamptz,
        "completion_document_version_id" uuid,
        "evidence_document_id" uuid,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        CONSTRAINT "PK_signature_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_signature_request_no" UNIQUE ("company_id", "request_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "signature_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "signature_request_id" uuid NOT NULL,
        "participant_type" varchar(30) NOT NULL,
        "participant_id" uuid,
        "name" varchar(200) NOT NULL,
        "email" varchar(255),
        "phone" varchar(50),
        "signing_order" integer,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "access_token_hash" varchar(64),
        "signed_at" timestamptz,
        "declined_at" timestamptz,
        "decline_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_signature_participants" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "signature_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "signature_request_id" uuid NOT NULL,
        "event_type" varchar(40) NOT NULL,
        "actor_id" uuid,
        "actor_type" varchar(30) NOT NULL,
        "notes" text,
        "payload" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_signature_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "signature_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "signature_request_id" uuid NOT NULL,
        "participant_id" uuid NOT NULL,
        "evidence_type" varchar(30) NOT NULL,
        "ip_address" inet,
        "user_agent" text,
        "payload" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_signature_evidence" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP CONSTRAINT IF EXISTS "CHK_document_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
      ALTER COLUMN "status" SET DEFAULT 'PENDING',
      ALTER COLUMN "status" TYPE varchar(20)
        USING CASE
          WHEN "status" = 'AVAILABLE' THEN 'VERIFIED'
          WHEN "status" = 'REJECTED' THEN 'REJECTED'
          ELSE 'PENDING'
        END
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD CONSTRAINT "CHK_document_status" CHECK (
        "status" IN ('PENDING', 'VERIFIED', 'REJECTED')
      )
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "signature_evidence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "signature_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "signature_participants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "signature_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_template_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "communication_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "communication_threads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_item_events"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_work_items_idempotency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_work_items_work_item_no"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_deliveries"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tenant_notifications_notification_no"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_access_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_security_scans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_upload_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_versions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_documents_verification_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_documents_document_no"`);
  }
}
