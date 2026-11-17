import { DataSource } from 'typeorm';
import { isDisposableTestDatabase } from './test-database';

/** Only synthetic accounts in a disposable e2e database, never a posting release. */
export async function provisionSyntheticJournalAccounts(
  source: DataSource,
  companyId: string,
) {
  const [database] = await source.query('SELECT current_database() AS name');
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.APP_ENV !== 'test' ||
    !isDisposableTestDatabase(database.name)
  )
    throw new Error(
      'Synthetic journal accounts require a disposable test database.',
    );
  for (const [code, name, type] of [
    ['1100', 'Synthetic Bank', 'ASSET'],
    ['1200', 'Synthetic Receivables', 'ASSET'],
    ['2100', 'Synthetic Advances', 'LIABILITY'],
    ['2200', 'Synthetic Commission Payable', 'LIABILITY'],
    ['2400', 'Synthetic Claims Payable', 'LIABILITY'],
    ['4100', 'Synthetic Premium', 'INCOME'],
    ['4200', 'Synthetic Taxes', 'LIABILITY'],
    ['5100', 'Synthetic Commission Expense', 'EXPENSE'],
  ]) {
    await source.query(
      `INSERT INTO finance_accounts(company_id,account_code,account_name,account_type,is_active) VALUES($1,$2,$3,$4,true) ON CONFLICT(company_id,account_code) DO UPDATE SET account_type=EXCLUDED.account_type,is_active=true`,
      [companyId, code, name, type],
    );
  }
}
