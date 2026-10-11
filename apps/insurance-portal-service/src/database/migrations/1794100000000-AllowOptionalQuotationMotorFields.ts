import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowOptionalQuotationMotorFields1794100000000 implements MigrationInterface {
  name = 'AllowOptionalQuotationMotorFields1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "registration_number" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "number_of_axles" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "axle_distance" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "sitting_capacity" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "motor_usage" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "owner_address" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "owner_address" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "motor_usage" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "sitting_capacity" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "axle_distance" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "number_of_axles" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "registration_number" SET NOT NULL`,
    );
  }
}
