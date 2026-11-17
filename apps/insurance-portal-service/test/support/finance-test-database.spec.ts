import { Client } from 'pg';
import { DataSource } from 'typeorm';
import {
  readFinanceTestServer,
  withFinanceTestDatabase,
} from './finance-test-database';

jest.mock('pg', () => ({ Client: jest.fn() }));
jest.mock('typeorm', () => ({
  ...jest.requireActual('typeorm'),
  DataSource: jest.fn(),
}));

const testEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  FINANCE_TEST_PG_ENABLED: '1',
  FINANCE_TEST_PG_HOST: '127.0.0.1',
  FINANCE_TEST_PG_PORT: '55432',
  FINANCE_TEST_PG_USER: 'finance_fixture_user',
  FINANCE_TEST_PG_PASSWORD: 'synthetic-test-only',
};

describe('Finance test destination safeguards', () => {
  it('requires explicit Finance settings instead of DB or PG fallback', () => {
    expect(() =>
      readFinanceTestServer({
        NODE_ENV: 'test',
        APP_ENV: 'test',
        DB_HOST: '127.0.0.1',
        DB_DATABASE: 'working',
        PGHOST: '127.0.0.1',
        PGUSER: 'working',
      }),
    ).toThrow('explicit test mode');
  });

  it.each([
    { FINANCE_TEST_PG_ENABLED: '0' },
    { NODE_ENV: 'production' },
    { APP_ENV: 'development' },
    { FINANCE_TEST_PG_HOST: 'db.example.com' },
    { FINANCE_TEST_PG_HOST: 'localhost' },
    { FINANCE_TEST_PG_HOST: '127.0.0.1/working' },
    { FINANCE_TEST_PG_PORT: '0' },
    { FINANCE_TEST_PG_PORT: '65536' },
    { FINANCE_TEST_PG_PORT: '5432.5' },
    { FINANCE_TEST_PG_PORT: '5432extra' },
    { FINANCE_TEST_PG_USER: '' },
    { FINANCE_TEST_PG_PASSWORD: ' ' },
  ])('rejects an unsafe or incomplete Finance destination %j', (overrides) => {
    expect(() => readFinanceTestServer({ ...testEnv, ...overrides })).toThrow();
  });

  it('preserves explicit credentials and accepts only a literal loopback destination', () => {
    expect(readFinanceTestServer(testEnv)).toEqual({
      host: '127.0.0.1',
      port: 55432,
      user: 'finance_fixture_user',
      password: 'synthetic-test-only',
    });
    expect(
      readFinanceTestServer({ ...testEnv, FINANCE_TEST_PG_HOST: '::1' }).host,
    ).toBe('::1');
  });
});

