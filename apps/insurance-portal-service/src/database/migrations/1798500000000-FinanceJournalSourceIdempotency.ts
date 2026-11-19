import { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserve existing journals; refuse to harden a ledger with duplicate sources. */
export class FinanceJournalSourceIdempotency1798500000000 implements MigrationInterface {
  name = 'FinanceJournalSourceIdempotency1798500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [duplicate] = await queryRunner.query(
      `SELECT company_id, source_type, source_event_id, COUNT(*)::int AS count
         FROM finance_journal_entries
        GROUP BY company_id, source_type, source_event_id
       HAVING COUNT(*) > 1
        LIMIT 1`,
    );
    if (duplicate) {
      throw new Error(
        'Duplicate Finance journal source events require reconciliation before the idempotency index can be installed.',
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_finance_journal_source_event"
         ON finance_journal_entries (company_id, source_type, source_event_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_finance_journal_source_event"');
  }
}
