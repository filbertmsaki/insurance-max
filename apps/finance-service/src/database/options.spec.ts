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

  it('uses the explicit independent Finance migration set', () => {
    const options = financeDatabaseOptions({
      FINANCE_DATABASE_URL: 'postgres://localhost/finance_test',
    });
    expect(options.migrations).toHaveLength(14);
    expect(
      options.migrations?.map((m) => (typeof m === 'function' ? m.name : m)),
    ).toEqual([
      'FinanceScopeFoundations1796000000000',
      'FinanceConfigurationReviews1796100000000',
      'FinanceChartSourceAuthorities1796200000000',
      'FinanceJournalCandidates1796300000000',
      'FinanceApprovalGovernance1796400000000',
      'FinanceEventContractPreviews1796500000000',
      'FinanceIntegrationReliability1796600000000',
      'FinanceOwnedExceptions1796700000000',
      'FinancePolicyGovernance1797100000000',
      'FinanceLedgerFoundation1797200000000',
      'FinanceRecurringAllocationPreviews1797800000000',
      'FinanceAllocationPreviewReviews1797900000000',
      'FinanceSourceAttestations1798000000000',
      'FinanceSourceKeyChanges1798100000000',
    ]);
  });
});
