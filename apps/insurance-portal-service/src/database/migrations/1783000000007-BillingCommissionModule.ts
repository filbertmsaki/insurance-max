import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingCommissionModule1783000000007 implements MigrationInterface {
  name = 'BillingCommissionModule1783000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "customer_id" uuid NOT NULL, "quotation_id" uuid, "policy_id" uuid, "endorsement_id" uuid, "cancellation_id" uuid, "renewal_id" uuid, "invoice_no" character varying(50) NOT NULL, "invoice_type" character varying(30) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "gross_amount" numeric(18,2) NOT NULL DEFAULT '0', "discount_amount" numeric(18,2) NOT NULL DEFAULT '0', "tax_amount" numeric(18,2) NOT NULL DEFAULT '0', "charges_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "paid_amount" numeric(18,2) NOT NULL DEFAULT '0', "balance_amount" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'DRAFT', "due_date" date, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_invoices" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_company_id" ON "invoices" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_company_status" ON "invoices" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_company_customer_id" ON "invoices" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_invoices_company_invoice_no" ON "invoices" ("company_id", "invoice_no") WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "item_type" character varying(50) NOT NULL, "item_name" character varying(150) NOT NULL, "description" text, "quantity" numeric(18,2) NOT NULL DEFAULT '0', "unit_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_invoice_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_items_invoice_id" ON "invoice_items" ("invoice_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "receipt_no" character varying(50) NOT NULL, "payment_method" character varying(50) NOT NULL, "amount" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "payment_reference" character varying(100), "received_by" uuid, "received_at" TIMESTAMP WITH TIME ZONE, "status" character varying(20) NOT NULL DEFAULT 'RECEIVED', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_receipts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receipts_company_id" ON "receipts" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receipts_company_customer_id" ON "receipts" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_receipts_company_receipt_no" ON "receipts" ("company_id", "receipt_no") WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "payment_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "invoice_id" uuid, "receipt_id" uuid, "provider" character varying(50) NOT NULL, "provider_reference" character varying(100) NOT NULL, "internal_reference" character varying(100) NOT NULL, "amount" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(20) NOT NULL DEFAULT 'PENDING', "request_payload" jsonb, "response_payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_payment_transactions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_company_id" ON "payment_transactions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_invoice_id" ON "payment_transactions" ("invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_receipt_id" ON "payment_transactions" ("receipt_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "commission_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid NOT NULL, "policy_id" uuid NOT NULL, "invoice_id" uuid, "receipt_id" uuid, "commission_rule_id" uuid, "commission_type" character varying(30) NOT NULL, "calculation_base" character varying(30) NOT NULL, "gross_premium" numeric(18,2) NOT NULL DEFAULT '0', "net_premium" numeric(18,2) NOT NULL DEFAULT '0', "commission_rate" numeric(18,6) NOT NULL DEFAULT '0', "commission_amount" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'PENDING', "earned_at" TIMESTAMP WITH TIME ZONE, "paid_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_commission_transactions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_transactions_company_id" ON "commission_transactions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_transactions_policy_id" ON "commission_transactions" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_transactions_status" ON "commission_transactions" ("status") `,
    );

    await queryRunner.query(
      `CREATE TABLE "commission_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "intermediary_company_id" uuid NOT NULL, "payment_no" character varying(50) NOT NULL, "payment_method" character varying(50) NOT NULL, "payment_reference" character varying(100), "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(20) NOT NULL DEFAULT 'PENDING', "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "paid_by" uuid, "paid_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_commission_payments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_payments_company_id" ON "commission_payments" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_payments_intermediary_company_id" ON "commission_payments" ("intermediary_company_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_commission_payments_payment_no" ON "commission_payments" ("company_id", "payment_no") WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "commission_payment_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "commission_payment_id" uuid NOT NULL, "commission_transaction_id" uuid NOT NULL, "amount" numeric(18,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_commission_payment_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cpi_commission_payment_id" ON "commission_payment_items" ("commission_payment_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cpi_commission_transaction_id" ON "commission_payment_items" ("commission_transaction_id") `,
    );

    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_insurer_company" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_intermediary_company" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_quotation" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_invoice_items_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_received_by" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_payment_transactions_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_payment_transactions_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_payment_transactions_receipt" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_commission_transactions_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_commission_transactions_insurer_company" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_commission_transactions_intermediary_company" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_commission_transactions_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_commission_transactions_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_commission_transactions_receipt" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_commission_transactions_rule" FOREIGN KEY ("commission_rule_id") REFERENCES "product_commission_rules"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_commission_payments_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_commission_payments_intermediary_company" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_commission_payments_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_commission_payments_paid_by" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" ADD CONSTRAINT "FK_cpi_payment" FOREIGN KEY ("commission_payment_id") REFERENCES "commission_payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" ADD CONSTRAINT "FK_cpi_transaction" FOREIGN KEY ("commission_transaction_id") REFERENCES "commission_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" DROP CONSTRAINT "FK_cpi_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" DROP CONSTRAINT "FK_cpi_payment"`,
    );

    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_commission_payments_paid_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_commission_payments_approved_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_commission_payments_intermediary_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_commission_payments_company"`,
    );

    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_commission_transactions_rule"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_commission_transactions_receipt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_commission_transactions_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_commission_transactions_policy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_commission_transactions_intermediary_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_commission_transactions_insurer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_commission_transactions_company"`,
    );

    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_receipt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_company"`,
    );

    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_received_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_company"`,
    );

    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_invoice_items_invoice"`,
    );

    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_policy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_quotation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_intermediary_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_insurer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_company"`,
    );

    await queryRunner.query(`DROP TABLE "commission_payment_items"`);
    await queryRunner.query(`DROP TABLE "commission_payments"`);
    await queryRunner.query(`DROP TABLE "commission_transactions"`);
    await queryRunner.query(`DROP TABLE "payment_transactions"`);
    await queryRunner.query(`DROP TABLE "receipts"`);
    await queryRunner.query(`DROP TABLE "invoice_items"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
  }
}
