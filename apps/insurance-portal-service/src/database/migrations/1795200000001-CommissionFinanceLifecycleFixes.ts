import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommissionFinanceLifecycleFixes1795200000001 implements MigrationInterface {
  name = 'CommissionFinanceLifecycleFixes1795200000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      ALTER COLUMN "policy_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      DROP CONSTRAINT IF EXISTS "FK_commission_transactions_policy"
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      ADD CONSTRAINT "FK_commission_transactions_policy"
      FOREIGN KEY ("policy_id")
      REFERENCES "policies"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_payments"
      ADD COLUMN IF NOT EXISTS "idempotency_key" character varying(180),
      ADD COLUMN IF NOT EXISTS "reversed_by" uuid,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "reversal_reason" text
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commission_payment_idempotency"
      ON "commission_payments" ("company_id", "idempotency_key")
      WHERE "idempotency_key" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_commission_payment_idempotency"
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_payments"
      DROP COLUMN IF EXISTS "idempotency_key",
      DROP COLUMN IF EXISTS "reversal_reason",
      DROP COLUMN IF EXISTS "reversed_at",
      DROP COLUMN IF EXISTS "reversed_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      DROP CONSTRAINT IF EXISTS "FK_commission_transactions_policy"
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      ADD CONSTRAINT "FK_commission_transactions_policy"
      FOREIGN KEY ("policy_id")
      REFERENCES "policies"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "commission_transactions"
      ALTER COLUMN "policy_id" SET NOT NULL
    `);
  }
}
