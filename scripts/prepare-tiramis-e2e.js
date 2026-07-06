require('ts-node/register');
require('tsconfig-paths/register');

const portalDataSource = require('../apps/insurance-portal-service/src/database/data-source')
  .default;
const { runAllSeeders } = require('../apps/insurance-portal-service/src/database/seeds');
const tiramisDataSource = require('../apps/tiramis/src/database/data-source').default;
const {
  runTiramisConfigSeed,
} = require('../apps/tiramis/src/database/seeders/seed-tiramis-config');

async function getAppliedMigrationCount(dataSource) {
  try {
    const rows = await dataSource.query('SELECT COUNT(*)::int AS count FROM migrations');
    return Number(rows?.[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function resetMigrations(dataSource, label) {
  const appliedCount = await getAppliedMigrationCount(dataSource);

  console.log(`\n[${label}] resetting schema (${appliedCount} recorded migration(s))`);
  await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  console.log(`[${label}] running migrations`);
  await dataSource.runMigrations();
}

async function preparePortalService() {
  await portalDataSource.initialize();

  try {
    await resetMigrations(portalDataSource, 'insurance-portal-service');
    console.log('[insurance-portal-service] running seeders');
    await runAllSeeders(portalDataSource);
  } finally {
    if (portalDataSource.isInitialized) {
      await portalDataSource.destroy();
    }
  }
}

async function prepareTiramisService() {
  await tiramisDataSource.initialize();

  try {
    await resetMigrations(tiramisDataSource, 'tiramis');
    console.log('[tiramis] seeding configuration');
    await runTiramisConfigSeed(tiramisDataSource);
  } finally {
    if (tiramisDataSource.isInitialized) {
      await tiramisDataSource.destroy();
    }
  }
}

async function main() {
  console.log('Preparing Tiramis E2E databases with a fresh migration reset and seed.');

  await preparePortalService();
  await prepareTiramisService();

  console.log('\nFresh E2E database preparation completed.');
}

main().catch((error) => {
  console.error('Failed to prepare Tiramis E2E databases:', error);
  process.exitCode = 1;
});
