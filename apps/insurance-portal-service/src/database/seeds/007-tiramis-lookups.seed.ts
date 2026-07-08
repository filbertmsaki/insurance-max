import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { TIRAMIS_LOOKUPS } from './data/tiramis-lookups.seed-data';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

export default class TiramisLookupsSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:tiramis-lookups',
      async (qr) => {
        await requireColumns(qr, 'tiramis_lookups', [
          'group_code',
          'code',
          'label',
          'is_active',
        ]);

        for (const lookup of TIRAMIS_LOOKUPS) {
          await qr.query(
            `
            INSERT INTO tiramis_lookups (
              group_code,
              code,
              label,
              description,
              metadata,
              is_active,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, NULL, NULL, true, now(), now())
            ON CONFLICT (group_code, code)
            DO UPDATE SET
              label = EXCLUDED.label,
              is_active = true,
              updated_at = now()
          `,
            [lookup.group, lookup.code, lookup.label],
          );
        }
      },
    );
  }
}
