import 'reflect-metadata';

import { DataSource } from 'typeorm';

import {
  createAppDataSourceOptions,
  readAppDatabaseEnv,
} from '../../src/database/data-source.options';
import { runAllSeeders } from '../../src/database/seeds';
import { assertSafeTestDatabase } from './test-database';

// Spawned by global-setup with DB_DATABASE already pointing at the run's
// template database. Migrates and seeds it once; spec files copy it.
async function prepare() {
  assertSafeTestDatabase();

  const dataSource = new DataSource({
    ...createAppDataSourceOptions(readAppDatabaseEnv()),
    logging: false,
  });
  await dataSource.initialize();
  try {
    // Disposable database provisioning is separate from application migrations,
    // just as production extensions are installed once by the DBA.
    await dataSource.query(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public',
    );
    await dataSource.runMigrations();
    await runAllSeeders(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

prepare().catch((error) => {
  console.error(error);
  process.exit(1);
});
