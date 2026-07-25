import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentAttemptIdToTiramisReinsurances1783194327684 implements MigrationInterface {
  name = 'AddCurrentAttemptIdToTiramisReinsurances1783194327684';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" ADD COLUMN IF NOT EXISTS "current_attempt_id" uuid NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" DROP COLUMN IF EXISTS "current_attempt_id"`,
    );
  }
}
