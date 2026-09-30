import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the fleet add/remove-vehicle endorsement types for every company that
 * already has endorsement types (the seed covers new ones). TIRAMIS API v1.3
 * EndorsementType: 1 = Increasing, 2 = Decreasing Premium Charged. An added
 * vehicle is actually sent as a new fleet cover note (FleetType 2).
 * Existing rows are left alone, so an admin's overrides survive.
 */
export class FleetVehicleEndorsementTypes1791100000002 implements MigrationInterface {
  name = 'FleetVehicleEndorsementTypes1791100000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO endorsement_types
        (company_id, code, name, tira_endorsement_type,
         requires_new_cover_note, is_active, created_at, updated_at)
      SELECT company.company_id, type.code, type.name, type.tira_type,
             true, true, now(), now()
        FROM (SELECT DISTINCT company_id FROM endorsement_types) company
       CROSS JOIN (VALUES
         ('FLEET_ADD_VEHICLE', 'Fleet - Add Vehicle', 1),
         ('FLEET_REMOVE_VEHICLE', 'Fleet - Remove Vehicle', 2)
       ) AS type(code, name, tira_type)
      ON CONFLICT (company_id, code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only remove the rows no endorsement has used yet.
    await queryRunner.query(`
      DELETE FROM endorsement_types type
       WHERE type.code IN ('FLEET_ADD_VEHICLE', 'FLEET_REMOVE_VEHICLE')
         AND NOT EXISTS (
           SELECT 1 FROM policy_endorsements endorsement
            WHERE endorsement.endorsement_type_id = type.id
         )
    `);
  }
}
