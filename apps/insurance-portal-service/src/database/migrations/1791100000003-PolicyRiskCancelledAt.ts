import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `policy_risks.cancelled_at`: the date a fleet vehicle removed by a
 * "Fleet - Remove Vehicle" endorsement goes off cover. Nullable, additive.
 */
export class PolicyRiskCancelledAt1791100000003 implements MigrationInterface {
  name = 'PolicyRiskCancelledAt1791100000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "policy_risks" ADD COLUMN IF NOT EXISTS "cancelled_at" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "policy_risks" DROP COLUMN IF EXISTS "cancelled_at"`,
    );
  }
}
