import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceSourceContext1795200000000 implements MigrationInterface {
  name = 'FinanceSourceContext1795200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "source_invoice_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "source_invoice_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "source_invoice_status" character varying(40),
      ADD COLUMN IF NOT EXISTS "source_allocated_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "source_invoice_balance_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "source_payment_gate_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "source_commission_accrual_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "source_commission_rate" numeric(18,10),
      ADD COLUMN IF NOT EXISTS "source_commission_amount" numeric(20,4)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      DROP COLUMN IF EXISTS "source_commission_amount",
      DROP COLUMN IF EXISTS "source_commission_rate",
      DROP COLUMN IF EXISTS "source_commission_accrual_id",
      DROP COLUMN IF EXISTS "source_payment_gate_hash",
      DROP COLUMN IF EXISTS "source_invoice_balance_amount",
      DROP COLUMN IF EXISTS "source_allocated_amount",
      DROP COLUMN IF EXISTS "source_invoice_status",
      DROP COLUMN IF EXISTS "source_invoice_number",
      DROP COLUMN IF EXISTS "source_invoice_id"
    `);
  }
}
