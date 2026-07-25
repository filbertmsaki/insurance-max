import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTiramisPayloadColumns1783000000014 implements MigrationInterface {
  name = 'AddTiramisPayloadColumns1783000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'policies',
      'motor_fleets',
      'non_motor_policy_details',
      'non_motor_quotation_details',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_payload" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'policies',
      'motor_fleets',
      'non_motor_policy_details',
      'non_motor_quotation_details',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_payload"`,
      );
    }
  }
}
