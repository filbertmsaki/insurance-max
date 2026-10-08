import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueActiveReconciliationMatches1792600000000 implements MigrationInterface {
  name = 'UniqueActiveReconciliationMatches1792600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const duplicatePayments = await queryRunner.query(`
      SELECT matched_payment_transaction_id AS id, COUNT(*) AS match_count
      FROM finance_reconciliation_items
      WHERE status = 'MATCHED' AND matched_payment_transaction_id IS NOT NULL
      GROUP BY matched_payment_transaction_id
      HAVING COUNT(*) > 1
      LIMIT 20
    `);
    const duplicateReceipts = await queryRunner.query(`
      SELECT matched_receipt_id AS id, COUNT(*) AS match_count
      FROM finance_reconciliation_items
      WHERE status = 'MATCHED' AND matched_receipt_id IS NOT NULL
      GROUP BY matched_receipt_id
      HAVING COUNT(*) > 1
      LIMIT 20
    `);

    if (duplicatePayments.length || duplicateReceipts.length) {
      throw new Error(
        `Reconciliation contains duplicate active matches; resolve them before migration. Payments: ${JSON.stringify(duplicatePayments)}; receipts: ${JSON.stringify(duplicateReceipts)}`,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_reconciliation_matched_payment_active"
      ON "finance_reconciliation_items" ("matched_payment_transaction_id")
      WHERE "status" = 'MATCHED'
        AND "matched_payment_transaction_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_reconciliation_matched_receipt_active"
      ON "finance_reconciliation_items" ("matched_receipt_id")
      WHERE "status" = 'MATCHED'
        AND "matched_receipt_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_reconciliation_matched_receipt_active"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_reconciliation_matched_payment_active"',
    );
  }
}
