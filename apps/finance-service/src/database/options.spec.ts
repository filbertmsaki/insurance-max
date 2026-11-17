import { financeDatabaseOptions } from './options';

describe('independent finance database configuration', () => {
  it('requires an explicit PostgreSQL database URL', () => {
    expect(() => financeDatabaseOptions({})).toThrow('FINANCE_DATABASE_URL');
    expect(() =>
      financeDatabaseOptions({
        FINANCE_DATABASE_URL: 'https://example.com/db',
      }),
    ).toThrow();
    expect(() =>
      financeDatabaseOptions({ FINANCE_DATABASE_URL: 'postgres://localhost/' }),
    ).toThrow();
  });

  it('does not synchronize or run migrations automatically', () => {
    expect(
      financeDatabaseOptions({
        FINANCE_DATABASE_URL: 'postgres://localhost/finance_test',
      }),
    ).toMatchObject({
      type: 'postgres',
      synchronize: false,
      migrationsRun: false,
      entities: [],
    });
  });

  it('includes only inactive configuration and allocation migrations', () => {
    const options = financeDatabaseOptions({
      FINANCE_DATABASE_URL: 'postgres://localhost/finance_test',
    });
    expect(options.migrations).toHaveLength(6);
    expect(
      options.migrations?.map((m) => (typeof m === 'function' ? m.name : m)),
    ).toEqual([
      'FinanceScopeFoundations1796000000000',
      'FinanceConfigurationReviews1796100000000',
      'FinanceRecurringAllocationPreviews1797800000000',
      'FinanceAllocationPreviewReviews1797900000000',
      'FinanceSourceAttestations1798000000000',
      'FinanceSourceKeyChanges1798100000000',
    ]);
  });
});
