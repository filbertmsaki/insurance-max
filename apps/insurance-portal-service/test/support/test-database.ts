import { randomBytes } from 'crypto';
import { parse } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

/**
 * Disposable test databases for the e2e suite.
 *
 * Every run gets a template database (migrated + seeded once) named
 * insurance_portal_test_<UTC timestamp>_<random>; every spec file then gets its
 * own copy of it (<template>_<suffix>). Teardown drops them all. Nothing here
 * ever touches a database whose name does not match TEST_DATABASE_NAME, so a
 * working database cannot be created over, dropped or seeded by the suite.
 */

export const TEST_DATABASE_PREFIX = 'insurance_portal_test';
const TEST_DATABASE_NAME =
  /^insurance_portal_test_(\d{14})_[a-z0-9]{6}(?:_[a-z0-9]{1,12})?$/;
const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];
const DEFAULT_STALE_HOURS = 2;

const APP_DIR = join(__dirname, '..', '..');

/**
 * Loads env files with the same precedence SharedConfigModule uses for
 * NODE_ENV=test: real environment variables, then .env.test, then .env.
 * Returns the database named in .env so callers know which one is "working".
 */
export function loadTestEnv(): { workingDatabase?: string } {
  process.env.NODE_ENV ??= 'test';

  const files = ['.env.test', '.env']
    .map((file) => join(APP_DIR, file))
    .filter((file) => existsSync(file));
  const fileValues = files.map((file) => parse(readFileSync(file)));

  for (const values of fileValues) {
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  const workingDatabase = fileValues
    .map((values) => values.DB_DATABASE ?? values.DB_NAME)
    .find(Boolean);
  return { workingDatabase };
}

export function isDisposableTestDatabase(name: string): boolean {
  return TEST_DATABASE_NAME.test(name);
}

function assertDisposable(name: string): void {
  if (!isDisposableTestDatabase(name)) {
    throw new Error(
      `Refusing to touch "${name}": not a disposable test database ` +
        `(${TEST_DATABASE_PREFIX}_<timestamp>_<id>).`,
    );
  }
}

/** Throws unless the environment can only reach a disposable test database. */
export function assertSafeTestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const problems: string[] = [];
  const database = env.DB_DATABASE ?? '';
  const allowedHosts = (env.TEST_DB_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const host = (env.DB_HOST ?? 'localhost').toLowerCase();

  if (env.NODE_ENV !== 'test') {
    problems.push(`NODE_ENV must be "test" (got "${env.NODE_ENV}")`);
  }
  if (env.APP_ENV !== 'test') {
    problems.push(`APP_ENV must be "test" (got "${env.APP_ENV}")`);
  }
  if ((env.DB_TYPE ?? 'postgres') !== 'postgres') {
    problems.push(`DB_TYPE must be "postgres" (got "${env.DB_TYPE}")`);
  }
  if (!isDisposableTestDatabase(database)) {
    problems.push(
      `DB_DATABASE "${database}" is not a disposable test database`,
    );
  }
  if (env.DB_NAME && env.DB_NAME !== database) {
    problems.push(`DB_NAME "${env.DB_NAME}" differs from DB_DATABASE`);
  }
  if (![...DEFAULT_ALLOWED_HOSTS, ...allowedHosts].includes(host)) {
    problems.push(
      `DB_HOST "${host}" is not an allowed test host ` +
        '(add it to TEST_DB_ALLOWED_HOSTS if it really is a test server)',
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Unsafe test database configuration:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

export function newTestRunId(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${timestamp}_${randomBytes(3).toString('hex')}`;
}

export function templateDatabaseName(runId: string): string {
  const name = `${TEST_DATABASE_PREFIX}_${runId}`;
  assertDisposable(name);
  return name;
}

export function specDatabaseName(template: string): string {
  const name = `${template}_${randomBytes(4).toString('hex')}`;
  assertDisposable(name);
  return name;
}

export async function withAdminClient<T>(
  work: (client: Client) => Promise<T>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  const client = new Client({
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.TEST_DB_ADMIN_DATABASE ?? 'postgres',
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function createTestDatabase(
  client: Client,
  name: string,
  template?: string,
): Promise<void> {
  assertDisposable(name);
  if (template) {
    assertDisposable(template);
  }
  await client.query(
    `CREATE DATABASE ${quote(name)}` +
      (template ? ` TEMPLATE ${quote(template)}` : ''),
  );
}

export async function dropTestDatabase(
  client: Client,
  name: string,
): Promise<void> {
  assertDisposable(name);
  await client.query(`DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`);
}

export async function listTestDatabases(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ datname: string }>(
    `SELECT datname FROM pg_database WHERE datname LIKE $1 ORDER BY datname`,
    [`${TEST_DATABASE_PREFIX}\\_%`],
  );
  return rows.map((row) => row.datname).filter(isDisposableTestDatabase);
}

function startedAt(name: string): Date {
  const [, ts] = TEST_DATABASE_NAME.exec(name)!;
  return new Date(
    `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T` +
      `${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`,
  );
}

/**
 * Drops test databases left behind by interrupted runs. Only databases older
 * than TEST_DB_STALE_HOURS are touched so a concurrent run keeps its own.
 */
export async function dropStaleTestDatabases(
  client: Client,
  { all = false, now = new Date(), env = process.env } = {},
): Promise<string[]> {
  const staleMs =
    Number(env.TEST_DB_STALE_HOURS ?? DEFAULT_STALE_HOURS) * 3_600_000;
  const stale = (await listTestDatabases(client)).filter(
    (name) => all || now.getTime() - startedAt(name).getTime() > staleMs,
  );
  for (const name of stale) {
    await dropTestDatabase(client, name);
  }
  return stale;
}

/**
 * Read-only fingerprints of e2e-generated rows. A working database should
 * never match any of them; teardown and `npm run test:verify-clean` check.
 */
const TEST_DATA_FINGERPRINTS: Array<{
  label: string;
  table: string;
  sql: string;
}> = [
  {
    label: 'companies with e2e slugs',
    table: 'companies',
    sql: `SELECT count(*)::int AS n FROM companies
          WHERE slug ~ '^(expiry-broker|expiry-insurer|policy-co|other-insurer|intelligence-e2e|engagement-broker-[ab]|broker-[ab]-test)-'`,
  },
  {
    label: 'customers with e2e customer numbers',
    table: 'customers',
    sql: `SELECT count(*)::int AS n FROM customers
          WHERE customer_no ~ '^CUST-(OUTBOX|LOCK|TEST-[AB]|E[AB]|CLM)-'`,
  },
  {
    label: 'users with @example.com e-mails',
    table: 'users',
    sql: `SELECT count(*)::int AS n FROM users WHERE email LIKE '%@example.com'`,
  },
  {
    label: 'finance outbox events of aggregate type E2E',
    table: 'finance_outbox_events',
    sql: `SELECT count(*)::int AS n FROM finance_outbox_events
          WHERE aggregate_type = 'E2E'`,
  },
  {
    label: 'analytics projection events of type E2E_*',
    table: 'analytics_projection_events',
    sql: `SELECT count(*)::int AS n FROM analytics_projection_events
          WHERE event_type LIKE 'E2E%'`,
  },
];

export async function findTestDataResidue(
  database: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  const client = new Client({
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
  } catch (error) {
    if ((error as { code?: string }).code === '3D000') {
      return []; // database does not exist, so nothing can have leaked into it
    }
    throw error;
  }

  try {
    await client.query('SET default_transaction_read_only = on');
    const residue: string[] = [];
    for (const check of TEST_DATA_FINGERPRINTS) {
      const { rows } = await client.query<{ exists: boolean }>(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [check.table],
      );
      if (!rows[0].exists) {
        continue;
      }
      const [{ n }] = (await client.query<{ n: number }>(check.sql)).rows;
      if (n > 0) {
        residue.push(`${database}: ${n} ${check.label}`);
      }
    }
    return residue;
  } finally {
    await client.end();
  }
}
