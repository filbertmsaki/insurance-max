import { randomUUID } from 'node:crypto';
import { FinanceJournalSourceIdempotency1798500000000 } from '../../src/database/migrations/1798500000000-FinanceJournalSourceIdempotency';
import { FinanceJournalBalanceGuard1798600000000 } from '../../src/database/migrations/1798600000000-FinanceJournalBalanceGuard';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import {
  FINANCE_TEST_FIXTURE,
  seedFinanceTestAccounts,
} from '../support/finance-test-fixtures';

describe('Legacy journal database integrity', () => {
  it('rejects duplicate sources and unbalanced direct writes', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      await seedFinanceTestAccounts(dataSource);
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      try {
        await runner.startTransaction();
        await new FinanceJournalSourceIdempotency1798500000000().up(runner);
        await new FinanceJournalBalanceGuard1798600000000().up(runner);
        await runner.commitTransaction();
      } catch (error) {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        throw error;
      } finally {
        await runner.release();
      }

      const companyId = FINANCE_TEST_FIXTURE.companyA;
      const account = await dataSource.query(
        `SELECT id FROM finance_accounts
          WHERE company_id = $1 AND account_code = '1100'`,
        [companyId],
      );
      const insertHeader = async (sourceEventId: string) => {
        const id = randomUUID();
        await dataSource.query(
          `INSERT INTO finance_journal_entries
           (id, company_id, journal_no, journal_date, source_type, source_id,
            source_event_id, description, currency_code, entry_hash)
           VALUES ($1, $2, $3, CURRENT_DATE, 'RECEIPT', $4, $5,
                   'Integrity fixture', 'USD', $6)`,
          [
            id,
            companyId,
            `TEST-${id}`,
            randomUUID(),
            sourceEventId,
            'f'.repeat(64),
          ],
        );
        return id;
      };

      await expect(insertHeader('unbalanced-source')).rejects.toThrow();
      expect(
        await dataSource.query(
          'SELECT COUNT(*)::int AS n FROM finance_journal_entries',
        ),
      ).toEqual([{ n: 0 }]);

      const journalId = randomUUID();
      await dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO finance_journal_entries
           (id, company_id, journal_no, journal_date, source_type, source_id,
            source_event_id, description, currency_code, entry_hash)
           VALUES ($1, $2, $3, CURRENT_DATE, 'RECEIPT', $4, 'same-source',
                   'Integrity fixture', 'USD', $5)`,
          [
            journalId,
            companyId,
            `TEST-${journalId}`,
            randomUUID(),
            'f'.repeat(64),
          ],
        );
        await manager.query(
          `INSERT INTO finance_journal_lines
           (journal_entry_id, account_id, debit, credit)
           VALUES ($1,$2,10,0),($1,$2,0,10)`,
          [journalId, account[0].id],
        );
      });
      await expect(insertHeader('same-source')).rejects.toThrow();
      await expect(
        dataSource.query(
          `UPDATE finance_journal_entries SET description = 'changed' WHERE id = $1`,
          [journalId],
        ),
      ).rejects.toThrow(/immutable/);
      await expect(
        dataSource.query(
          `UPDATE finance_journal_lines SET debit = 9 WHERE journal_entry_id = $1 AND debit = 10`,
          [journalId],
        ),
      ).rejects.toThrow(/immutable/);
      expect(
        await dataSource.query(
          'SELECT COUNT(*)::int AS n FROM finance_journal_entries',
        ),
      ).toEqual([{ n: 1 }]);
    });
  });
});
