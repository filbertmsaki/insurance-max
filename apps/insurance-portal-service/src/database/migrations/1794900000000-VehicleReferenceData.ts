import { MigrationInterface, QueryRunner } from 'typeorm';

export class VehicleReferenceData1794900000000 implements MigrationInterface {
  name = 'VehicleReferenceData1794900000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE vehicle_makes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(120) NOT NULL, normalized_name varchar(120) NOT NULL, is_active boolean NOT NULL DEFAULT true, source varchar(60), metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX UQ_vehicle_makes_normalized_name ON vehicle_makes(normalized_name) WHERE deleted_at IS NULL`,
    );
    await q.query(
      `CREATE TABLE vehicle_models (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), make_id uuid NOT NULL REFERENCES vehicle_makes(id) ON DELETE RESTRICT, name varchar(120) NOT NULL, normalized_name varchar(120) NOT NULL, is_active boolean NOT NULL DEFAULT true, source varchar(60), metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX UQ_vehicle_models_make_normalized_name ON vehicle_models(make_id, normalized_name) WHERE deleted_at IS NULL`,
    );
    await q.query(
      `CREATE INDEX IDX_vehicle_models_make_active_name ON vehicle_models(make_id, is_active, name)`,
    );
    await q.query(
      `CREATE TABLE vehicle_reference_attributes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind varchar(20) NOT NULL CHECK (kind IN ('body_type','colour','fuel_type')), name varchar(120) NOT NULL, normalized_name varchar(120) NOT NULL, is_active boolean NOT NULL DEFAULT true, source varchar(60), metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`,
    );
    await q.query(
      `CREATE UNIQUE INDEX UQ_vehicle_reference_attributes_kind_normalized_name ON vehicle_reference_attributes(kind, normalized_name) WHERE deleted_at IS NULL`,
    );
    await q.query(
      `CREATE INDEX IDX_vehicle_reference_attributes_kind_active ON vehicle_reference_attributes(kind, is_active)`,
    );
    // Reference rows are populated by the separately rerunnable vehicle reference seeder.
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS vehicle_reference_attributes');
    await q.query('DROP TABLE IF EXISTS vehicle_models');
    await q.query('DROP TABLE IF EXISTS vehicle_makes');
  }
}
