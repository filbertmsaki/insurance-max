import { MigrationInterface, QueryRunner } from 'typeorm';

/** Deferred validation lets a transaction insert its header before its lines. */
export class FinanceJournalBalanceGuard1798600000000 implements MigrationInterface {
  name = 'FinanceJournalBalanceGuard1798600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [invalid] = await queryRunner.query(
      `SELECT j.id
         FROM finance_journal_entries j
         LEFT JOIN finance_journal_lines l ON l.journal_entry_id = j.id
        GROUP BY j.id
       HAVING COUNT(l.id) < 2
           OR COALESCE(SUM(l.debit), 0) <> COALESCE(SUM(l.credit), 0)
           OR COALESCE(SUM(l.debit), 0) <= 0
           OR BOOL_OR(l.debit < 0 OR l.credit < 0
                      OR (l.debit > 0 AND l.credit > 0))
        LIMIT 1`,
    );
    if (invalid) {
      throw new Error(
        'Existing Finance journals must be reconciled before the deferred balance guard can be installed.',
      );
    }
    await queryRunner.query(`CREATE FUNCTION fn_finance_journal_balanced()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE journal_id uuid;
      DECLARE debits numeric;
      DECLARE credits numeric;
      DECLARE line_count integer;
      DECLARE invalid_line boolean;
      BEGIN
        IF TG_TABLE_NAME = 'finance_journal_entries' THEN
          journal_id := NEW.id;
        ELSIF TG_OP = 'DELETE' THEN
          journal_id := OLD.journal_entry_id;
        ELSE
          journal_id := NEW.journal_entry_id;
        END IF;
        SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0),
               COUNT(*), COALESCE(BOOL_OR(debit < 0 OR credit < 0
                    OR (debit > 0 AND credit > 0)), false)
          INTO debits, credits, line_count, invalid_line
          FROM finance_journal_lines WHERE journal_entry_id = journal_id;
        IF line_count < 2 OR debits <> credits OR debits <= 0 OR invalid_line THEN
          RAISE EXCEPTION 'Finance journal % is not balanced', journal_id;
        END IF;
        RETURN NULL;
      END $$`);
    await queryRunner.query(`CREATE CONSTRAINT TRIGGER finance_journal_header_balanced
      AFTER INSERT OR UPDATE ON finance_journal_entries
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION fn_finance_journal_balanced()`);
    await queryRunner.query(`CREATE CONSTRAINT TRIGGER finance_journal_lines_balanced
      AFTER INSERT OR UPDATE OR DELETE ON finance_journal_lines
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION fn_finance_journal_balanced()`);
    await queryRunner.query(`CREATE FUNCTION fn_finance_journal_immutable()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Posted Finance journals are immutable; write a governed reversal';
      END $$`);
    await queryRunner.query(`CREATE TRIGGER finance_journal_header_immutable
      BEFORE UPDATE OR DELETE ON finance_journal_entries FOR EACH ROW
      EXECUTE FUNCTION fn_finance_journal_immutable()`);
    await queryRunner.query(`CREATE TRIGGER finance_journal_line_immutable
      BEFORE UPDATE OR DELETE ON finance_journal_lines FOR EACH ROW
      EXECUTE FUNCTION fn_finance_journal_immutable()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER finance_journal_line_immutable ON finance_journal_lines',
    );
    await queryRunner.query(
      'DROP TRIGGER finance_journal_header_immutable ON finance_journal_entries',
    );
    await queryRunner.query('DROP FUNCTION fn_finance_journal_immutable()');
    await queryRunner.query(
      'DROP TRIGGER finance_journal_lines_balanced ON finance_journal_lines',
    );
    await queryRunner.query(
      'DROP TRIGGER finance_journal_header_balanced ON finance_journal_entries',
    );
    await queryRunner.query('DROP FUNCTION fn_finance_journal_balanced()');
  }
}
