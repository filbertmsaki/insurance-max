import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

export default class PlatformIdpSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(dataSource, 'seed:platform-idp', async (qr) => {
      await requireColumns(qr, 'system_configs', [
        'config_key',
        'config_value',
        'is_active',
      ]);

      await qr.query(
        `
          INSERT INTO system_configs (
            config_key,
            config_value,
            description,
            is_active,
            created_at,
            updated_at
          )
          VALUES (
            'platform.identity',
            $1::jsonb,
            'IDP/SaaS platform identity',
            true,
            now(),
            now()
          )
          ON CONFLICT (config_key)
          DO UPDATE SET
            config_value = COALESCE(system_configs.config_value, '{}'::jsonb)
              || EXCLUDED.config_value,
            is_active = true,
            updated_at = now()
        `,
        [
          JSON.stringify({
            platformName: 'IDP Insurance SaaS Platform',
            defaultCountry: 'TZA',
            defaultCurrency: 'TZS',
            timezone: 'Africa/Dar_es_Salaam',
            seededBy: '000-platform-idp.seed',
          }),
        ],
      );
    });
  }
}
