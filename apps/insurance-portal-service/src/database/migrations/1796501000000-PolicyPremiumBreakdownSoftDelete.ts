import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyPremiumBreakdownSoftDelete1796501000000 implements MigrationInterface {
  name = 'PolicyPremiumBreakdownSoftDelete1796501000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "policy_premium_breakdowns"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "policy_premium_breakdowns"
      DROP COLUMN IF EXISTS "deleted_at"
    `);
  }
}
