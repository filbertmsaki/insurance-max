import {
  assertDatabaseMatchesEnvironment,
  isTestDatabaseName,
} from './database-environment.guard';

describe('database environment guard', () => {
  it('recognises test databases by a whole "test" word', () => {
    expect(isTestDatabaseName('insurance_portal_test')).toBe(true);
    expect(
      isTestDatabaseName('insurance_portal_test_20261010120000_ab12cd'),
    ).toBe(true);
    expect(isTestDatabaseName('insurance_portal_ci_test')).toBe(true);
    expect(isTestDatabaseName('insurance_portal_db')).toBe(false);
    expect(isTestDatabaseName('contest_db')).toBe(false);
  });

  it.each([
    [{ appEnv: 'test' }, 'insurance_portal_db'],
    [{ nodeEnv: 'test', appEnv: 'development' }, 'insurance_portal_db'],
    [{ nodeEnv: 'TEST' }, 'tiramis_db'],
  ])('refuses a test runtime %o against %s', (env, database) => {
    expect(() =>
      assertDatabaseMatchesEnvironment({ ...env, database }),
    ).toThrow(/Refusing to start a test run/);
  });

  it.each(['production', 'uat', 'staging'])(
    'refuses APP_ENV=%s against a test database',
    (appEnv) => {
      expect(() =>
        assertDatabaseMatchesEnvironment({
          appEnv,
          database: 'insurance_portal_test',
        }),
      ).toThrow(/against test database/);
    },
  );

  it('allows matching pairs', () => {
    expect(() =>
      assertDatabaseMatchesEnvironment({
        appEnv: 'test',
        nodeEnv: 'test',
        database: 'insurance_portal_test_20261010120000_ab12cd',
      }),
    ).not.toThrow();
    expect(() =>
      assertDatabaseMatchesEnvironment({
        appEnv: 'production',
        nodeEnv: 'production',
        database: 'insurance_portal_db',
      }),
    ).not.toThrow();
    expect(() =>
      assertDatabaseMatchesEnvironment({
        appEnv: 'development',
        database: 'insurance_portal_db',
      }),
    ).not.toThrow();
  });
});
