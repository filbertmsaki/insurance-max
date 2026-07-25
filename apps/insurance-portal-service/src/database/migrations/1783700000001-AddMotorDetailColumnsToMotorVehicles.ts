import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMotorDetailColumnsToMotorVehicles1783700000001 implements MigrationInterface {
  name = 'AddMotorDetailColumnsToMotorVehicles1783700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles"
        ADD "model_no" character varying(100),
        ADD "number_of_axles" smallint,
        ADD "axle_distance" numeric(10,2),
        ADD "tare_weight" numeric(12,2),
        ADD "gross_weight" numeric(12,2),
        ADD "motor_category" smallint,
        ADD "motor_type" smallint,
        ADD "motor_usage" smallint,
        ADD "owner_name" character varying(150),
        ADD "owner_category" smallint,
        ADD "owner_address" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles"
        DROP COLUMN "owner_address",
        DROP COLUMN "owner_category",
        DROP COLUMN "owner_name",
        DROP COLUMN "motor_usage",
        DROP COLUMN "motor_type",
        DROP COLUMN "motor_category",
        DROP COLUMN "gross_weight",
        DROP COLUMN "tare_weight",
        DROP COLUMN "axle_distance",
        DROP COLUMN "number_of_axles",
        DROP COLUMN "model_no"`,
    );
  }
}
