import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2FinancePolicyLifecycle1793600000000 implements MigrationInterface {
  name = 'Phase2FinancePolicyLifecycle1793600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_document_sequences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "document_type" varchar(50) NOT NULL,
        "period_key" varchar(20) NOT NULL,
        "current_value" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_business_document_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_business_document_sequences"
          UNIQUE ("company_id", "document_type", "period_key")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "branch_id" uuid,
        ADD COLUMN IF NOT EXISTS "sale_point_id" uuid,
        ADD COLUMN IF NOT EXISTS "posted_by" uuid,
        ADD COLUMN IF NOT EXISTS "posted_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "voided_by" uuid,
        ADD COLUMN IF NOT EXISTS "voided_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "void_reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "receipts"
        ADD COLUMN IF NOT EXISTS "branch_id" uuid,
        ADD COLUMN IF NOT EXISTS "sale_point_id" uuid,
        ADD COLUMN IF NOT EXISTS "unallocated_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "posted_by" uuid,
        ADD COLUMN IF NOT EXISTS "posted_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "reversed_by" uuid,
        ADD COLUMN IF NOT EXISTS "reversed_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "reversal_reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
        ADD COLUMN IF NOT EXISTS "reconciliation_status" varchar(20) NOT NULL DEFAULT 'UNMATCHED',
        ADD COLUMN IF NOT EXISTS "reconciled_by" uuid,
        ADD COLUMN IF NOT EXISTS "reconciled_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "bank_statement_line_id" uuid,
        ADD COLUMN IF NOT EXISTS "reversed_by" uuid,
        ADD COLUMN IF NOT EXISTS "reversed_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "reversal_reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
        ADD COLUMN IF NOT EXISTS "approved_by" uuid,
        ADD COLUMN IF NOT EXISTS "approved_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "paid_amount" numeric(20,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "balance_amount" numeric(20,4) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_payments"
        ADD COLUMN IF NOT EXISTS "branch_id" uuid,
        ADD COLUMN IF NOT EXISTS "sale_point_id" uuid,
        ADD COLUMN IF NOT EXISTS "submitted_by" uuid,
        ADD COLUMN IF NOT EXISTS "submitted_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "rejected_by" uuid,
        ADD COLUMN IF NOT EXISTS "rejected_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "rejection_reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "policies"
        ADD COLUMN IF NOT EXISTS "current_version_no" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "renewed_from_policy_id" uuid,
        ADD COLUMN IF NOT EXISTS "renewed_to_policy_id" uuid
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "receipt_allocations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "receipt_id" uuid NOT NULL,
        "invoice_id" uuid NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "allocated_by" uuid,
        "allocated_at" timestamptz NOT NULL DEFAULT now(),
        "reversed_by" uuid,
        "reversed_at" timestamptz,
        "reversal_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_receipt_allocations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_receipt_allocation_amount" CHECK ("amount" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_receipt_allocations_active_pair"
      ON "receipt_allocations" ("receipt_id", "invoice_id")
      WHERE "status" = 'ACTIVE'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_receipt_allocations_invoice"
      ON "receipt_allocations" ("company_id", "invoice_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "financial_reversals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "reversal_no" varchar(60) NOT NULL,
        "resource_type" varchar(50) NOT NULL,
        "resource_id" uuid NOT NULL,
        "original_amount" numeric(18,2) NOT NULL,
        "reversal_amount" numeric(18,2) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "reason" text NOT NULL,
        "created_by" uuid,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_financial_reversals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_financial_reversal_no" UNIQUE ("company_id", "reversal_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "domain" varchar(50) NOT NULL,
        "resource_type" varchar(80) NOT NULL,
        "resource_id" uuid NOT NULL,
        "title" varchar(180) NOT NULL,
        "description" text,
        "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "assigned_user_id" uuid,
        "assigned_role" varchar(100),
        "due_at" timestamptz,
        "dedupe_key" varchar(180),
        "metadata" jsonb,
        "created_by" uuid,
        "completed_by" uuid,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_work_items_company_status"
      ON "work_items" ("company_id", "status", "due_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "recipient_user_id" uuid,
        "recipient_role" varchar(100),
        "type" varchar(50) NOT NULL,
        "severity" varchar(20) NOT NULL DEFAULT 'INFO',
        "title" varchar(180) NOT NULL,
        "message" text NOT NULL,
        "resource_type" varchar(80),
        "resource_id" uuid,
        "action_url" varchar(255),
        "metadata" jsonb,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_notification_user"
      ON "tenant_notifications" ("company_id", "recipient_user_id", "read_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tenant_notification_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_notifications"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_work_items_company_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "work_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "financial_reversals"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_receipt_allocations_invoice"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_receipt_allocations_active_pair"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "receipt_allocations"`);
    await queryRunner.query(
      `ALTER TABLE "policies" DROP COLUMN IF EXISTS "renewed_to_policy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP COLUMN IF EXISTS "renewed_from_policy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP COLUMN IF EXISTS "current_version_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP COLUMN IF EXISTS "rejection_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP COLUMN IF EXISTS "rejected_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP COLUMN IF EXISTS "rejected_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP COLUMN IF EXISTS "submitted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP COLUMN IF EXISTS "submitted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP COLUMN IF EXISTS "sale_point_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP COLUMN IF EXISTS "balance_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP COLUMN IF EXISTS "paid_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP COLUMN IF EXISTS "approved_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP COLUMN IF EXISTS "approved_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "reversal_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "reversed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "reversed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "bank_statement_line_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "reconciled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "reconciled_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "reconciliation_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "reversal_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "reversed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "reversed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "posted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "posted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "unallocated_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "sale_point_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "void_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "voided_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "voided_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "posted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "posted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "sale_point_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "branch_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "business_document_sequences"`,
    );
  }
}
