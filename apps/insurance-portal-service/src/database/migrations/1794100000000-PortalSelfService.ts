import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalSelfService1794100000000 implements MigrationInterface {
  name = 'PortalSelfService1794100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "portal_sequences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "document_type" varchar(60) NOT NULL,
        "sequence_year" integer NOT NULL,
        "current_value" bigint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portal_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_portal_sequence" UNIQUE (
          "company_id", "document_type", "sequence_year"
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "portal_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,

        "actor_type" varchar(30) NOT NULL,
        "customer_id" uuid,
        "intermediary_company_id" uuid,

        "status" varchar(30) NOT NULL DEFAULT 'INVITED',
        "activated_at" timestamptz,

        "suspended_by" uuid,
        "suspended_at" timestamptz,
        "suspension_reason" text,

        "closed_by" uuid,
        "closed_at" timestamptz,

        "accepted_terms_at" timestamptz,
        "accepted_privacy_at" timestamptz,
        "last_accessed_at" timestamptz,

        "created_by" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}',

        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,

        CONSTRAINT "PK_portal_accounts" PRIMARY KEY ("id"),

        CONSTRAINT "CHK_portal_account_actor" CHECK (
          (
            "actor_type" = 'CUSTOMER'
            AND "customer_id" IS NOT NULL
            AND "intermediary_company_id" IS NULL
          )
          OR
          (
            "actor_type" = 'INTERMEDIARY'
            AND "intermediary_company_id" IS NOT NULL
            AND "customer_id" IS NULL
          )
        ),

        CONSTRAINT "FK_portal_account_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_account_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_account_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_account_intermediary"
          FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id")
          ON DELETE RESTRICT,

        -- Nullable actor references: safe to null out on user deletion,
        -- per the migration's audit-history compromise.
        CONSTRAINT "FK_portal_account_suspended_by"
          FOREIGN KEY ("suspended_by") REFERENCES "users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_portal_account_closed_by"
          FOREIGN KEY ("closed_by") REFERENCES "users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_portal_account_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_portal_account_user_actor"
      ON "portal_accounts" ("company_id", "user_id", "actor_type")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_portal_customer_active_link"
      ON "portal_accounts" ("company_id", "customer_id")
      WHERE
        "deleted_at" IS NULL
        AND "actor_type" = 'CUSTOMER'
        AND "status" IN ('INVITED', 'ACTIVE', 'SUSPENDED')
    `);

    await queryRunner.query(`
      CREATE TABLE "portal_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,

        "actor_type" varchar(30) NOT NULL,
        "customer_id" uuid,
        "intermediary_company_id" uuid,

        "email" varchar(150) NOT NULL,
        "phone" varchar(30),
        "first_name" varchar(80),
        "last_name" varchar(80),

        "token_hash" varchar(128) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "expires_at" timestamptz NOT NULL,

        -- Immutable audit value; intentionally not a foreign key so the
        -- invitation record survives deletion of the inviting user.
        "invited_by" uuid NOT NULL,

        "accepted_by" uuid,
        "accepted_at" timestamptz,

        "revoked_by" uuid,
        "revoked_at" timestamptz,
        "revocation_reason" text,

        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portal_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_portal_invitation_token" UNIQUE ("token_hash"),

        CONSTRAINT "CHK_portal_invitation_actor" CHECK (
          (
            "actor_type" = 'CUSTOMER'
            AND "customer_id" IS NOT NULL
            AND "intermediary_company_id" IS NULL
          )
          OR
          (
            "actor_type" = 'INTERMEDIARY'
            AND "intermediary_company_id" IS NOT NULL
            AND "customer_id" IS NULL
          )
        ),

        CONSTRAINT "FK_portal_invitation_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_invitation_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_invitation_intermediary"
          FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_invitation_accepted_by"
          FOREIGN KEY ("accepted_by") REFERENCES "users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_portal_invitation_revoked_by"
          FOREIGN KEY ("revoked_by") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_portal_invitation_lookup"
      ON "portal_invitations" ("company_id", "email", "status", "expires_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "portal_service_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "portal_account_id" uuid NOT NULL,

        "request_no" varchar(60) NOT NULL,
        "request_type" varchar(50) NOT NULL,

        "target_type" varchar(50),
        "target_id" uuid,

        "policy_id" uuid,
        "quotation_id" uuid,
        "invoice_id" uuid,

        "status" varchar(40) NOT NULL DEFAULT 'DRAFT',
        "subject" varchar(180) NOT NULL,
        "description" text NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',

        "submitted_by" uuid,
        "submitted_at" timestamptz,

        "assigned_to" uuid,
        "assigned_at" timestamptz,

        "reviewed_by" uuid,
        "reviewed_at" timestamptz,
        "decision_reason" text,

        "completed_by" uuid,
        "completed_at" timestamptz,

        -- Immutable audit value; intentionally not a foreign key so the
        -- request record survives deletion of the creating user.
        "created_by" uuid NOT NULL,
        "updated_by" uuid,

        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,

        CONSTRAINT "PK_portal_service_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_portal_request_no" UNIQUE ("company_id", "request_no"),

        CONSTRAINT "FK_portal_request_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_request_account"
          FOREIGN KEY ("portal_account_id") REFERENCES "portal_accounts"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_request_policy"
          FOREIGN KEY ("policy_id") REFERENCES "policies"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_request_quotation"
          FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_request_invoice"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_request_submitted_by"
          FOREIGN KEY ("submitted_by") REFERENCES "users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_portal_request_assigned_to"
          FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_portal_request_reviewed_by"
          FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_portal_request_completed_by"
          FOREIGN KEY ("completed_by") REFERENCES "users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_portal_request_updated_by"
          FOREIGN KEY ("updated_by") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_portal_request_account_status"
      ON "portal_service_requests" ("portal_account_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_portal_request_company_status"
      ON "portal_service_requests" (
        "company_id", "status", "request_type", "created_at"
      )
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "portal_service_request_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "request_id" uuid NOT NULL,

        "old_status" varchar(40),
        "new_status" varchar(40) NOT NULL,
        "message" text,

        -- Immutable audit value; intentionally not a foreign key so the
        -- event record survives deletion of the acting user.
        "changed_by" uuid NOT NULL,

        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portal_service_request_events" PRIMARY KEY ("id"),

        CONSTRAINT "FK_portal_request_event"
          FOREIGN KEY ("request_id") REFERENCES "portal_service_requests"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "portal_request_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "request_id" uuid NOT NULL,

        -- Immutable audit value; intentionally not a foreign key so the
        -- attachment record survives deletion of the uploading user.
        "uploaded_by" uuid NOT NULL,

        "document_type" varchar(80) NOT NULL,
        "original_file_name" varchar(255) NOT NULL,
        "stored_file_name" varchar(255) NOT NULL,
        "storage_key" varchar(500) NOT NULL,
        "mime_type" varchar(120) NOT NULL,
        "file_size" bigint NOT NULL,
        "checksum" varchar(128) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'ACTIVE',

        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,

        CONSTRAINT "PK_portal_request_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_portal_attachment_storage_key" UNIQUE ("storage_key"),

        CONSTRAINT "FK_portal_attachment_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_attachment_request"
          FOREIGN KEY ("request_id") REFERENCES "portal_service_requests"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "portal_payment_proofs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "request_id" uuid NOT NULL,
        "invoice_id" uuid NOT NULL,

        "amount" numeric(20,2) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "payment_reference" varchar(150),
        "payment_date" date NOT NULL,

        "status" varchar(30) NOT NULL DEFAULT 'PENDING_REVIEW',

        "reviewed_by" uuid,
        "reviewed_at" timestamptz,
        "review_reason" text,

        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portal_payment_proofs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_portal_payment_proof_request" UNIQUE ("request_id"),
        CONSTRAINT "CHK_portal_payment_proof_amount" CHECK ("amount" > 0),

        CONSTRAINT "FK_portal_payment_proof_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_payment_proof_request"
          FOREIGN KEY ("request_id") REFERENCES "portal_service_requests"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_payment_proof_invoice"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_portal_payment_proof_reviewed_by"
          FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "portal_notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),

        "company_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,

        "type" varchar(80) NOT NULL,
        "severity" varchar(20) NOT NULL DEFAULT 'INFO',
        "title" varchar(180) NOT NULL,
        "message" text NOT NULL,

        "resource_type" varchar(80),
        "resource_id" uuid,
        "action_url" varchar(500),

        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portal_notifications" PRIMARY KEY ("id"),

        CONSTRAINT "FK_portal_notification_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_portal_notification_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_portal_notification_user"
      ON "portal_notifications" ("company_id", "user_id", "read_at", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_payment_proofs"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "portal_request_attachments"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "portal_service_request_events"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_service_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_sequences"`);
  }
}
