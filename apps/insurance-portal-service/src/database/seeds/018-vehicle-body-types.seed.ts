import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

export default class VehicleBodyTypesSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    const filePath = path.resolve(
      __dirname,
      'data',
      'vehiclesdb-2026.10.3.json',
    );
    const catalog = JSON.parse(readFileSync(filePath, 'utf8')) as {
      v: string;
      models: unknown[][];
    };
    const catalogBodyTypes = [
      ...new Set(
        catalog.models
          .map((model) => model[4])
          .filter(
            (value): value is string =>
              typeof value === 'string' && Boolean(value),
          ),
      ),
    ].sort();
    const curatedBodyTypes = [
      'Sedan',
      'Hatchback',
      'SUV',
      'Pickup',
      'Minibus',
      'Bus',
      'Truck',
      'Motorcycle',
      'Wagon',
      'Van',
      'Coupe',
      'Convertible',
      'Tricycle',
      'Tractor',
      'Trailer',
      'Other',
    ];
    const bodyTypesByNormalizedName = new Map(
      curatedBodyTypes.map((name) => [name.toLocaleLowerCase('en'), name]),
    );
    for (const value of catalogBodyTypes) {
      const normalized = value.toLocaleLowerCase('en');
      const name =
        normalized === 'suv' || normalized === 'mpv'
          ? normalized.toUpperCase()
          : value
              .split(/[-_\s]+/)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ');
      if (!bodyTypesByNormalizedName.has(normalized)) {
        bodyTypesByNormalizedName.set(normalized, name);
      }
    }
    const bodyTypes = [...bodyTypesByNormalizedName.values()].sort();
    await withSeedTransaction(
      dataSource,
      'seed:vehicle-body-types',
      async (qr) => {
        await requireColumns(qr, 'vehicle_reference_attributes', [
          'kind',
          'name',
          'normalized_name',
          'is_active',
          'source',
          'metadata',
        ]);
        const rows = bodyTypes.map((name) => {
          const normalized = name.toLocaleLowerCase('en');
          const observed = catalogBodyTypes.some(
            (value) => value.toLocaleLowerCase('en') === normalized,
          );
          return {
            kind: 'body_type',
            name,
            normalized_name: normalized,
            is_active: true,
            source: observed
              ? `VehiclesDB ${catalog.v}`
              : 'Portal controlled baseline',
            metadata: {
              source_url: observed
                ? 'https://github.com/vehiclesdb/vehiclesdb'
                : null,
              catalog_version: observed ? catalog.v : null,
            },
          };
        });
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
