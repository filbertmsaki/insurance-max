import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorQuotationLifecycleStatuses1785000000000 implements MigrationInterface {
  name = 'RefactorQuotationLifecycleStatuses1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'quotations'
            AND column_name = 'status'
        ) THEN
          ALTER TABLE "quotations"
          RENAME COLUMN "status" TO "quotation_status";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'quotation_status_enum'
        ) THEN
          ALTER TYPE "public"."quotation_status_enum"
          RENAME TO "quotation_status_enum_legacy";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'quotation_status_enum'
        ) THEN
          CREATE TYPE "public"."quotation_status_enum" AS ENUM (
            'DRAFT',
            'PENDING_REQUIREMENTS',
            'READY_FOR_SUBMISSION',
            'SUBMITTING_TO_TIRA',
            'SUBMITTED_TO_TIRA',
            'TIRA_PROCESSING',
            'COMPLETED',
            'REJECTED',
            'FAILED',
            'CANCELLED',
            'EXPIRED'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'approval_status_enum'
        ) THEN
          CREATE TYPE "public"."approval_status_enum" AS ENUM (
            'NOT_REQUIRED',
            'NOT_SUBMITTED',
            'PENDING',
            'APPROVED',
            'CHANGES_REQUESTED',
            'REJECTED',
            'CANCELLED'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum'
        ) THEN
          CREATE TYPE "public"."payment_status_enum" AS ENUM (
            'NOT_REQUIRED',
            'NOT_INITIATED',
            'REQUESTED',
            'PROCESSING',
            'PARTIALLY_PAID',
            'PAID',
            'FAILED',
            'EXPIRED',
            'CANCELLED',
            'REFUNDED'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'tira_status_enum'
        ) THEN
          CREATE TYPE "public"."tira_status_enum" AS ENUM (
            'NOT_SUBMITTED',
            'SUBMITTING',
            'SUBMITTED',
            'PROCESSING',
            'SUCCESS',
            'REJECTED',
            'FAILED'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "requires_approval" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "requires_payment" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "approval_status" "public"."approval_status_enum" NOT NULL DEFAULT 'NOT_REQUIRED',
      ADD COLUMN IF NOT EXISTS "payment_status" "public"."payment_status_enum" NOT NULL DEFAULT 'NOT_REQUIRED',
      ADD COLUMN IF NOT EXISTS "tira_status" "public"."tira_status_enum" NOT NULL DEFAULT 'NOT_SUBMITTED',
      ADD COLUMN IF NOT EXISTS "approval_submitted_by" uuid,
      ADD COLUMN IF NOT EXISTS "approval_submitted_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "approval_decided_by" uuid,
      ADD COLUMN IF NOT EXISTS "approval_decided_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "approval_comments" text,
      ADD COLUMN IF NOT EXISTS "approval_reason" text,
      ADD COLUMN IF NOT EXISTS "payment_request_reference" character varying(100),
      ADD COLUMN IF NOT EXISTS "payment_requested_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "payment_completed_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "payment_failure_reason" text,
      ADD COLUMN IF NOT EXISTS "tira_request_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "tira_response_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "tira_response_code" character varying(50),
      ADD COLUMN IF NOT EXISTS "tira_response_description" character varying(255),
      ADD COLUMN IF NOT EXISTS "tira_error_details" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "quotation_status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "quotation_status" TYPE text
      USING "quotation_status"::text
    `);

    await queryRunner.query(`
      UPDATE "quotations" q
      SET "requires_payment" = COALESCE(cn.payment_mode, 1) <> 1
      FROM "quotation_cover_notes" cn
      WHERE cn.quotation_id = q.id
    `);

    await queryRunner.query(`
      UPDATE "quotations"
      SET "requires_approval" = "quotation_status" IN (
        'REFERRED',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED'
      )
    `);

    await queryRunner.query(`
      UPDATE "quotations"
      SET "approval_status" = CASE
        WHEN NOT "requires_approval" THEN 'NOT_REQUIRED'::"public"."approval_status_enum"
        WHEN "quotation_status" = 'PENDING_APPROVAL' THEN 'PENDING'::"public"."approval_status_enum"
        WHEN "quotation_status" = 'REFERRED' THEN 'PENDING'::"public"."approval_status_enum"
        WHEN "quotation_status" = 'APPROVED' THEN 'APPROVED'::"public"."approval_status_enum"
        WHEN "quotation_status" = 'REJECTED' THEN 'REJECTED'::"public"."approval_status_enum"
        ELSE 'NOT_SUBMITTED'::"public"."approval_status_enum"
      END
    `);

    await queryRunner.query(`
      UPDATE "quotations"
      SET "payment_status" = CASE
        WHEN NOT "requires_payment" THEN 'NOT_REQUIRED'::"public"."payment_status_enum"
        ELSE 'NOT_INITIATED'::"public"."payment_status_enum"
      END
    `);

    await queryRunner.query(`
      WITH latest_invoices AS (
        SELECT DISTINCT ON (invoice.quotation_id)
          invoice.quotation_id,
          UPPER(COALESCE(invoice.status, '')) AS status,
          COALESCE(invoice.total_amount, 0) AS total_amount,
          COALESCE(invoice.paid_amount, 0) AS paid_amount,
          COALESCE(invoice.balance_amount, 0) AS balance_amount,
          invoice.due_date
        FROM invoices invoice
        WHERE invoice.deleted_at IS NULL
          AND invoice.quotation_id IS NOT NULL
        ORDER BY invoice.quotation_id, invoice.created_at DESC, invoice.id DESC
      ),
      latest_payments AS (
        SELECT DISTINCT ON (invoice.quotation_id)
          invoice.quotation_id,
          UPPER(COALESCE(payment.status, '')) AS status
        FROM payment_transactions payment
        INNER JOIN invoices invoice
          ON invoice.id = payment.invoice_id
        WHERE payment.deleted_at IS NULL
          AND invoice.deleted_at IS NULL
          AND invoice.quotation_id IS NOT NULL
        ORDER BY invoice.quotation_id, payment.created_at DESC, payment.id DESC
      )
      UPDATE quotations q
      SET payment_status = CASE
        WHEN NOT q.requires_payment THEN 'NOT_REQUIRED'::"public"."payment_status_enum"
        WHEN li.quotation_id IS NULL THEN 'NOT_INITIATED'::"public"."payment_status_enum"
        WHEN li.status IN ('PAID', 'SETTLED')
          OR (
            li.total_amount > 0
            AND li.balance_amount <= 0
            AND li.paid_amount >= li.total_amount
          )
          THEN 'PAID'::"public"."payment_status_enum"
        WHEN li.paid_amount > 0 AND li.balance_amount > 0
          THEN 'PARTIALLY_PAID'::"public"."payment_status_enum"
        WHEN lp.status IN ('PROCESSING', 'PENDING')
          THEN 'PROCESSING'::"public"."payment_status_enum"
        WHEN lp.status IN ('FAILED', 'DECLINED', 'ERROR')
          THEN 'FAILED'::"public"."payment_status_enum"
        WHEN li.due_date IS NOT NULL
          AND li.due_date < CURRENT_DATE
          AND li.balance_amount > 0
          THEN 'EXPIRED'::"public"."payment_status_enum"
        ELSE 'REQUESTED'::"public"."payment_status_enum"
      END,
      payment_requested_at = CASE
        WHEN li.quotation_id IS NOT NULL THEN COALESCE(q.payment_requested_at, q.updated_at)
        ELSE q.payment_requested_at
      END,
      payment_completed_at = CASE
        WHEN li.status IN ('PAID', 'SETTLED')
          OR (
            li.total_amount > 0
            AND li.balance_amount <= 0
            AND li.paid_amount >= li.total_amount
          )
          THEN COALESCE(q.payment_completed_at, q.updated_at)
        ELSE q.payment_completed_at
      END
      FROM latest_invoices li
      LEFT JOIN latest_payments lp
        ON lp.quotation_id = li.quotation_id
      WHERE q.id = li.quotation_id
    `);

    await queryRunner.query(`
      WITH latest_submission AS (
        SELECT DISTINCT ON (submission.quotation_id)
          submission.quotation_id,
          submission.status,
          submission.tiramis_request_id,
          submission.tiramis_response_id,
          submission.status_code,
          submission.status_description,
          submission.last_error
        FROM portal_tira_submissions submission
        WHERE submission.deleted_at IS NULL
          AND submission.quotation_id IS NOT NULL
        ORDER BY submission.quotation_id, submission.created_at DESC, submission.id DESC
      )
      UPDATE quotations q
      SET tira_status = CASE
        WHEN ls.status IN ('SUBMITTED_TO_TIRAMIS', 'SENT_TO_TIRA')
          THEN 'SUBMITTED'::"public"."tira_status_enum"
        WHEN ls.status IN ('ACK_SUCCESS', 'WAITING_FINAL_RESPONSE')
          THEN 'PROCESSING'::"public"."tira_status_enum"
        WHEN ls.status = 'COMPLETED'
          THEN 'SUCCESS'::"public"."tira_status_enum"
        WHEN ls.status = 'CALLBACK_REJECTED'
          THEN 'REJECTED'::"public"."tira_status_enum"
        WHEN ls.status IN ('FAILED', 'ACK_FAILED', 'FINAL_FAILED', 'FINAL_CALLBACK_OVERDUE')
          THEN 'FAILED'::"public"."tira_status_enum"
        ELSE q.tira_status
      END,
      tira_request_id = COALESCE(ls.tiramis_request_id, q.tira_request_id),
      tira_response_id = COALESCE(ls.tiramis_response_id, q.tira_response_id),
      tira_response_code = COALESCE(ls.status_code, q.tira_response_code),
      tira_response_description = COALESCE(ls.status_description, q.tira_response_description),
      tira_error_details = CASE
        WHEN ls.last_error IS NOT NULL
          THEN jsonb_build_object('legacyError', ls.last_error)
        ELSE q.tira_error_details
      END
      FROM latest_submission ls
      WHERE q.id = ls.quotation_id
    `);

    await queryRunner.query(`
      UPDATE "quotations"
      SET "tira_status" = CASE
        WHEN "quotation_status" IN ('COMPLETED', 'CONVERTED')
          THEN 'SUCCESS'::"public"."tira_status_enum"
        WHEN "quotation_status" = 'FAILED'
          THEN 'FAILED'::"public"."tira_status_enum"
        WHEN "quotation_status" = 'SUBMITTED_TO_TIRA'
          THEN 'SUBMITTED'::"public"."tira_status_enum"
        ELSE "tira_status"
      END
    `);

    await queryRunner.query(`
      UPDATE "quotations"
      SET "quotation_status" = CASE
        WHEN "quotation_status" = 'DRAFT' THEN 'DRAFT'
        WHEN "quotation_status" = 'EXPIRED' THEN 'EXPIRED'
        WHEN "quotation_status" = 'CANCELLED' THEN 'CANCELLED'
        WHEN "quotation_status" IN ('COMPLETED', 'CONVERTED') THEN 'COMPLETED'
        WHEN "quotation_status" = 'REJECTED' THEN 'REJECTED'
        WHEN "quotation_status" = 'FAILED' THEN 'FAILED'
        WHEN "quotation_status" = 'SUBMITTED_TO_TIRA' THEN CASE
          WHEN "tira_status" = 'PROCESSING' THEN 'TIRA_PROCESSING'
          WHEN "tira_status" = 'SUCCESS' THEN 'COMPLETED'
          WHEN "tira_status" = 'REJECTED' THEN 'REJECTED'
          WHEN "tira_status" = 'FAILED' THEN 'FAILED'
          ELSE 'SUBMITTED_TO_TIRA'
        END
        WHEN "quotation_status" IN ('PENDING_APPROVAL', 'REFERRED') THEN 'PENDING_REQUIREMENTS'
        WHEN "quotation_status" IN ('APPROVED', 'RATED') THEN CASE
          WHEN (NOT "requires_approval" OR "approval_status" = 'APPROVED')
            AND (NOT "requires_payment" OR "payment_status" = 'PAID')
            THEN 'READY_FOR_SUBMISSION'
          ELSE 'PENDING_REQUIREMENTS'
        END
        ELSE 'DRAFT'
      END
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "quotation_status" TYPE "public"."quotation_status_enum"
      USING "quotation_status"::"public"."quotation_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "quotation_status" SET DEFAULT 'DRAFT'
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_status_history"
      ADD COLUMN IF NOT EXISTS "previous_quotation_status" "public"."quotation_status_enum",
      ADD COLUMN IF NOT EXISTS "new_quotation_status" "public"."quotation_status_enum",
      ADD COLUMN IF NOT EXISTS "previous_approval_status" "public"."approval_status_enum",
      ADD COLUMN IF NOT EXISTS "new_approval_status" "public"."approval_status_enum",
      ADD COLUMN IF NOT EXISTS "previous_payment_status" "public"."payment_status_enum",
      ADD COLUMN IF NOT EXISTS "new_payment_status" "public"."payment_status_enum",
      ADD COLUMN IF NOT EXISTS "previous_tira_status" "public"."tira_status_enum",
      ADD COLUMN IF NOT EXISTS "new_tira_status" "public"."tira_status_enum",
      ADD COLUMN IF NOT EXISTS "transition_type" character varying(80),
      ADD COLUMN IF NOT EXISTS "comments" text,
      ADD COLUMN IF NOT EXISTS "changed_by_type" character varying(40),
      ADD COLUMN IF NOT EXISTS "source" character varying(40),
      ADD COLUMN IF NOT EXISTS "channel" character varying(40),
      ADD COLUMN IF NOT EXISTS "request_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "payment_transaction_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "tira_request_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "tira_response_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);

    await queryRunner.query(`
      UPDATE "quotation_status_history"
      SET
        "previous_quotation_status" = CASE
          WHEN "old_status"::text = 'DRAFT' THEN 'DRAFT'::"public"."quotation_status_enum"
          WHEN "old_status"::text IN ('REFERRED', 'PENDING_APPROVAL') THEN 'PENDING_REQUIREMENTS'::"public"."quotation_status_enum"
          WHEN "old_status"::text IN ('RATED', 'APPROVED') THEN 'READY_FOR_SUBMISSION'::"public"."quotation_status_enum"
          WHEN "old_status"::text = 'SUBMITTED_TO_TIRA' THEN 'SUBMITTED_TO_TIRA'::"public"."quotation_status_enum"
          WHEN "old_status"::text IN ('COMPLETED', 'CONVERTED') THEN 'COMPLETED'::"public"."quotation_status_enum"
          WHEN "old_status"::text = 'REJECTED' THEN 'REJECTED'::"public"."quotation_status_enum"
          WHEN "old_status"::text = 'FAILED' THEN 'FAILED'::"public"."quotation_status_enum"
          WHEN "old_status"::text = 'CANCELLED' THEN 'CANCELLED'::"public"."quotation_status_enum"
          WHEN "old_status"::text = 'EXPIRED' THEN 'EXPIRED'::"public"."quotation_status_enum"
          ELSE NULL
        END,
        "new_quotation_status" = CASE
          WHEN "new_status"::text = 'DRAFT' THEN 'DRAFT'::"public"."quotation_status_enum"
          WHEN "new_status"::text IN ('REFERRED', 'PENDING_APPROVAL') THEN 'PENDING_REQUIREMENTS'::"public"."quotation_status_enum"
          WHEN "new_status"::text IN ('RATED', 'APPROVED') THEN 'READY_FOR_SUBMISSION'::"public"."quotation_status_enum"
          WHEN "new_status"::text = 'SUBMITTED_TO_TIRA' THEN 'SUBMITTED_TO_TIRA'::"public"."quotation_status_enum"
          WHEN "new_status"::text IN ('COMPLETED', 'CONVERTED') THEN 'COMPLETED'::"public"."quotation_status_enum"
          WHEN "new_status"::text = 'REJECTED' THEN 'REJECTED'::"public"."quotation_status_enum"
          WHEN "new_status"::text = 'FAILED' THEN 'FAILED'::"public"."quotation_status_enum"
          WHEN "new_status"::text = 'CANCELLED' THEN 'CANCELLED'::"public"."quotation_status_enum"
          WHEN "new_status"::text = 'EXPIRED' THEN 'EXPIRED'::"public"."quotation_status_enum"
          ELSE NULL
        END,
        "transition_type" = COALESCE("transition_type", 'LEGACY_STATUS_MIGRATION'),
        "changed_by_type" = COALESCE("changed_by_type", 'USER'),
        "source" = COALESCE("source", 'SYSTEM')
      WHERE "previous_quotation_status" IS NULL
        OR "new_quotation_status" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_approval_submitted_by"
      FOREIGN KEY ("approval_submitted_by")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotations_approval_decided_by"
      FOREIGN KEY ("approval_decided_by")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_approval_status"
      ON "quotations" ("company_id", "approval_status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_payment_status"
      ON "quotations" ("company_id", "payment_status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_company_tira_status"
      ON "quotations" ("company_id", "tira_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_company_tira_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_company_payment_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotations_company_approval_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_approval_decided_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotations_approval_submitted_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_status_history"
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "tira_response_id",
      DROP COLUMN IF EXISTS "tira_request_id",
      DROP COLUMN IF EXISTS "payment_transaction_id",
      DROP COLUMN IF EXISTS "request_id",
      DROP COLUMN IF EXISTS "channel",
      DROP COLUMN IF EXISTS "source",
      DROP COLUMN IF EXISTS "changed_by_type",
      DROP COLUMN IF EXISTS "comments",
      DROP COLUMN IF EXISTS "transition_type",
      DROP COLUMN IF EXISTS "new_tira_status",
      DROP COLUMN IF EXISTS "previous_tira_status",
      DROP COLUMN IF EXISTS "new_payment_status",
      DROP COLUMN IF EXISTS "previous_payment_status",
      DROP COLUMN IF EXISTS "new_approval_status",
      DROP COLUMN IF EXISTS "previous_approval_status",
      DROP COLUMN IF EXISTS "new_quotation_status",
      DROP COLUMN IF EXISTS "previous_quotation_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "tira_error_details",
      DROP COLUMN IF EXISTS "tira_response_description",
      DROP COLUMN IF EXISTS "tira_response_code",
      DROP COLUMN IF EXISTS "tira_response_id",
      DROP COLUMN IF EXISTS "tira_request_id",
      DROP COLUMN IF EXISTS "payment_failure_reason",
      DROP COLUMN IF EXISTS "payment_completed_at",
      DROP COLUMN IF EXISTS "payment_requested_at",
      DROP COLUMN IF EXISTS "payment_request_reference",
      DROP COLUMN IF EXISTS "approval_reason",
      DROP COLUMN IF EXISTS "approval_comments",
      DROP COLUMN IF EXISTS "approval_decided_at",
      DROP COLUMN IF EXISTS "approval_decided_by",
      DROP COLUMN IF EXISTS "approval_submitted_at",
      DROP COLUMN IF EXISTS "approval_submitted_by",
      DROP COLUMN IF EXISTS "tira_status",
      DROP COLUMN IF EXISTS "payment_status",
      DROP COLUMN IF EXISTS "approval_status",
      DROP COLUMN IF EXISTS "requires_payment",
      DROP COLUMN IF EXISTS "requires_approval"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "quotation_status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "quotation_status" TYPE "public"."quotation_status_enum_legacy"
      USING CASE
        WHEN "quotation_status"::text = 'PENDING_REQUIREMENTS' THEN 'PENDING_APPROVAL'
        WHEN "quotation_status"::text = 'READY_FOR_SUBMISSION' THEN 'APPROVED'
        WHEN "quotation_status"::text = 'SUBMITTING_TO_TIRA' THEN 'SUBMITTED_TO_TIRA'
        WHEN "quotation_status"::text = 'TIRA_PROCESSING' THEN 'SUBMITTED_TO_TIRA'
        WHEN "quotation_status"::text = 'COMPLETED' THEN 'COMPLETED'
        WHEN "quotation_status"::text = 'FAILED' THEN 'FAILED'
        WHEN "quotation_status"::text = 'REJECTED' THEN 'REJECTED'
        WHEN "quotation_status"::text = 'CANCELLED' THEN 'CANCELLED'
        WHEN "quotation_status"::text = 'EXPIRED' THEN 'EXPIRED'
        ELSE 'DRAFT'
      END::"public"."quotation_status_enum_legacy"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      RENAME COLUMN "quotation_status" TO "status"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ALTER COLUMN "status" SET DEFAULT 'DRAFT'
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tira_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."payment_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."approval_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."quotation_status_enum"`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'quotation_status_enum_legacy'
        ) THEN
          ALTER TYPE "public"."quotation_status_enum_legacy"
          RENAME TO "quotation_status_enum";
        END IF;
      END
      $$;
    `);
  }
}
