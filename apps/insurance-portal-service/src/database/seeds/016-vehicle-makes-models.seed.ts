import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

const DATA_FILE = 'vehiclesdb-2026.10.3.json';
const SOURCE = 'VehiclesDB 2026.10.3';
const MAX_BATCH = 500;

type VehicleCatalog = {
  v: string;
  makes: Array<[slug: string, name: string, kinds: string[]]>;
  models: Array<
    [
      makeSlug: string,
      modelSlug: string,
      name: string,
      kind: string,
      bodyType: string | null,
    ]
  >;
};

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

function loadCatalog(): VehicleCatalog {
  const filePath = path.resolve(__dirname, 'data', DATA_FILE);
  const catalog = JSON.parse(readFileSync(filePath, 'utf8')) as VehicleCatalog;
  if (
    catalog.v !== '2026.10.3' ||
    !catalog.makes?.length ||
    !catalog.models?.length
  ) {
    throw new Error(
      `Vehicle catalog ${DATA_FILE} is missing or has an unexpected version`,
    );
  }
  return catalog;
}

function batches<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}

export default class VehicleMakesModelsSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    const catalog = loadCatalog();
    await withSeedTransaction(
      dataSource,
      'seed:vehicle-makes-models',
      async (qr) => {
        await requireColumns(qr, 'vehicle_makes', [
          'name',
          'normalized_name',
          'is_active',
          'source',
          'metadata',
        ]);
        await requireColumns(qr, 'vehicle_models', [
          'make_id',
          'name',
          'normalized_name',
          'is_active',
          'source',
          'metadata',
        ]);

        const makeRows = catalog.makes.map(([slug, name, kinds]) => ({
          name: name.trim().replace(/\s+/g, ' '),
          normalized_name: normalized(name),
          is_active: true,
          source: SOURCE,
          metadata: {
            source_slug: slug,
            vehicle_kinds: kinds,
            catalog_version: catalog.v,
          },
        }));
        for (const batch of batches(makeRows, MAX_BATCH)) {
          await qr.query(
            `INSERT INTO vehicle_makes(name, normalized_name, is_active, source, metadata)
           SELECT name, normalized_name, is_active, source, metadata
           FROM jsonb_to_recordset($1::jsonb) AS rows(name text, normalized_name text, is_active boolean, source text, metadata jsonb)
           ON CONFLICT (normalized_name) WHERE deleted_at IS NULL DO NOTHING`,
            [JSON.stringify(batch)],
          );
        }

        const makeRowsInDb: Array<{ id: string; normalized_name: string }> =
          await qr.query(
            'SELECT id, normalized_name FROM vehicle_makes WHERE deleted_at IS NULL',
          );
        const makeIdByNormalizedName = new Map(
          makeRowsInDb.map((row) => [row.normalized_name, row.id]),
        );
        const makeIdBySourceSlug = new Map<string, string>();
        for (const [slug, name] of catalog.makes) {
          const makeId = makeIdByNormalizedName.get(normalized(name));
          if (makeId) makeIdBySourceSlug.set(slug, makeId);
        }

        // Exact normalized names are coalesced per make. Their distinct vehicle
        // kinds and source slugs are retained in metadata, not turned into trims.
        const grouped = new Map<
          string,
          {
            make_id: string;
            name: string;
            normalized_name: string;
            vehicle_kinds: Set<string>;
            source_slugs: Set<string>;
            body_types: Set<string>;
          }
        >();
        for (const [
          makeSlug,
          modelSlug,
          name,
          kind,
          bodyType,
        ] of catalog.models) {
          const makeId = makeIdBySourceSlug.get(makeSlug);
          if (!makeId) continue;
          const displayName = name.trim().replace(/\s+/g, ' ');
          const nameKey = normalized(displayName);
          if (!displayName || displayName.length > 120) continue;
          const key = `${makeId}:${nameKey}`;
          let record = grouped.get(key);
          if (!record) {
            record = {
              make_id: makeId,
              name: displayName,
              normalized_name: nameKey,
              vehicle_kinds: new Set(),
              source_slugs: new Set(),
              body_types: new Set(),
            };
            grouped.set(key, record);
          }
          record.vehicle_kinds.add(kind);
          record.source_slugs.add(modelSlug);
          if (bodyType) record.body_types.add(bodyType);
        }

        const modelRows = [...grouped.values()].map((model) => ({
          make_id: model.make_id,
          name: model.name,
          normalized_name: model.normalized_name,
          is_active: true,
          source: SOURCE,
          metadata: {
            catalog_version: catalog.v,
            vehicle_kinds: [...model.vehicle_kinds].sort(),
            source_model_slugs: [...model.source_slugs].sort(),
            body_types: [...model.body_types].sort(),
          },
        }));
        for (const batch of batches(modelRows, MAX_BATCH)) {
          await qr.query(
            `INSERT INTO vehicle_models(make_id, name, normalized_name, is_active, source, metadata)
           SELECT make_id, name, normalized_name, is_active, source, metadata
           FROM jsonb_to_recordset($1::jsonb) AS rows(make_id uuid, name text, normalized_name text, is_active boolean, source text, metadata jsonb)
           ON CONFLICT (make_id, normalized_name) WHERE deleted_at IS NULL DO NOTHING`,
            [JSON.stringify(batch)],
          );
        }
        console.log(
          `[vehicle-seed] VehiclesDB ${catalog.v}: ${makeRows.length} makes, ${modelRows.length} distinct make/model names`,
        );
      },
    );
  }
}
