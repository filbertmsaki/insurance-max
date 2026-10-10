import {
  dropStaleTestDatabases,
  findTestDataResidue,
  listTestDatabases,
  loadTestEnv,
  withAdminClient,
} from './test-database';

/**
 * npm run test:db:clean [-- --all]
 *   Drops test databases left by interrupted runs (older than
 *   TEST_DB_STALE_HOURS, or every disposable test database with --all).
 *
 * npm run test:verify-clean
 *   Fails if any disposable test database still exists or if the working
 *   database configured in .env (or DB_DATABASE) holds e2e-generated rows.
 */
async function main() {
  const [command, ...flags] = process.argv.slice(2);
  const { workingDatabase } = loadTestEnv();

  if (command === 'clean') {
    const dropped = await withAdminClient((client) =>
      dropStaleTestDatabases(client, { all: flags.includes('--all') }),
    );
    console.log(
      dropped.length > 0
        ? `Dropped ${dropped.length} test database(s):\n  ${dropped.join('\n  ')}`
        : 'No stale test databases.',
    );
    return;
  }

  if (command === 'verify') {
    const leftovers = await withAdminClient(listTestDatabases);
    const residue = workingDatabase
      ? await findTestDataResidue(workingDatabase)
      : [];
    const problems = [
      ...leftovers.map((name) => `leftover test database ${name}`),
      ...residue,
    ];
    if (problems.length > 0) {
      console.error(
        `Test isolation check failed:\n  - ${problems.join('\n  - ')}`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `Clean: no test databases remain and ${workingDatabase ?? 'no working database'} has no e2e data.`,
    );
    return;
  }

  console.error('Usage: test-database-cli.ts <clean [--all] | verify>');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
