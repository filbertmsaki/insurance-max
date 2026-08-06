import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinancePostingAndReconciliation1795200000000 implements MigrationInterface {
  name = 'FinancePostingAndReconciliation1795200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "source_type" character varying(40) NOT NULL DEFAULT 'MANUAL',
      ADD COLUMN IF NOT EXISTS "source_record_id" uuid,
      ADD COLUMN IF NOT EXISTS "source_revision" integer,
      ADD COLUMN IF NOT EXISTS "pricing_result_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "source_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "allocated_amount" numeric(20,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "refunded_amount" numeric(20,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "written_off_amount" numeric(20,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "balance_revision" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "balance_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "issued_by" uuid,
      ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "notes" text
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'CHK_invoice_finance_amounts'
        ) THEN
          ALTER TABLE "invoices"
          ADD CONSTRAINT "CHK_invoice_finance_amounts"
          CHECK (
            "total_amount" >= 0
            AND "allocated_amount" >= 0
            AND "refunded_amount" >= 0
            AND "written_off_amount" >= 0
            AND "balance_amount" >= 0
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoice_source_revision"
      ON "invoices" ("company_id", "source_type", "source_record_id", "source_revision")
      WHERE
        "source_record_id" IS NOT NULL
        AND "source_revision" IS NOT NULL
        AND "status" NOT IN ('VOID', 'VOIDED')
        AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ADD COLUMN IF NOT EXISTS "source_line_type" character varying(50),
      ADD COLUMN IF NOT EXISTS "source_line_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "line_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "line_hash" character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD COLUMN IF NOT EXISTS "transaction_no" character varying(80),
      ADD COLUMN IF NOT EXISTS "customer_id" uuid,
      ADD COLUMN IF NOT EXISTS "provider_code" character varying(50),
      ADD COLUMN IF NOT EXISTS "provider_transaction_id" character varying(150),
      ADD COLUMN IF NOT EXISTS "provider_event_id" character varying(150),
      ADD COLUMN IF NOT EXISTS "payment_method" character varying(40),
      ADD COLUMN IF NOT EXISTS "provider_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "provider_currency_code" character varying(3),
      ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(20,10) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "payer_name" character varying(180),
      ADD COLUMN IF NOT EXISTS "payer_phone" character varying(50),
      ADD COLUMN IF NOT EXISTS "payer_email" character varying(180),
      ADD COLUMN IF NOT EXISTS "payment_reference" character varying(180),
      ADD COLUMN IF NOT EXISTS "bank_reference" character varying(180),
      ADD COLUMN IF NOT EXISTS "channel_reference" character varying(180),
      ADD COLUMN IF NOT EXISTS "idempotency_key" character varying(180),
      ADD COLUMN IF NOT EXISTS "request_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "provider_payload_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "provider_payload_redacted" jsonb,
      ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "failure_code" character varying(100),
      ADD COLUMN IF NOT EXISTS "failure_message" text,
      ADD COLUMN IF NOT EXISTS "created_by" uuid,
      ADD COLUMN IF NOT EXISTS "updated_by" uuid
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_transaction_no"
      ON "payment_transactions" ("company_id", "transaction_no")
      WHERE "transaction_no" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_transaction_idempotency"
      ON "payment_transactions" ("company_id", "provider_code", "idempotency_key")
      WHERE "provider_code" IS NOT NULL AND "idempotency_key" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_provider_transaction"
      ON "payment_transactions" ("company_id", "provider_code", "provider_transaction_id")
      WHERE "provider_code" IS NOT NULL AND "provider_transaction_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_provider_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid,
        "provider_code" character varying(50) NOT NULL,
        "provider_event_id" character varying(180) NOT NULL,
        "event_type" character varying(80) NOT NULL,
        "signature_valid" boolean NOT NULL DEFAULT false,
        "payload_hash" character varying(64) NOT NULL,
        "payload_redacted" jsonb NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'RECEIVED',
        "payment_transaction_id" uuid,
        "processing_error" text,
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_finance_provider_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_finance_provider_event" UNIQUE ("provider_code", "provider_event_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_finance_provider_event_payment'
        ) THEN
          ALTER TABLE "finance_provider_events"
          ADD CONSTRAINT "FK_finance_provider_event_payment"
          FOREIGN KEY ("payment_transaction_id")
          REFERENCES "payment_transactions"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "receipts"
      ADD COLUMN IF NOT EXISTS "payment_transaction_id" uuid,
      ADD COLUMN IF NOT EXISTS "payer_customer_id" uuid,
      ADD COLUMN IF NOT EXISTS "payer_name" character varying(180),
      ADD COLUMN IF NOT EXISTS "provider_reference" character varying(180),
      ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(20,10) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "base_currency_code" character varying(3),
      ADD COLUMN IF NOT EXISTS "base_currency_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "allocated_amount" numeric(20,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "receipt_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "reversal_receipt_id" uuid,
      ADD COLUMN IF NOT EXISTS "state_version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_receipt_payment_transaction'
        ) THEN
          ALTER TABLE "receipts"
          ADD CONSTRAINT "FK_receipt_payment_transaction"
          FOREIGN KEY ("payment_transaction_id")
          REFERENCES "payment_transactions"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_receipt_payment_transaction"
      ON "receipts" ("payment_transaction_id")
      WHERE
        "payment_transaction_id" IS NOT NULL
        AND "status" <> 'REVERSED'
        AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "receipt_allocations"
      ADD COLUMN IF NOT EXISTS "allocation_hash" character varying(64)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_refunds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "refund_no" character varying(80) NOT NULL,
        "customer_id" uuid,
        "invoice_id" uuid,
        "receipt_id" uuid,
        "payment_transaction_id" uuid,
        "status" character varying(30) NOT NULL DEFAULT 'REQUESTED',
        "payment_method" character varying(40) NOT NULL,
        "amount" numeric(20,4) NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "reason" text NOT NULL,
        "requested_by" uuid NOT NULL,
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "approved_by" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "provider_refund_id" character varying(180),
        "paid_by" uuid,
        "paid_at" TIMESTAMP WITH TIME ZONE,
        "failed_at" TIMESTAMP WITH TIME ZONE,
        "failure_message" text,
        "idempotency_key" character varying(180) NOT NULL,
        "refund_hash" character varying(64),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_finance_refunds" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_finance_refund_number" UNIQUE ("company_id", "refund_no"),
        CONSTRAINT "UQ_finance_refund_idempotency" UNIQUE ("company_id", "idempotency_key"),
        CONSTRAINT "CHK_finance_refund_amount" CHECK ("amount" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "account_code" character varying(50) NOT NULL,
        "account_name" character varying(150) NOT NULL,
        "account_type" character varying(30) NOT NULL,
        "is_control_account" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_finance_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_finance_account_code" UNIQUE ("company_id", "account_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_journal_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "journal_no" character varying(80) NOT NULL,
        "journal_date" date NOT NULL,
        "source_type" character varying(50) NOT NULL,
        "source_id" uuid NOT NULL,
        "source_event_id" character varying(180) NOT NULL,
        "description" text NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'POSTED',
        "reversal_of_id" uuid,
        "posted_by" uuid,
        "posted_at" TIMESTAMP WITH TIME ZONE,
        "entry_hash" character varying(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_finance_journal_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_finance_journal_number" UNIQUE ("company_id", "journal_no"),
        CONSTRAINT "UQ_finance_journal_source_event" UNIQUE ("company_id", "source_type", "source_event_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_journal_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "journal_entry_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "customer_id" uuid,
        "intermediary_company_id" uuid,
        "description" text,
        "debit" numeric(20,4) NOT NULL DEFAULT 0,
        "credit" numeric(20,4) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_finance_journal_lines" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_finance_journal_line_side"
          CHECK (( "debit" > 0 AND "credit" = 0 ) OR ( "credit" > 0 AND "debit" = 0 ))
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      ADD COLUMN IF NOT EXISTS "quotation_id" uuid,
      ADD COLUMN IF NOT EXISTS "distribution_option_id" uuid,
      ADD COLUMN IF NOT EXISTS "accrual_no" character varying(80),
      ADD COLUMN IF NOT EXISTS "commission_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "commission_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "accrued_by" uuid,
      ADD COLUMN IF NOT EXISTS "accrued_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "reversed_by" uuid,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "reversal_reason" text
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commission_transaction_accrual_no"
      ON "commission_transactions" ("company_id", "accrual_no")
      WHERE "accrual_no" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commission_transaction_source"
      ON "commission_transactions" ("company_id", "quotation_id", "intermediary_company_id")
      WHERE "quotation_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_payments"
      ADD COLUMN IF NOT EXISTS "allocated_amount" numeric(20,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "unallocated_amount" numeric(20,4) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_payment_items"
      ADD COLUMN IF NOT EXISTS "status" character varying(30) NOT NULL DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS "allocated_by" uuid,
      ADD COLUMN IF NOT EXISTS "allocated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "reversed_by" uuid,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "reversal_reason" text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_reconciliation_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "batch_no" character varying(80) NOT NULL,
        "provider_code" character varying(50) NOT NULL,
        "account_reference" character varying(100),
        "statement_reference" character varying(150),
        "statement_date" date NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "opening_balance" numeric(20,4),
        "closing_balance" numeric(20,4),
        "statement_total" numeric(20,4) NOT NULL DEFAULT 0,
        "matched_total" numeric(20,4) NOT NULL DEFAULT 0,
        "unmatched_total" numeric(20,4) NOT NULL DEFAULT 0,
        "status" character varying(30) NOT NULL DEFAULT 'DRAFT',
        "file_hash" character varying(64),
        "imported_by" uuid,
        "imported_at" TIMESTAMP WITH TIME ZONE,
        "approved_by" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_finance_reconciliation_batches" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_finance_reconciliation_batch" UNIQUE ("company_id", "batch_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_reconciliation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "batch_id" uuid NOT NULL,
        "line_number" integer NOT NULL,
        "transaction_date" date NOT NULL,
        "value_date" date,
        "description" text,
        "external_reference" character varying(180),
        "payer_reference" character varying(180),
        "amount" numeric(20,4) NOT NULL,
        "currency_code" character varying(3) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'UNMATCHED',
        "matched_payment_transaction_id" uuid,
        "matched_receipt_id" uuid,
        "match_score" numeric(8,4),
        "match_reason" text,
        "matched_by" uuid,
        "matched_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_finance_reconciliation_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reconciliation_batch_line" UNIQUE ("batch_id", "line_number")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finance_outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "aggregate_type" character varying(80) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "event_type" character varying(100) NOT NULL,
        "event_key" character varying(180) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'PENDING',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "published_at" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_finance_outbox_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_finance_outbox_event_key" UNIQUE ("company_id", "event_key")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_outbox_events"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "finance_reconciliation_items"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "finance_reconciliation_batches"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_journal_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_journal_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_refunds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "finance_provider_events"`);
  }
}
