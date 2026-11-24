import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { IdentifierGeneratorService } from '../../src/modules/shared/identifiers/identifier-generator.service';
import { FinanceAccount } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/entities/finance-account.entity';
import { FinanceJournalEntry } from '../../src/modules/tenant/finance/accounting/journal-entries/entities/finance-journal-entry.entity';
import { FinanceJournalLine } from '../../src/modules/tenant/finance/accounting/journal-entries/entities/finance-journal-line.entity';
import { FinanceJournalService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal.service';
import {
  readFinanceTestServer,
  withFinanceTestDatabase,
} from '../support/finance-test-database';
import {
  FINANCE_TEST_FIXTURE,
  financeTestReceipt,
  seedFinanceTestAccounts,
} from '../support/finance-test-fixtures';

function journalService() {
  // Only identifier generation is substituted. ORM, PostgreSQL, decimal code,
  // public posting method and hash implementation execute normally.
  return new FinanceJournalService(
    {
      generateJournalNumber: async () => `TEST-${randomUUID()}`,
    } as unknown as IdentifierGeneratorService,
    new ProductDefinitionHashService(),
    // Synthetic posting-vector fixture only; real policy eligibility is tested separately.
    { requireEligible: async () => undefined },
  );
}

describe('Finance isolated PostgreSQL fixture readiness (B03)', () => {
  it('FD01 creates only the current Finance tables with the actual numeric scale', async () => {
    await withFinanceTestDatabase(async ({ dataSource, database }) => {
      const [identity] = await dataSource.query(
        'SELECT current_database() AS database',
      );
      expect(identity.database).toBe(database);
      const tables = await dataSource.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
      );
      expect(
        tables.map((row: { table_name: string }) => row.table_name),
      ).toEqual([
        'finance_accounts',
        'finance_journal_entries',
        'finance_journal_lines',
      ]);
      const columns = await dataSource.query(
        "SELECT column_name, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'finance_journal_lines' AND column_name IN ('debit', 'credit') ORDER BY column_name",
      );
      expect(columns).toEqual([
        { column_name: 'credit', numeric_precision: 20, numeric_scale: 4 },
        { column_name: 'debit', numeric_precision: 20, numeric_scale: 4 },
      ]);
      expect(await dataSource.getRepository(FinanceAccount).count()).toBe(0);
      expect(await dataSource.getRepository(FinanceJournalEntry).count()).toBe(
        0,
      );
      expect(await dataSource.getRepository(FinanceJournalLine).count()).toBe(
        0,
      );
    });
  });

  it('FD02 persists the independent receipt vector using pre-existing synthetic accounts', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      await seedFinanceTestAccounts(dataSource);
      const entry = await dataSource.transaction((manager) =>
        journalService().postReceipt(
          manager,
          financeTestReceipt(),
          FINANCE_TEST_FIXTURE.eventId,
          null,
        ),
      );
      const stored = await dataSource
        .getRepository(FinanceJournalEntry)
        .findOneByOrFail({ id: entry.id });
      expect(stored).toMatchObject({
        company_id: FINANCE_TEST_FIXTURE.companyA,
        source_id: FINANCE_TEST_FIXTURE.receiptId,
        source_type: 'RECEIPT',
        source_event_id: FINANCE_TEST_FIXTURE.eventId,
        currency_code: 'USD',
      });
      const lines = await dataSource.query(
        'SELECT a.account_code, l.debit::text AS debit, l.credit::text AS credit FROM finance_journal_lines l JOIN finance_accounts a ON a.id = l.account_id WHERE l.journal_entry_id = $1 ORDER BY a.account_code',
        [entry.id],
      );
      expect(lines).toEqual([
        { account_code: '1100', debit: '25.1250', credit: '0.0000' },
        { account_code: '1200', debit: '0.0000', credit: '25.1250' },
      ]);
      expect(await dataSource.getRepository(FinanceAccount).count()).toBe(4);
      expect(
        await dataSource
          .getRepository(FinanceJournalEntry)
          .countBy({ company_id: FINANCE_TEST_FIXTURE.companyB }),
      ).toBe(0);
    });
  });

  it('FD03 rolls back a caller-owned transaction after journal writes', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      await seedFinanceTestAccounts(dataSource);
      const failure = new Error('controlled caller transaction failure');
      await expect(
        dataSource.transaction(async (manager) => {
          await journalService().postReceipt(
            manager,
            financeTestReceipt(),
            FINANCE_TEST_FIXTURE.eventId,
            null,
          );
          expect(await manager.getRepository(FinanceJournalEntry).count()).toBe(
            1,
          );
          expect(await manager.getRepository(FinanceJournalLine).count()).toBe(
            2,
          );
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(await dataSource.getRepository(FinanceJournalEntry).count()).toBe(
        0,
      );
      expect(await dataSource.getRepository(FinanceJournalLine).count()).toBe(
        0,
      );
      expect(await dataSource.getRepository(FinanceAccount).count()).toBe(4);
    });
  });

  it('FD04 removes its owned database even when the fixture callback fails', async () => {
    let ownedDatabase = '';
    const failure = new Error('controlled fixture failure');
    await expect(
      withFinanceTestDatabase(async ({ database }) => {
        ownedDatabase = database;
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(ownedDatabase).toMatch(/^insurance_portal_test_\d{14}_[a-z0-9]{6}$/);
    const admin = new Client({
      ...readFinanceTestServer(),
      database: 'postgres',
      ssl: false,
      connectionTimeoutMillis: 5000,
    });
    try {
      await admin.connect();
      const result = await admin.query(
        'SELECT datname FROM pg_database WHERE datname = $1',
        [ownedDatabase],
      );
      expect(result.rows).toEqual([]);
    } finally {
      await admin.end();
    }
  });
});
