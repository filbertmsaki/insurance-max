import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceTradePayables1799300000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE finance_gl_bank_settlements DROP CONSTRAINT finance_gl_bank_settlements_source_type_check;
      ALTER TABLE finance_gl_bank_settlements ADD CONSTRAINT finance_gl_bank_settlements_source_type_check
        CHECK(source_type IN ('REFUND','COMMISSION_PAYMENT','AP_PAYMENT','AP_IMPREST_RETURN','AP_REVERSAL'));
      CREATE TABLE finance_ap_records (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        sequence bigint GENERATED ALWAYS AS IDENTITY, kind text NOT NULL CHECK(kind IN (
          'SETTINGS','CATEGORY','SUPPLIER','BANK','ORDER','RECEIPT','BILL','CREDIT','DEBIT','ADVANCE','APPLICATION',
          'EXPENSE','IMPREST','RETIREMENT','PAYMENT','BATCH','RECONCILIATION','REVERSAL')),
        reference text NOT NULL CHECK(length(reference) BETWEEN 1 AND 100), party text NOT NULL DEFAULT '',
        revision integer NOT NULL DEFAULT 1 CHECK(revision>0), replaces_id uuid,
        request_key uuid NOT NULL, request_hash text NOT NULL, data jsonb NOT NULL,
        doc_date date NOT NULL, due_date date, currency text, amount numeric(38,12) NOT NULL DEFAULT 0 CHECK(amount>=0),
        state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
        maker_id uuid NOT NULL, maker_person uuid NOT NULL, reviewer_person uuid, reviewer_user_id uuid, review_reason text, reviewed_at timestamptz,
        candidate_id uuid UNIQUE REFERENCES finance_journal_candidates(id), settlement jsonb,
        created_at timestamptz NOT NULL DEFAULT statement_timestamp(), UNIQUE(book_id,id), UNIQUE(book_id,request_key),
        FOREIGN KEY(book_id,replaces_id) REFERENCES finance_ap_records(book_id,id),
        CHECK(reviewer_person IS NULL OR reviewer_person<>maker_person)
      );
      CREATE UNIQUE INDEX finance_ap_business_reference ON finance_ap_records(book_id,kind,party,upper(btrim(reference)),revision)
        WHERE state NOT IN ('CANCELLED','REJECTED');
      CREATE INDEX finance_ap_party_date ON finance_ap_records(book_id,party,doc_date);
      CREATE TABLE finance_ap_movements (
        book_id uuid NOT NULL, document_id uuid NOT NULL, item_id uuid NOT NULL,
        amount numeric(38,12) NOT NULL, withholding numeric(38,12) NOT NULL DEFAULT 0,
        PRIMARY KEY(document_id,item_id), FOREIGN KEY(book_id,document_id) REFERENCES finance_ap_records(book_id,id),
        FOREIGN KEY(book_id,item_id) REFERENCES finance_ap_records(book_id,id)
      );
      CREATE INDEX finance_ap_item_movements ON finance_ap_movements(book_id,item_id);
      CREATE TABLE finance_ap_order_quantities (
        book_id uuid NOT NULL, document_id uuid NOT NULL, order_id uuid NOT NULL, item text NOT NULL,
        quantity numeric(30,6) NOT NULL CHECK(quantity>0), PRIMARY KEY(document_id,item),
        FOREIGN KEY(book_id,document_id) REFERENCES finance_ap_records(book_id,id),
        FOREIGN KEY(book_id,order_id) REFERENCES finance_ap_records(book_id,id)
      );
      CREATE TABLE finance_ap_batch_items (
        book_id uuid NOT NULL, batch_id uuid NOT NULL, payment_id uuid NOT NULL, PRIMARY KEY(batch_id,payment_id),
        FOREIGN KEY(book_id,batch_id) REFERENCES finance_ap_records(book_id,id),
        FOREIGN KEY(book_id,payment_id) REFERENCES finance_ap_records(book_id,id)
      );
      CREATE INDEX finance_ap_batch_payment ON finance_ap_batch_items(book_id,payment_id);
      CREATE TABLE finance_ap_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, book_id uuid NOT NULL, record_id uuid NOT NULL,
        action text NOT NULL, actor uuid NOT NULL, reason text NOT NULL, evidence jsonb, at timestamptz NOT NULL DEFAULT statement_timestamp(),
        FOREIGN KEY(book_id,record_id) REFERENCES finance_ap_records(book_id,id)
      );
      CREATE FUNCTION finance_ap_preserve() RETURNS trigger LANGUAGE plpgsql AS $ap$
      BEGIN
        IF TG_TABLE_NAME<>'finance_ap_records' OR TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Preserve AP history and use a linked correction'; END IF;
        IF (to_jsonb(OLD)-ARRAY['state','reviewer_person','reviewer_user_id','review_reason','reviewed_at','candidate_id','settlement'])
          IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','reviewer_person','reviewer_user_id','review_reason','reviewed_at','candidate_id','settlement'])
          OR OLD.state IN ('CANCELLED','REJECTED') THEN RAISE EXCEPTION 'AP source and posted records are immutable'; END IF;
        IF OLD.candidate_id IS NOT NULL AND NOT (NEW.candidate_id IS NOT DISTINCT FROM OLD.candidate_id AND NEW.state='CANCELLED' AND OLD.settlement IS NULL AND NEW.settlement IS NULL
          AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals j WHERE j.candidate_id=OLD.candidate_id AND j.mode='LIVE')
          AND 'REJECTED_INACTIVE'=coalesce((SELECT r.state FROM finance_approval_requests r WHERE r.candidate_id=OLD.candidate_id ORDER BY r.expires_at DESC,r.id DESC LIMIT 1),''))
          THEN RAISE EXCEPTION 'Preserve confirmed AP payments and journals'; END IF;
        IF NEW.state IS DISTINCT FROM OLD.state AND NOT ((OLD.state='PENDING' AND NEW.state IN ('APPROVED','REJECTED','CANCELLED')) OR (OLD.state='APPROVED' AND NEW.state='CANCELLED')) THEN RAISE EXCEPTION 'Invalid AP decision'; END IF;
        IF OLD.reviewer_person IS NOT NULL AND ROW(OLD.reviewer_person,OLD.reviewer_user_id,OLD.review_reason,OLD.reviewed_at)
          IS DISTINCT FROM ROW(NEW.reviewer_person,NEW.reviewer_user_id,NEW.review_reason,NEW.reviewed_at) THEN RAISE EXCEPTION 'Preserve the original AP decision'; END IF;
        IF NEW.state IN ('APPROVED','REJECTED') AND (NEW.reviewer_person IS NULL OR NEW.reviewer_user_id IS NULL OR NEW.reviewed_at IS NULL) THEN RAISE EXCEPTION 'An independent AP decision is required'; END IF;
        IF NEW.settlement IS NOT NULL AND NEW.candidate_id IS NULL THEN RAISE EXCEPTION 'Link bank settlement to its accounting candidate'; END IF;
        IF OLD.candidate_id IS NULL AND NEW.candidate_id IS NOT NULL AND (NEW.state<>'APPROVED' OR NOT EXISTS(SELECT 1 FROM finance_operating_postings p WHERE p.book_id=NEW.book_id AND p.candidate_id=NEW.candidate_id AND p.snapshot->>'apDocumentId'=CASE WHEN NEW.kind='REVERSAL' THEN NEW.data->'details'->>'originalId' ELSE NEW.id::text END))
          THEN RAISE EXCEPTION 'The accounting candidate must belong to this AP document and book'; END IF;
        RETURN NEW;
      END $ap$;
      CREATE TRIGGER protect_ap_document BEFORE UPDATE OR DELETE ON finance_ap_records FOR EACH ROW EXECUTE FUNCTION finance_ap_preserve();
      CREATE TRIGGER protect_ap_movement BEFORE UPDATE OR DELETE ON finance_ap_movements FOR EACH ROW EXECUTE FUNCTION finance_ap_preserve();
      CREATE TRIGGER protect_ap_quantity BEFORE UPDATE OR DELETE ON finance_ap_order_quantities FOR EACH ROW EXECUTE FUNCTION finance_ap_preserve();
      CREATE TRIGGER protect_ap_batch BEFORE UPDATE OR DELETE ON finance_ap_batch_items FOR EACH ROW EXECUTE FUNCTION finance_ap_preserve();
      CREATE TRIGGER protect_ap_history BEFORE UPDATE OR DELETE ON finance_ap_events FOR EACH ROW EXECUTE FUNCTION finance_ap_preserve();
      CREATE VIEW finance_ap_status AS
        SELECT d.*, j.id journal_id,j.journal_no,j.accounting_date posted_date,
          CASE WHEN d.state='CANCELLED' THEN 'CANCELLED' WHEN j.id IS NOT NULL THEN 'POSTED' WHEN d.candidate_id IS NOT NULL AND ar.state='REJECTED_INACTIVE' THEN 'GL_REJECTED'
               WHEN d.candidate_id IS NOT NULL THEN 'AWAITING_GL' ELSE d.state END status
        FROM finance_ap_records d LEFT JOIN finance_foundation_journals j ON j.book_id=d.book_id AND j.candidate_id=d.candidate_id AND j.mode='LIVE'
        LEFT JOIN LATERAL (SELECT state FROM finance_approval_requests r WHERE r.candidate_id=d.candidate_id
          ORDER BY expires_at DESC,id DESC LIMIT 1) ar ON true;
    `);
  }
  async down(q: QueryRunner) {
    const [used] = await q.query(
      'SELECT EXISTS(SELECT 1 FROM finance_ap_records) AS used',
    );
    if (used.used)
      throw new Error(
        'Preserve AP transactions before rolling back this migration.',
      );
    await q.query(`DROP VIEW finance_ap_status;
      DROP TABLE finance_ap_events,finance_ap_batch_items,finance_ap_order_quantities,finance_ap_movements,finance_ap_records;
      DROP FUNCTION finance_ap_preserve();
      ALTER TABLE finance_gl_bank_settlements DROP CONSTRAINT finance_gl_bank_settlements_source_type_check;
      ALTER TABLE finance_gl_bank_settlements ADD CONSTRAINT finance_gl_bank_settlements_source_type_check CHECK(source_type IN ('REFUND','COMMISSION_PAYMENT'))`);
  }
}
