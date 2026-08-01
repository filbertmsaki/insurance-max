import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMotorCategoryToTiramisVerificationRequests1783194327691 implements MigrationInterface {
  name = 'AddMotorCategoryToTiramisVerificationRequests1783194327691';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_verification_requests" ADD COLUMN IF NOT EXISTS "motor_category" integer NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_verification_requests" ADD CONSTRAINT "CHK_tiramis_verification_requests_motor_category" CHECK ("motor_category" IS NULL OR "motor_category" IN (1, 2))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_verification_requests" DROP CONSTRAINT IF EXISTS "CHK_tiramis_verification_requests_motor_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_verification_requests" DROP COLUMN IF EXISTS "motor_category"`,
    );
  }
}
