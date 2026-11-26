import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceReceivableAssetControls1799700000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE finance_ar_opening_items (
        invoice_id uuid PRIMARY KEY REFERENCES invoices(id) DEFERRABLE INITIALLY DEFERRED,
        import_id uuid NOT NULL REFERENCES finance_ar_documents(id), company_id uuid NOT NULL REFERENCES companies(id),
        customer_id uuid NOT NULL REFERENCES customers(id), reference text NOT NULL, currency text NOT NULL,
        invoice_date date NOT NULL, due_date date NOT NULL, cutoff date NOT NULL,
        outstanding numeric(20,4) NOT NULL CHECK(outstanding>0),
        void_id uuid REFERENCES finance_ar_documents(id), CHECK(invoice_date<=cutoff AND invoice_date<=due_date)
      );
      CREATE UNIQUE INDEX finance_ar_opening_ref ON finance_ar_opening_items(company_id,customer_id,upper(reference)) WHERE void_id IS NULL;
      CREATE INDEX finance_ar_opening_batch ON finance_ar_opening_items(import_id);
      CREATE FUNCTION finance_ar_credit_release() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE setup finance_operating_setups; issue_day date;
      BEGIN
        IF NEW.source_type='AR_OPENING' OR NEW.status NOT IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID') OR
           (TG_OP='UPDATE' AND OLD.status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID')) THEN RETURN NEW; END IF;
        setup:=finance_fin01_primary(NEW.company_id);
        issue_day:=(coalesce(NEW.issued_at,statement_timestamp()) AT TIME ZONE setup.timezone)::date;
        IF NEW.due_date>issue_day AND NOT EXISTS (SELECT 1 FROM finance_ar_documents p WHERE p.book_id=setup.book_id
          AND p.kind='POLICY' AND p.state='APPROVED' AND p.currency=NEW.currency AND p.effective_date<=issue_day)
          THEN RAISE EXCEPTION USING ERRCODE='P0401', MESSAGE='Approve an effective receivables policy for this currency before issuing an invoice on credit.'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin03_ar_credit_release BEFORE INSERT OR UPDATE OF status ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_credit_release();
      DROP TRIGGER fin04_credit ON invoices;
      CREATE TRIGGER fin04_credit_insert BEFORE INSERT ON invoices FOR EACH ROW WHEN (NEW.source_type IS DISTINCT FROM 'AR_OPENING') EXECUTE FUNCTION finance_ar_invoice_guard();
      CREATE TRIGGER fin04_credit_update BEFORE UPDATE OF status,ar_adjustment ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_invoice_guard();

      CREATE FUNCTION finance_ar_opening_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE item finance_ar_opening_items; doc finance_ar_documents; zone text;
      BEGIN
        IF TG_OP='UPDATE' AND OLD.source_type='AR_OPENING' AND NEW.source_type IS DISTINCT FROM OLD.source_type THEN
          RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='The opening invoice source is immutable.'; END IF;
        IF NEW.source_type IS DISTINCT FROM 'AR_OPENING' THEN RETURN NEW; END IF;
        SELECT * INTO item FROM finance_ar_opening_items WHERE invoice_id=NEW.id;
        SELECT * INTO doc FROM finance_ar_documents WHERE id=item.import_id;
        IF item.invoice_id IS NULL OR doc.kind<>'OPENING_IMPORT' OR
          (NEW.company_id,NEW.customer_id,NEW.currency,NEW.total_amount,NEW.source_record_id)
          IS DISTINCT FROM (item.company_id,item.customer_id,item.currency,item.outstanding,item.import_id)
          THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Opening invoices require their independently reviewed import.'; END IF;
        IF TG_OP='INSERT' THEN
          IF doc.state<>'APPROVED' OR doc.reviewer_person IS NULL OR NEW.status<>'ISSUED' OR NEW.balance_amount<>item.outstanding
            THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Invalid opening invoice approval or balance.'; END IF;
          SELECT timezone INTO STRICT zone FROM finance_operating_setups WHERE book_id=doc.book_id AND withdrawn_at IS NULL;
          NEW.issued_at:=item.cutoff::timestamp AT TIME ZONE zone; NEW.due_date:=item.due_date;
        ELSE
          IF NEW.status='ISSUED' AND OLD.status IN ('PAID','PARTIALLY_PAID','OVERPAID') THEN NEW.due_date:=item.due_date; END IF;
          IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
             (NEW.status='VOIDED' AND item.void_id IS NULL) THEN
             RAISE EXCEPTION USING ERRCODE='P0401', MESSAGE='Correct the imported invoice through an approved opening correction.'; END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin05_ar_opening_invoice BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_opening_invoice();

      ALTER FUNCTION finance_ar_activity(uuid,text) RENAME TO finance_ar_native_activity;
      CREATE FUNCTION finance_ar_activity(co uuid,zone text) RETURNS TABLE(customer_id uuid,currency text,invoice_id uuid,day date,source uuid,kind text,reference text,invoice_delta numeric,net numeric)
      LANGUAGE sql STABLE AS $$
        SELECT a.customer_id,a.currency,a.invoice_id,a.day,a.source,
          CASE WHEN o.invoice_id IS NOT NULL AND a.kind IN ('INVOICE','VOID') THEN 'OPENING_'||a.kind ELSE a.kind END,
          CASE WHEN o.invoice_id IS NOT NULL AND a.kind IN ('INVOICE','VOID','ALLOCATION','ALLOCATION_REVERSAL') THEN o.reference ELSE a.reference END,
          a.invoice_delta,a.net FROM finance_ar_native_activity(co,zone) a LEFT JOIN finance_ar_opening_items o ON o.invoice_id=a.invoice_id
      $$;

      CREATE FUNCTION finance_fa_class_status(book uuid,cutoff date) RETURNS TABLE(
        request_key text,category text,reference text,effective_date date,total int,posted int,state text,outstanding text[])
      LANGUAGE sql STABLE AS $$
        WITH members AS (SELECT r.request_key,d.plan->'asset'->>'category' category,d.reference,d.effective_date,d.code,
          CASE WHEN d.state='POSTED' AND EXISTS(SELECT 1 FROM finance_fa_documents v WHERE v.reversal_of=d.id AND v.state='POSTED' AND v.effective_date<=cutoff)
               THEN 'REVERSED' ELSE d.state END decision
          FROM finance_fa_runs r CROSS JOIN LATERAL unnest(r.document_ids) x(id) JOIN finance_fa_documents d ON d.id=x.id
          WHERE r.book_id=book AND d.kind='REVALUE' AND d.effective_date<=cutoff),
        totals AS (SELECT m.request_key,m.category,m.reference,m.effective_date,count(*)::int total,
          count(*) FILTER(WHERE decision='POSTED')::int posted,count(*) FILTER(WHERE decision IN ('PENDING','APPROVED')) pending,
          coalesce(array_agg(code ORDER BY code) FILTER(WHERE decision<>'POSTED'),'{}') outstanding
          FROM members m GROUP BY m.request_key,m.category,m.reference,m.effective_date)
        SELECT t.request_key,t.category,t.reference,t.effective_date,t.total,t.posted,
          CASE WHEN t.posted=t.total THEN 'COMPLETE' WHEN t.posted>0 THEN 'PARTIAL'
            WHEN t.pending>0 THEN 'IN_REVIEW' ELSE 'WITHDRAWN' END,t.outstanding FROM totals t
      $$;
      CREATE FUNCTION finance_fa_before_close() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE run record;
      BEGIN
        IF NEW.mode='LIVE' AND NEW.period_kind='REGULAR' AND NEW.state='CLOSED' AND OLD.state<>'CLOSED' THEN
          SELECT * INTO run FROM finance_fa_class_status(NEW.book_id,NEW.ends_before-1)
            WHERE state IN ('PARTIAL','IN_REVIEW') ORDER BY effective_date,reference LIMIT 1;
          IF FOUND THEN RAISE EXCEPTION USING ERRCODE='P0401', MESSAGE=format('Complete or withdraw class valuation %s (%s): %s of %s assets posted.',run.reference,run.category,run.posted,run.total); END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER finance_fa_before_close BEFORE UPDATE OF state ON finance_foundation_periods FOR EACH ROW EXECUTE FUNCTION finance_fa_before_close();
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_ar_documents WHERE kind IN ('OPENING_IMPORT','OPENING_VOID'))
        OR EXISTS(SELECT 1 FROM finance_fa_documents WHERE kind IN ('CAPITAL_ADDITION','RECLASSIFY') OR plan->'asset'->'lease' ? 'usefulLifeEnd')
        THEN RAISE EXCEPTION 'Reconcile the affected receivable and asset documents before rollback.'; END IF; END $$;
      DROP TRIGGER finance_fa_before_close ON finance_foundation_periods; DROP FUNCTION finance_fa_before_close(),finance_fa_class_status(uuid,date);
      DROP FUNCTION finance_ar_activity(uuid,text); ALTER FUNCTION finance_ar_native_activity(uuid,text) RENAME TO finance_ar_activity;
      DROP TRIGGER fin05_ar_opening_invoice ON invoices; DROP FUNCTION finance_ar_opening_invoice();
      DROP TRIGGER fin03_ar_credit_release ON invoices; DROP FUNCTION finance_ar_credit_release();
      DROP TRIGGER fin04_credit_insert ON invoices; DROP TRIGGER fin04_credit_update ON invoices;
      CREATE TRIGGER fin04_credit BEFORE INSERT OR UPDATE OF status,ar_adjustment ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_invoice_guard();
      DROP TABLE finance_ar_opening_items;`);
  }
}