describe('Finance owned test database lifecycle', () => {
  let ownedDatabase: string;
  let admin: { connect: jest.Mock; query: jest.Mock; end: jest.Mock };
  let source: {
    isInitialized: boolean;
    initialize: jest.Mock;
    query: jest.Mock;
    synchronize: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    admin = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({ rows: [] }),
      end: jest.fn().mockResolvedValue(undefined),
    };
    source = {
      isInitialized: false,
      initialize: jest.fn(async () => {
        source.isInitialized = true;
        return source;
      }),
      query: jest.fn(async () => [
        { database: ownedDatabase, username: testEnv.FINANCE_TEST_PG_USER },
      ]),
      synchronize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(async () => {
        source.isInitialized = false;
      }),
    };
    jest.mocked(Client).mockImplementation(() => admin as unknown as Client);
    jest.mocked(DataSource).mockImplementation((options) => {
      ownedDatabase = (options as { database: string }).database;
      return source as unknown as DataSource;
    });
  });

  it('rejects unsafe settings before constructing any network client', async () => {
    await expect(
      withFinanceTestDatabase(jest.fn(), {
        ...testEnv,
        FINANCE_TEST_PG_ENABLED: '0',
      }),
    ).rejects.toThrow();
    expect(Client).not.toHaveBeenCalled();
    expect(DataSource).not.toHaveBeenCalled();
  });

  it('creates, verifies, closes and drops exactly its own database', async () => {
    const work = jest.fn().mockResolvedValue('fixture-result');
    await expect(withFinanceTestDatabase(work, testEnv)).resolves.toBe(
      'fixture-result',
    );
    expect(ownedDatabase).toMatch(/^insurance_portal_test_\d{14}_[a-z0-9]{6}$/);
    expect(admin.query.mock.calls).toEqual([
      [`CREATE DATABASE "${ownedDatabase}"`],
      [`DROP DATABASE IF EXISTS "${ownedDatabase}" WITH (FORCE)`],
      ['SELECT datname FROM pg_database WHERE datname = $1', [ownedDatabase]],
    ]);
    expect(work).toHaveBeenCalledWith({
      dataSource: source,
      database: ownedDatabase,
    });
    expect(source.synchronize).toHaveBeenCalledTimes(1);
    expect(source.destroy).toHaveBeenCalledTimes(1);
    expect(source.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      admin.query.mock.invocationCallOrder[1],
    );
    expect(admin.end).toHaveBeenCalledTimes(1);
  });

  it('never drops a database after failed CREATE or a name collision', async () => {
    const failure = new Error('create rejected');
    admin.query.mockRejectedValueOnce(failure);
    await expect(withFinanceTestDatabase(jest.fn(), testEnv)).rejects.toBe(
      failure,
    );
    expect(admin.query).toHaveBeenCalledTimes(1);
    expect(DataSource).not.toHaveBeenCalled();
    expect(admin.end).toHaveBeenCalledTimes(1);
  });

  it('rejects a mismatched connection before synchronizing any schema', async () => {
    source.query.mockResolvedValueOnce([
      { database: 'working_database', username: testEnv.FINANCE_TEST_PG_USER },
    ]);
    const work = jest.fn();
    await expect(withFinanceTestDatabase(work, testEnv)).rejects.toThrow(
      'connection identity',
    );
    expect(source.synchronize).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
    expect(source.destroy).toHaveBeenCalledTimes(1);
    expect(admin.query).toHaveBeenCalledWith(
      `DROP DATABASE IF EXISTS "${ownedDatabase}" WITH (FORCE)`,
    );
  });

  it('cleans up a created database after initialization fails', async () => {
    const failure = new Error('initialization rejected');
    source.initialize.mockRejectedValueOnce(failure);
    await expect(withFinanceTestDatabase(jest.fn(), testEnv)).rejects.toBe(
      failure,
    );
    expect(source.synchronize).not.toHaveBeenCalled();
    expect(admin.query).toHaveBeenCalledWith(
      `DROP DATABASE IF EXISTS "${ownedDatabase}" WITH (FORCE)`,
    );
    expect(admin.end).toHaveBeenCalledTimes(1);
  });

  it('retains the original callback failure after successful cleanup', async () => {
    const failure = new Error('fixture callback rejected');
    await expect(
      withFinanceTestDatabase(async () => {
        throw failure;
      }, testEnv),
    ).rejects.toBe(failure);
    expect(source.destroy).toHaveBeenCalledTimes(1);
    expect(admin.query).toHaveBeenCalledWith(
      `DROP DATABASE IF EXISTS "${ownedDatabase}" WITH (FORCE)`,
    );
  });

  it('still drops its database when closing the ORM pool fails', async () => {
    const failure = new Error('pool close rejected');
    source.destroy.mockRejectedValueOnce(failure);
    await expect(
      withFinanceTestDatabase(async () => undefined, testEnv),
    ).rejects.toBe(failure);
    expect(admin.query).toHaveBeenCalledWith(
      `DROP DATABASE IF EXISTS "${ownedDatabase}" WITH (FORCE)`,
    );
    expect(admin.end).toHaveBeenCalledTimes(1);
  });

  it('exposes callback and cleanup failures instead of losing the original error', async () => {
    const workFailure = new Error('fixture callback rejected');
    const cleanupFailure = new Error('drop rejected');
    admin.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(cleanupFailure);
    await expect(
      withFinanceTestDatabase(async () => {
        throw workFailure;
      }, testEnv),
    ).rejects.toMatchObject({ errors: [workFailure, cleanupFailure] });
    expect(admin.end).toHaveBeenCalledTimes(1);
  });

  it('fails if the independent cleanup query still finds its database', async () => {
    admin.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ datname: 'still-present' }] });
    await expect(
      withFinanceTestDatabase(async () => undefined, testEnv),
    ).rejects.toThrow('cleanup did not complete');
    expect(admin.end).toHaveBeenCalledTimes(1);
  });
});
