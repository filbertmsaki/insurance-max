import { rmSync } from 'fs';

import {
  dropTestDatabase,
  findTestDataResidue,
  listTestDatabases,
  withAdminClient,
} from './test-database';

export default async function globalTeardown(): Promise<void> {
  const template = process.env.TEST_DB_TEMPLATE;
  if (!template) {
    return; // global setup failed before creating anything
  }

  const storageRoot = process.env.DOCUMENT_STORAGE_ROOT;
  if (storageRoot) {
    rmSync(storageRoot, { recursive: true, force: true });
  }

  const ownedBy = (name: string) =>
    name === template || name.startsWith(`${template}_`);

  if (process.env.KEEP_TEST_DB === 'true') {
    console.log(`\n[test-db] KEEP_TEST_DB=true, leaving ${template}* in place`);
  } else {
    const remaining = await withAdminClient(async (client) => {
      for (const name of (await listTestDatabases(client)).filter(ownedBy)) {
        await dropTestDatabase(client, name);
      }
      return (await listTestDatabases(client)).filter(ownedBy);
    });
    if (remaining.length > 0) {
      throw new Error(
        `[test-db] test databases survived teardown: ${remaining.join(', ')}`,
      );
    }
  }

  const working = process.env.TEST_DB_WORKING_DATABASE;
  const residue = working ? await findTestDataResidue(working) : [];
  if (residue.length > 0) {
    throw new Error(
      '[test-db] e2e data found in the working database:\n  - ' +
        residue.join('\n  - '),
    );
  }
}
