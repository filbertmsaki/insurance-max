import type { MigrationInterface, QueryRunner } from 'typeorm';

const ordinaryTill = "IF a.kind='TILL' THEN";
const checkedTill = `IF a.kind='TILL' AND doc.kind IN ('SHORTAGE','OVERAGE') AND doc.shift_id IS NULL THEN
          IF a.branch::text IS DISTINCT FROM NEW.dimensions->>'BRANCH' OR NOT EXISTS(
            SELECT 1 FROM finance_cb_count_register x
            JOIN finance_cb_cashiers assigned ON assigned.account_id=x.account_id AND assigned.user_id=x.cashier AND assigned.active
            JOIN finance_cb_balances b ON b.id=x.account_id
            WHERE x.id::text=lower(doc.input->'fields'->>'target') AND x.opening_account_id=a.id AND x.current_count
              AND a.id::text=lower(doc.input->'fields'->>'account') AND x.book_id=doc.book_id
              AND x.cashier=doc.maker_id AND x.day=j.accounting_date AND doc.day=x.day
              AND x.adjustment_id=doc.id AND x.adjustment_state='APPROVED'
              AND x.expected=b.balance AND x.counted BETWEEN 0 AND a.maximum_float AND x.counted-x.expected=delta
              AND ((doc.kind='SHORTAGE' AND delta<0) OR (doc.kind='OVERAGE' AND delta>0))
              AND NOT EXISTS(SELECT 1 FROM finance_cb_shifts active WHERE active.account_id=a.id AND active.close_id IS NULL)
          ) THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='Verify the approved opening count and its exact variance before posting.'; END IF;
        ELSIF a.kind='TILL' THEN`;

export class FinanceCashOpeningCounts1800400000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE finance_cb_counts ALTER COLUMN shift_id DROP NOT NULL,
        ADD COLUMN opening_account_id uuid REFERENCES finance_cb_accounts(id),
        ADD COLUMN ended_by uuid REFERENCES finance_cb_documents(id),
        ADD CONSTRAINT finance_cb_count_custody CHECK (
          (shift_id IS NOT NULL AND opening_account_id IS NULL AND ended_by IS NULL)
          OR (shift_id IS NULL AND opening_account_id IS NOT NULL)
        );
      CREATE UNIQUE INDEX finance_cb_current_opening_count ON finance_cb_counts(opening_account_id)
        WHERE opening_account_id IS NOT NULL AND ended_by IS NULL;
      CREATE INDEX finance_cb_variance_target ON finance_cb_documents(book_id,lower(input->'fields'->>'target'))
        WHERE kind IN ('SHORTAGE','OVERAGE') AND state NOT IN ('REJECTED','CANCELLED');
      CREATE VIEW finance_cb_count_register AS
        SELECT x.*,a.book_id,a.id account_id,a.code,d.reference,d.day,d.sequence,d.maker_id cashier,
          CASE WHEN x.opening_account_id IS NOT NULL THEN x.ended_by IS NULL ELSE s.close_id IS NULL AND d.kind='COUNT' END current_count,
          v.id adjustment_id,v.state adjustment_state
        FROM finance_cb_counts x JOIN finance_cb_documents d ON d.id=x.id
        LEFT JOIN finance_cb_shifts s ON s.id=x.shift_id
        JOIN finance_cb_accounts a ON a.id=coalesce(x.opening_account_id,s.account_id)
        LEFT JOIN LATERAL (
          SELECT adj.id,adj.state FROM finance_cb_documents adj WHERE adj.book_id=a.book_id
            AND adj.kind IN ('SHORTAGE','OVERAGE') AND adj.state NOT IN ('REJECTED','CANCELLED')
            AND lower(adj.input->'fields'->>'target')=x.id::text ORDER BY adj.sequence LIMIT 1
        ) v ON true;
    `);
    await this.updateCapture(q, ordinaryTill, checkedTill);
  }

  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_cb_documents WHERE kind='OPENING_COUNT')
      THEN RAISE EXCEPTION 'Opening count history requires the cash opening counts migration.'; END IF; END $$;`);
    await this.updateCapture(q, checkedTill, ordinaryTill);
    await q.query(`DROP VIEW finance_cb_count_register;
      DROP INDEX finance_cb_variance_target;
      ALTER TABLE finance_cb_counts DROP CONSTRAINT finance_cb_count_custody,
        DROP COLUMN ended_by, DROP COLUMN opening_account_id, ALTER COLUMN shift_id SET NOT NULL;`);
  }

  private async updateCapture(q: QueryRunner, before: string, after: string) {
    const [row] = await q.query(
      "SELECT pg_get_functiondef('finance_cb_register_line()'::regprocedure) definition",
    );
    const definition: string = row.definition;
    if (definition.split(before).length !== 2)
      throw new Error('Unexpected cashbook journal capture function.');
    await q.query(definition.replace(before, () => after));
  }
}
