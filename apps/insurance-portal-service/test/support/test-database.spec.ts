import {
  assertSafeTestDatabase,
  dropTestDatabase,
  isDisposableTestDatabase,
  newTestRunId,
  specDatabaseName,
  templateDatabaseName,
} from './test-database';

describe('test database safeguards', () => {
  const template = 'insurance_portal_test_20261010120000_ab12cd';
  const safeEnv = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DB_TYPE: 'postgres',
    DB_HOST: 'localhost',
    DB_DATABASE: template,
    DB_NAME: template,
  };

  it('only treats run-scoped names as disposable', () => {
    expect(isDisposableTestDatabase(template)).toBe(true);
    expect(isDisposableTestDatabase(`${template}_0a1b2c3d`)).toBe(true);
    for (const name of [
      'insurance_portal_db',
      'insurance_portal_e2e',
      'insurance_portal_test',
      'insurance_portal_ci_test',
      'tiramis_db',
      'postgres',
      `${template}; DROP DATABASE insurance_portal_db`,
    ]) {
      expect(isDisposableTestDatabase(name)).toBe(false);
    }
  });

  it('builds template and per-spec names that pass its own check', () => {
    const runId = newTestRunId(new Date('2026-10-10T12:00:00Z'));
    expect(runId).toMatch(/^20261010120000_[a-f0-9]{6}$/);

    const name = templateDatabaseName(runId);
    expect(isDisposableTestDatabase(name)).toBe(true);
    expect(specDatabaseName(name).startsWith(`${name}_`)).toBe(true);
    expect(specDatabaseName(name).length).toBeLessThanOrEqual(63);
  });

  it('accepts a local disposable test database', () => {
    expect(() => assertSafeTestDatabase(safeEnv)).not.toThrow();
    expect(() =>
      assertSafeTestDatabase({
        ...safeEnv,
        DB_HOST: 'pg.ci.internal',
        TEST_DB_ALLOWED_HOSTS: 'pg.ci.internal',
      }),
    ).not.toThrow();
  });

  it.each([
    ['the dev database', { DB_DATABASE: 'insurance_portal_db', DB_NAME: '' }],
    ['a non-test APP_ENV', { APP_ENV: 'development' }],
    ['a non-test NODE_ENV', { NODE_ENV: 'production' }],
    ['a remote host', { DB_HOST: '10.0.0.5' }],
    ['a mismatched DB_NAME', { DB_NAME: 'insurance_portal_db' }],
    ['another database engine', { DB_TYPE: 'oracle' }],
  ])('refuses %s', (_label, overrides) => {
    expect(() => assertSafeTestDatabase({ ...safeEnv, ...overrides })).toThrow(
      /Unsafe test database configuration/,
    );
  });

  it('never issues DROP for a database outside the naming scheme', async () => {
    const client = { query: jest.fn() };

    await expect(
      dropTestDatabase(client as never, 'insurance_portal_db'),
    ).rejects.toThrow(/Refusing to touch/);
    expect(client.query).not.toHaveBeenCalled();

    await dropTestDatabase(client as never, template);
    expect(client.query).toHaveBeenCalledWith(
      `DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`,
    );
  });
});
