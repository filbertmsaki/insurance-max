require('ts-node/register');
require('tsconfig-paths/register');

const { existsSync } = require('fs');
const path = require('path');

const { Client } = require('pg');
const { config: loadEnv } = require('dotenv');

process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'test';

function loadPortalTestEnvironment() {
  const envFiles = [
    path.join(process.cwd(), 'apps', 'insurance-portal-service', '.env'),
    path.join(process.cwd(), 'apps', 'insurance-portal-service', '.env.test'),
  ];

  for (const envFile of envFiles) {
    if (existsSync(envFile)) {
      loadEnv({ path: envFile, override: true, quiet: true });
    }
  }
}

function readPortalDatabaseConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database:
      process.env.DB_DATABASE ||
      process.env.DB_NAME ||
      'insurance_portal_phase7_test',
    ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true',
  };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function ensureDatabaseExists(config) {
  const adminClient = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  await adminClient.connect();

  try {
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database],
    );

    if (result.rowCount === 0) {
      console.log(
        `[insurance-portal-service:test] creating database ${config.database}`,
      );
      await adminClient.query(
        `CREATE DATABASE ${quoteIdentifier(config.database)}`,
      );
    }
  } finally {
    await adminClient.end();
  }
}

async function resetMigrations(dataSource) {
  await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await dataSource.runMigrations();
}

async function main() {
  loadPortalTestEnvironment();

  const databaseConfig = readPortalDatabaseConfig();
  await ensureDatabaseExists(databaseConfig);

  const portalDataSource =
    require('../apps/insurance-portal-service/src/database/data-source').default;
  const {
    runAllSeeders,
  } = require('../apps/insurance-portal-service/src/database/seeds');

  console.log(
    `[insurance-portal-service:test] preparing ${databaseConfig.database}`,
  );

  await portalDataSource.initialize();

  try {
    await resetMigrations(portalDataSource);
    await runAllSeeders(portalDataSource);
  } finally {
    if (portalDataSource.isInitialized) {
      await portalDataSource.destroy();
    }
  }

  console.log('[insurance-portal-service:test] test database is ready');
}

main().catch((error) => {
  console.error('Failed to prepare backend test database:', error);
  process.exitCode = 1;
});
