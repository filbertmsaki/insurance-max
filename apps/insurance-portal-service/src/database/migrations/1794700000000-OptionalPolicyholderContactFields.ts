import { MigrationInterface, QueryRunner } from 'typeorm';

/** Relax legacy customer street width to match the optional policyholder DTO. */
export class OptionalPolicyholderContactFields1794700000000 implements MigrationInterface {
  name = 'OptionalPolicyholderContactFields1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "street" TYPE character varying(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "postal_address" TYPE character varying(150)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "street" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "postal_address" TYPE character varying(50)`,
    );
  }
}
