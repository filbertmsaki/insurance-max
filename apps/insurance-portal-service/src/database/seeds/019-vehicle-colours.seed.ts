import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

const COLOURS = [
  'Black',
  'White',
  'Silver',
  'Grey',
  'Blue',
  'Red',
  'Green',
  'Brown',
  'Yellow',
  'Orange',
  'Gold',
  'Beige',
  'Cream',
  'Ivory',
  'Tan',
  'Bronze',
  'Copper',
  'Burgundy',
  'Maroon',
  'Purple',
  'Pink',
  'Teal',
  'Turquoise',
  'Navy',
  'Charcoal',
  'Champagne',
  'Two-tone',
  'Multicolour',
  'Unpainted',
  'Other',
];
const SOURCE = 'Curated common vehicle exterior colour names';
const normalized = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

export default class VehicleColoursSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:vehicle-colours',
      async (qr) => {
        await requireColumns(qr, 'vehicle_reference_attributes', [
          'kind',
          'name',
          'normalized_name',
          'is_active',
          'source',
          'metadata',
        ]);
        const rows = COLOURS.map((name) => ({
          kind: 'colour',
          name,
          normalized_name: normalized(name),
          is_active: true,
          source: SOURCE,
          metadata: {
            note: 'Shared generic colour choices; manufacturer paint names and codes are not implied.',
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
