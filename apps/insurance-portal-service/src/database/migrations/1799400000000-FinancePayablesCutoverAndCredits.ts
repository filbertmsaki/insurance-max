import type { MigrationInterface, QueryRunner } from 'typeorm';

const previousKinds =
  "'SETTINGS','CATEGORY','SUPPLIER','BANK','ORDER','RECEIPT','BILL','CREDIT','DEBIT','ADVANCE','APPLICATION','EXPENSE','IMPREST','RETIREMENT','PAYMENT','BATCH','RECONCILIATION','REVERSAL'";
const previousBankTypes =
  "'REFUND','COMMISSION_PAYMENT','AP_PAYMENT','AP_IMPREST_RETURN','AP_REVERSAL'";

export class FinancePayablesCutoverAndCredits1799400000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE finance_ap_records DROP CONSTRAINT finance_ap_records_kind_check,
        ADD CONSTRAINT finance_ap_records_kind_check CHECK(kind IN (${previousKinds},'CREDIT_APPLICATION','SUPPLIER_REFUND','OPENING_IMPORT'));
      ALTER TABLE finance_gl_bank_settlements DROP CONSTRAINT finance_gl_bank_settlements_source_type_check,
        ADD CONSTRAINT finance_gl_bank_settlements_source_type_check CHECK(source_type IN (${previousBankTypes},'AP_SUPPLIER_REFUND'));
      CREATE TABLE finance_ap_opening_items (
        book_id uuid NOT NULL, import_id uuid NOT NULL, item_id uuid PRIMARY KEY,
        functional_amount numeric(38,12) NOT NULL CHECK(functional_amount<>0),
        FOREIGN KEY(book_id,import_id) REFERENCES finance_ap_records(book_id,id),
        FOREIGN KEY(book_id,item_id) REFERENCES finance_ap_records(book_id,id)
      );
      CREATE INDEX finance_ap_import_items ON finance_ap_opening_items(book_id,import_id);
      CREATE UNIQUE INDEX finance_ap_cutover_control ON finance_ap_records(book_id,(data->'details'->>'controlAccount'))
        WHERE kind='OPENING_IMPORT' AND state IN ('PENDING','APPROVED');
      CREATE TRIGGER preserve_ap_opening_item BEFORE UPDATE OR DELETE ON finance_ap_opening_items FOR EACH ROW EXECUTE FUNCTION finance_ap_preserve();
      CREATE FUNCTION finance_ap_protect_import() RETURNS trigger LANGUAGE plpgsql AS $guard$
      BEGIN
        IF NEW.candidate_id IS NOT NULL THEN RAISE EXCEPTION 'An AP opening allocation cannot post a second GL liability'; END IF;
        IF OLD.data->'details' ? 'openingImportId' AND (NEW.state<>'CANCELLED' OR NOT EXISTS(
          SELECT 1 FROM finance_ap_opening_items o JOIN finance_ap_records p ON p.id=o.import_id WHERE o.item_id=OLD.id AND p.state='CANCELLED'
        )) THEN RAISE EXCEPTION 'Correct the approved opening import as a whole'; END IF;
        RETURN NEW;
      END $guard$;
      CREATE TRIGGER protect_ap_import BEFORE UPDATE ON finance_ap_records FOR EACH ROW
        WHEN (OLD.kind='OPENING_IMPORT' OR OLD.data->'details' ? 'openingImportId') EXECUTE FUNCTION finance_ap_protect_import();
      ALTER VIEW finance_ap_status RENAME TO finance_ap_journal_status;
      CREATE VIEW finance_ap_status AS
        SELECT d.*,j.journal_id,j.journal_no,
          CASE WHEN o.item_id IS NOT NULL AND p.state='APPROVED' AND d.state='APPROVED' THEN p.doc_date ELSE j.posted_date END posted_date,
          CASE WHEN o.item_id IS NOT NULL AND p.state='APPROVED' AND d.state='APPROVED' THEN 'POSTED' ELSE j.status END status
        FROM finance_ap_records d JOIN finance_ap_journal_status j ON j.id=d.id
        LEFT JOIN finance_ap_opening_items o ON o.item_id=d.id LEFT JOIN finance_ap_records p ON p.id=o.import_id;
    `);
  }

  async down(q: QueryRunner) {
    const [used] =
      await q.query(`SELECT EXISTS(SELECT 1 FROM finance_ap_records WHERE kind IN ('OPENING_IMPORT','CREDIT_APPLICATION','SUPPLIER_REFUND')
      OR (kind='CREDIT' AND coalesce((data->'details'->>'availableCredit')::numeric,0)>0)) used`);
    if (used.used)
      throw new Error(
        'Preserve existing supplier credits and opening allocations before rollback.',
      );
    await q.query(`
      DROP VIEW finance_ap_status;
      ALTER VIEW finance_ap_journal_status RENAME TO finance_ap_status;
      DROP TRIGGER protect_ap_import ON finance_ap_records;
      DROP FUNCTION finance_ap_protect_import();
      DROP TABLE finance_ap_opening_items;
      DROP INDEX finance_ap_cutover_control;
      ALTER TABLE finance_ap_records DROP CONSTRAINT finance_ap_records_kind_check,
        ADD CONSTRAINT finance_ap_records_kind_check CHECK(kind IN (${previousKinds}));
      ALTER TABLE finance_gl_bank_settlements DROP CONSTRAINT finance_gl_bank_settlements_source_type_check,
        ADD CONSTRAINT finance_gl_bank_settlements_source_type_check CHECK(source_type IN (${previousBankTypes}));
    `);
  }
}
