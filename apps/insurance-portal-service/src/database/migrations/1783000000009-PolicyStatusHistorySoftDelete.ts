import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyStatusHistorySoftDelete1783000000009 implements MigrationInterface {
  name = 'PolicyStatusHistorySoftDelete1783000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "policy_status_history" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_status_history" DROP COLUMN "deleted_at"`,
    );
  }
}
