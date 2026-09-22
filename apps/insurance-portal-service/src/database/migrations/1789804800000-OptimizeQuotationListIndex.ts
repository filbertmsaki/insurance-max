import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeQuotationListIndex1789804800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_quotations_active_list_created_at"
      ON quotations (company_id, created_at DESC, id DESC)
      WHERE deleted_at IS NULL
        AND source_policy_transaction_id IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_quotations_active_list_created_at"',
    );
  }
}
