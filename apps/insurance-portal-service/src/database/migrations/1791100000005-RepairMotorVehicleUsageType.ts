import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quotation-created motor vehicles had `usage_type` set to the fuel type.
 * Repairs those rows from TIRAMIS MotorUsage (1 = Private, 2 = Commercial);
 * rows whose usage type was entered separately are left alone.
 */
export class RepairMotorVehicleUsageType1791100000005 implements MigrationInterface {
  name = 'RepairMotorVehicleUsageType1791100000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE motor_vehicles
         SET usage_type = CASE motor_usage
                            WHEN 1 THEN 'Private'
                            WHEN 2 THEN 'Commercial'
                            ELSE NULL
                          END
       WHERE usage_type IS NOT NULL
         AND fuel_type IS NOT NULL
         AND usage_type = fuel_type
    `);
  }

  public async down(): Promise<void> {
    // Data repair; the previous values were wrong.
  }
}
