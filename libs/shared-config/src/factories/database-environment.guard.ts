const TEST_ENVIRONMENTS = new Set(['test']);
const PROTECTED_ENVIRONMENTS = new Set(['production', 'uat', 'staging']);

// A database counts as a test database when "test" is a whole
// underscore-separated word in its name, e.g. insurance_portal_test_x.
const TEST_DATABASE_NAME = /(^|_)test(_|$)/i;

export interface DatabaseEnvironment {
  appEnv?: string;
  nodeEnv?: string;
  database: string;
}

export function isTestDatabaseName(database: string): boolean {
  return TEST_DATABASE_NAME.test(database);
}

/**
 * Refuses to boot when the runtime and the database disagree: a test run must
 * never reach a working database, and a protected environment must never run
 * against a test database.
 */
export function assertDatabaseMatchesEnvironment({
  appEnv,
  nodeEnv,
  database,
}: DatabaseEnvironment): void {
  const app = appEnv?.toLowerCase();
  const node = nodeEnv?.toLowerCase();
  const testRuntime =
    TEST_ENVIRONMENTS.has(app ?? '') || TEST_ENVIRONMENTS.has(node ?? '');

  if (testRuntime && !isTestDatabaseName(database)) {
    throw new Error(
      `Refusing to start a test run against database "${database}". ` +
        'Test databases must contain "_test" in their name.',
    );
  }

  if (app && PROTECTED_ENVIRONMENTS.has(app) && isTestDatabaseName(database)) {
    throw new Error(
      `Refusing to start APP_ENV=${appEnv} against test database "${database}".`,
    );
  }
}
