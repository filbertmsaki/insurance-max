import { spawnSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  assertSafeTestDatabase,
  createTestDatabase,
  dropStaleTestDatabases,
  dropTestDatabase,
  loadTestEnv,
  newTestRunId,
  templateDatabaseName,
  withAdminClient,
} from './test-database';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

export default async function globalSetup(): Promise<void> {
  const { workingDatabase } = loadTestEnv();
  const template = templateDatabaseName(newTestRunId());

  // Everything set on process.env here is inherited by the spec files.
  process.env.DB_DATABASE = template;
  process.env.DB_NAME = template;
  process.env.TEST_DB_TEMPLATE = template;
  process.env.TEST_DB_WORKING_DATABASE = workingDatabase ?? '';
  process.env.DOCUMENT_STORAGE_ROOT = mkdtempSync(
    join(tmpdir(), 'insurance-portal-test-'),
  );
  assertSafeTestDatabase();

  await withAdminClient(async (client) => {
    const stale = await dropStaleTestDatabases(client);
    if (stale.length > 0) {
      console.log(`\n[test-db] dropped ${stale.length} stale test database(s)`);
    }
    await createTestDatabase(client, template);
  });
  console.log(`\n[test-db] migrating and seeding ${template}`);

  const prepared = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      '-r',
      'tsconfig-paths/register',
      join(__dirname, 'prepare-test-database.ts'),
    ],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 64 * 1024 * 1024,
    },
  );

  if (prepared.status !== 0) {
    await withAdminClient((client) => dropTestDatabase(client, template));
    throw new Error(
      `[test-db] preparing ${template} failed (exit ${prepared.status})\n` +
        prepared.stdout?.toString(),
    );
  }
}
