import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceCashBankSplitMatches1800300000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE finance_cb_matches ADD COLUMN amount numeric(38,12);
      UPDATE finance_cb_matches m SET amount=e.amount FROM finance_cb_entries e WHERE e.id=m.entry_id;
      ALTER TABLE finance_cb_matches ALTER COLUMN amount SET NOT NULL,
        ADD CHECK (amount<>0), DROP CONSTRAINT finance_cb_matches_entry_id_key;
      CREATE INDEX finance_cb_matches_entry ON finance_cb_matches(entry_id);

      CREATE FUNCTION finance_cb_allocate_match() RETURNS trigger LANGUAGE plpgsql AS $body$
      DECLARE movement finance_cb_entries; outstanding numeric;
      BEGIN
        PERFORM 1 FROM finance_cb_statement_lines WHERE id=NEW.line_id FOR UPDATE;
        SELECT * INTO STRICT movement FROM finance_cb_entries WHERE id=NEW.entry_id FOR UPDATE;
        -- Older matching paths, including the verified payable trigger, settle the whole entry.
        NEW.amount:=coalesce(NEW.amount,movement.amount);
        SELECT movement.amount-coalesce(sum(amount),0) INTO outstanding FROM finance_cb_matches WHERE entry_id=NEW.entry_id;
        IF sign(NEW.amount)<>sign(movement.amount) OR abs(NEW.amount)>abs(outstanding)
          OR EXISTS(SELECT 1 FROM finance_cb_matches WHERE line_id=NEW.line_id AND decision_id<>NEW.decision_id) THEN
          RAISE EXCEPTION USING ERRCODE='P0601', MESSAGE='The bank line or cashbook amount is already allocated.';
        END IF;
        RETURN NEW;
      END $body$;
      CREATE TRIGGER finance_cb_allocate_match BEFORE INSERT ON finance_cb_matches
        FOR EACH ROW EXECUTE FUNCTION finance_cb_allocate_match();

      CREATE VIEW finance_cb_entry_clearing AS
        SELECT e.*,m.line_id,e.amount-coalesce(m.matched,0) remaining_amount
        FROM finance_cb_entries e LEFT JOIN LATERAL (
          SELECT (array_agg(mx.line_id ORDER BY mx.line_id))[1] line_id,sum(mx.amount) matched
          FROM finance_cb_matches mx WHERE mx.entry_id=e.id
        ) m ON true;
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_cb_documents WHERE kind='SPLIT_MATCH')
        THEN RAISE EXCEPTION 'Split reconciliation history requires this migration.'; END IF; END $$;
      DROP VIEW finance_cb_entry_clearing;
      DROP TRIGGER finance_cb_allocate_match ON finance_cb_matches;
      DROP FUNCTION finance_cb_allocate_match();
      DROP INDEX finance_cb_matches_entry;
      ALTER TABLE finance_cb_matches DROP COLUMN amount, ADD UNIQUE(entry_id);
    `);
  }
}
