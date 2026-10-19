import { MigrationInterface, QueryRunner } from 'typeorm';

/** Allow omission of quotation motor owner names without changing stored data. */
export class AllowOptionalQuotationMotorOwner1794800000000 implements MigrationInterface {
  name = 'AllowOptionalQuotationMotorOwner1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "owner_name" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ALTER COLUMN "owner_name" SET NOT NULL`,
    );
  }
}
