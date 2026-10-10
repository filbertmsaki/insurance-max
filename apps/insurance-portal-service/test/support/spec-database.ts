import {
  assertSafeTestDatabase,
  createTestDatabase,
  specDatabaseName,
  withAdminClient,
} from './test-database';

// Runs before every e2e spec file: points it at a fresh copy of the run's
// migrated + seeded template so files never see each other's data.
const template = process.env.TEST_DB_TEMPLATE;
if (!template) {
  throw new Error(
    'TEST_DB_TEMPLATE is not set; run e2e specs through `npm run test:e2e`.',
  );
}

const database = specDatabaseName(template);
process.env.DB_DATABASE = database;
process.env.DB_NAME = database;
assertSafeTestDatabase();

beforeAll(async () => {
  await withAdminClient((client) =>
    createTestDatabase(client, database, template),
  );
}, 120_000);
