import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs `motor_vehicles.usage_type` rows written from a quotation, which
 * stored the fuel type instead of the usage. Only rows whose usage_type
 * equals their fuel_type and whose `motor_usage` code is known (1 = PRIVATE,
 * 2 = COMMERCIAL) are touched, so it is idempotent and leaves manually
 * captured values alone. Data-only; `down` is a no-op.
 */
export class RepairMotorVehicleUsageType1791200000000 implements MigrationInterface {
  name = 'RepairMotorVehicleUsageType1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "motor_vehicles"
         SET "usage_type" = CASE "motor_usage"
                              WHEN 1 THEN 'PRIVATE'
                              WHEN 2 THEN 'COMMERCIAL'
                            END,
             "updated_at" = now()
       WHERE "motor_usage" IN (1, 2)
         AND "usage_type" IS NOT NULL
         AND "fuel_type" IS NOT NULL
         AND UPPER(TRIM("usage_type")) = UPPER(TRIM("fuel_type"))
         AND UPPER(TRIM("usage_type")) NOT IN ('PRIVATE', 'COMMERCIAL')
    `);
  }

  public async down(): Promise<void> {
    // The overwritten values were fuel types, not usages; nothing to restore.
  }
}
