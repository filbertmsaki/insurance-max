import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { seedAiclFin01Demo } from './aicl-fin-01-demo.seed';

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--apply'))
    throw new Error('Only --apply is supported; omit it for a dry run.');
  const source = new DataSource({
    type: 'postgres',
    host: process.env.FINANCE_TEST_PG_HOST,
    port: Number(process.env.FINANCE_TEST_PG_PORT),
    username: process.env.FINANCE_TEST_PG_USER,
    password: process.env.FINANCE_TEST_PG_PASSWORD,
    database: process.env.FINANCE_AICL_DEMO_DATABASE,
    synchronize: false,
    migrationsRun: false,
    ssl: false,
  });
  // Validate before opening any connection; the seeder rechecks database identity.
  if (
    process.env.FINANCE_AICL_DEMO_SEED !== '1' ||
    process.env.NODE_ENV !== 'test' ||
    process.env.APP_ENV !== 'test' ||
    process.env.FINANCE_TEST_PG_ENABLED !== '1' ||
    !process.env.FINANCE_TEST_PG_CLUSTER_DIRECTORY ||
    !['127.0.0.1', '::1'].includes(process.env.FINANCE_TEST_PG_HOST ?? '') ||
    !/^insurance_portal_test_\d{14}_[a-z0-9]{6}(?:_[a-z0-9]{1,12})?$/.test(
      process.env.FINANCE_AICL_DEMO_DATABASE ?? '',
    ) ||
    !process.env.FINANCE_TEST_PG_USER ||
    !process.env.FINANCE_TEST_PG_PASSWORD ||
    !/^\d+$/.test(process.env.FINANCE_TEST_PG_PORT ?? '') ||
    Number(process.env.FINANCE_TEST_PG_PORT) < 1024 ||
    Number(process.env.FINANCE_TEST_PG_PORT) > 65535 ||
    Number(process.env.FINANCE_TEST_PG_PORT) === 5432
  )
    throw new Error(
      'Explicit isolated Finance test connection and demo flag required.',
    );
  try {
    await source.initialize();
    console.log(
      JSON.stringify(
        await seedAiclFin01Demo(source, {
          apply: process.argv.includes('--apply'),
        }),
        null,
        2,
      ),
    );
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
