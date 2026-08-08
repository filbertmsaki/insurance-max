import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourcePolicyIdOnTiramisTransactions1795400000000 implements MigrationInterface {
  name = 'SourcePolicyIdOnTiramisTransactions1795400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "source_policy_id" character varying(100)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      DROP COLUMN IF EXISTS "source_policy_id"
    `);
  }
}
