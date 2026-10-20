import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

const FUELS = [
  'Petrol',
  'Diesel',
  'Hybrid',
  'Plug-in Hybrid',
  'Electric',
  'Hydrogen',
  'CNG',
  'LNG',
  'LPG',
  'Ethanol / Flex Fuel (E85)',
  'Methanol',
  'Biodiesel',
  'Renewable Diesel',
  'Other',
];
const SOURCE = 'U.S. DOE AFDC; portal-compatible labels';
const normalized = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

export default class VehicleFuelTypesSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:vehicle-fuel-types',
      async (qr) => {
        await requireColumns(qr, 'vehicle_reference_attributes', [
          'kind',
          'name',
          'normalized_name',
          'is_active',
          'source',
          'metadata',
        ]);
        const rows = FUELS.map((name) => ({
          kind: 'fuel_type',
          name,
          normalized_name: normalized(name),
          is_active: true,
          source: SOURCE,
          metadata: {
            source_url: 'https://afdc.energy.gov/fuels',
            model_fuel_mapping:
              'not asserted; fuel depends on model year and variant',
          },
        }));
        await qr.query(
          `INSERT INTO vehicle_reference_attributes(kind, name, normalized_name, is_active, source, metadata)
         SELECT kind, name, normalized_name, is_active, source, metadata
         FROM jsonb_to_recordset($1::jsonb) AS rows(kind text, name text, normalized_name text, is_active boolean, source text, metadata jsonb)
         ON CONFLICT (kind, normalized_name) WHERE deleted_at IS NULL DO NOTHING`,
          [JSON.stringify(rows)],
        );
      },
    );
  }
}
