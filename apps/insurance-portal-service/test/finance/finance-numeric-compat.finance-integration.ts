import { withFoundationDatabase } from '../support/finance-ledger-foundation-fixture';

describe('Finance numeric compatibility', () => {
  it('rejects non-finite values in candidate, approval, and ledger constraints', async () => {
    await withFoundationDatabase(async (fixture) => {
      const candidate = await fixture.prepareLedger();
      await fixture.acceptLedger(candidate);
      const runner = fixture.source.createQueryRunner();
      try {
        for (const [table, column] of [
          ['finance_journal_candidate_lines', 'debit'],
          ['finance_approval_mandates', 'max_amount'],
          ['finance_foundation_lines', 'rounding_debit'],
        ]) {
          await runner.query(
            `CREATE TEMP TABLE numeric_check (LIKE ${table} INCLUDING CONSTRAINTS)`,
          );
          await runner.query(
            `INSERT INTO numeric_check SELECT * FROM ${table} LIMIT 1`,
          );
          for (const value of ['NaN', 'Infinity', '-Infinity'])
            await expect(
              runner.query(`UPDATE numeric_check SET ${column}=$1::numeric`, [
                value,
              ]),
            ).rejects.toThrow();
          await runner.query('DROP TABLE numeric_check');
        }
      } finally {
        await runner.release();
      }
    });
  });
});
