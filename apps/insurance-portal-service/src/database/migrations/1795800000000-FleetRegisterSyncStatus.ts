import { MigrationInterface, QueryRunner } from 'typeorm';

export class FleetRegisterSyncStatus1795800000000 implements MigrationInterface {
  name = 'FleetRegisterSyncStatus1795800000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE quotations
      ADD COLUMN IF NOT EXISTS fleet_register_sync_status varchar(20),
      ADD COLUMN IF NOT EXISTS fleet_register_sync_error text,
      ADD COLUMN IF NOT EXISTS fleet_register_sync_attempted_at timestamptz`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE quotations
      DROP COLUMN IF EXISTS fleet_register_sync_status,
      DROP COLUMN IF EXISTS fleet_register_sync_error,
      DROP COLUMN IF EXISTS fleet_register_sync_attempted_at`);
  }
}
