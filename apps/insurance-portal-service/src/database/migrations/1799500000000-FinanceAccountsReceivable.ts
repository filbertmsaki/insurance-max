import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceAccountsReceivable1799500000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE finance_ar_documents (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),
        sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
        book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        company_id uuid NOT NULL REFERENCES companies(id), kind text NOT NULL,
        reference text NOT NULL, request_key text NOT NULL, request_hash text NOT NULL,
        customer_id uuid REFERENCES customers(id), invoice_id uuid REFERENCES invoices(id),
        receipt_id uuid REFERENCES receipts(id), related_id uuid REFERENCES finance_ar_documents(id),
        currency text NOT NULL, amount numeric(20,4) NOT NULL CHECK(amount>=0),
        effective_date date NOT NULL, data jsonb NOT NULL, maker_id uuid NOT NULL, maker_person uuid NOT NULL,
        state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','REJECTED','CANCELLED','POSTED')),
        reviewer_id uuid, reviewer_person uuid, review_reason text, reviewed_at timestamptz,
        candidate_id uuid UNIQUE REFERENCES finance_journal_candidates(id), journal_id uuid UNIQUE REFERENCES finance_foundation_journals(id),
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(book_id,request_key),
        CHECK(maker_id IS DISTINCT FROM reviewer_id AND maker_person IS DISTINCT FROM reviewer_person)
      );
      CREATE INDEX finance_ar_customer ON finance_ar_documents(company_id,customer_id,currency,kind,effective_date DESC);
      CREATE INDEX finance_ar_source ON finance_ar_documents(related_id,kind,state);
      CREATE UNIQUE INDEX finance_ar_note_source ON finance_ar_documents(company_id,upper(reference))
        WHERE kind IN ('DEBIT_NOTE','CREDIT_NOTE') AND state NOT IN ('REJECTED','CANCELLED');
      CREATE TABLE finance_ar_movements (
        document_id uuid NOT NULL REFERENCES finance_ar_documents(id), invoice_id uuid NOT NULL REFERENCES invoices(id),
        amount numeric(20,4) NOT NULL, PRIMARY KEY(document_id,invoice_id)
      );
      CREATE TABLE finance_ar_premium_memos (
        id uuid PRIMARY KEY REFERENCES finance_ar_documents(id), book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        invoice_id uuid NOT NULL REFERENCES invoices(id), accounting_date date NOT NULL, subject_hash text NOT NULL,payload jsonb NOT NULL
      );
      ALTER TABLE finance_gl_bank_settlements DROP CONSTRAINT finance_gl_bank_settlements_source_type_check,
        ADD CONSTRAINT finance_gl_bank_settlements_source_type_check CHECK(source_type IN ('REFUND','COMMISSION_PAYMENT','AP_PAYMENT','AP_IMPREST_RETURN','AP_REVERSAL','AP_SUPPLIER_REFUND','AR_CREDIT_REFUND'));
      CREATE TABLE finance_ar_measurement_memos(measurement_id uuid NOT NULL REFERENCES finance_gl_insurance_measurements(id),
        memo_id uuid NOT NULL REFERENCES finance_ar_premium_memos(id),PRIMARY KEY(measurement_id,memo_id));
      CREATE TABLE finance_ar_collection_events (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), company_id uuid NOT NULL REFERENCES companies(id),
        book_id uuid NOT NULL REFERENCES finance_accounting_books(id), invoice_id uuid NOT NULL REFERENCES invoices(id),
        kind text NOT NULL, owner_id uuid NOT NULL REFERENCES users(id), follow_up date, promise_amount numeric(20,4),
        note text NOT NULL, actor_id uuid NOT NULL, request_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(book_id,request_key)
      );
      CREATE INDEX finance_ar_case_history ON finance_ar_collection_events(book_id,invoice_id,created_at DESC,id);
      CREATE TABLE finance_ar_reminders (
        invoice_id uuid NOT NULL REFERENCES invoices(id), stage int NOT NULL, book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        notification_id uuid NOT NULL REFERENCES portal_notifications(id), sent_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(invoice_id,stage)
      );
      ALTER TABLE invoices ADD COLUMN ar_adjustment numeric(20,4) NOT NULL DEFAULT 0;
      ALTER TABLE receipts ADD COLUMN ar_cash_refunded numeric(20,4) NOT NULL DEFAULT 0;
      UPDATE receipts r SET ar_cash_refunded=x.amount,unallocated_amount=greatest(r.amount-r.allocated_amount-x.amount,0)
      FROM (SELECT receipt_id,sum(amount) amount FROM finance_refunds WHERE invoice_id IS NULL AND status='PAID' GROUP BY receipt_id) x WHERE r.id=x.receipt_id;
      CREATE FUNCTION finance_ar_activity(co uuid, zone text) RETURNS TABLE(
        customer_id uuid,currency text,invoice_id uuid,day date,source uuid,kind text,reference text,invoice_delta numeric,net numeric) LANGUAGE sql STABLE AS $$
        WITH bills AS (SELECT * FROM invoices WHERE company_id=co AND deleted_at IS NULL
          AND (issued_at IS NOT NULL OR status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID') OR posted_at IS NOT NULL)),
        cash AS (SELECT * FROM receipts WHERE company_id=co AND deleted_at IS NULL AND
          (posted_at IS NOT NULL OR status IN ('POSTED','PARTIALLY_ALLOCATED','FULLY_ALLOCATED','REVERSED'))),
        allocations AS (SELECT a.*,i.customer_id debtor,coalesce(r.payer_customer_id,r.customer_id) payer,i.invoice_no
          FROM receipt_allocations a JOIN bills i ON i.id=a.invoice_id JOIN cash r ON r.id=a.receipt_id WHERE a.company_id=co)
        SELECT customer_id,currency,id,(coalesce(issued_at,posted_at,created_at) AT TIME ZONE zone)::date,id,'INVOICE',invoice_no,total_amount,total_amount FROM bills
        UNION ALL SELECT customer_id,currency,id,(voided_at AT TIME ZONE zone)::date,id,'VOID',invoice_no,-total_amount,-total_amount FROM bills WHERE voided_at IS NOT NULL
        UNION ALL SELECT coalesce(payer_customer_id,customer_id),currency,NULL,(coalesce(posted_at,received_at,created_at) AT TIME ZONE zone)::date,id,'RECEIPT',receipt_no,0,-amount FROM cash
        UNION ALL SELECT coalesce(payer_customer_id,customer_id),currency,NULL,(reversed_at AT TIME ZONE zone)::date,id,'RECEIPT_REVERSAL',receipt_no,0,amount FROM cash WHERE reversed_at IS NOT NULL
        UNION ALL SELECT a.debtor,a.currency,a.invoice_id,x.day,a.id,x.kind,a.invoice_no,x.amt,CASE WHEN a.payer<>a.debtor THEN x.amt ELSE 0 END
          FROM allocations a CROSS JOIN LATERAL(VALUES((a.allocated_at AT TIME ZONE zone)::date,'ALLOCATION',-a.amount),((a.reversed_at AT TIME ZONE zone)::date,'ALLOCATION_REVERSAL',a.amount))x(day,kind,amt) WHERE x.day IS NOT NULL
        UNION ALL SELECT a.payer,a.currency,NULL,x.day,a.id,x.kind,a.invoice_no,0,x.amt FROM allocations a
          CROSS JOIN LATERAL(VALUES((a.allocated_at AT TIME ZONE zone)::date,'PAYER_TRANSFER',a.amount),((a.reversed_at AT TIME ZONE zone)::date,'TRANSFER_REVERSAL',-a.amount))x(day,kind,amt) WHERE a.payer<>a.debtor AND x.day IS NOT NULL
        UNION ALL SELECT coalesce(i.customer_id,r.payer_customer_id,r.customer_id,f.customer_id),f.currency_code,f.invoice_id,(f.paid_at AT TIME ZONE zone)::date,f.id,'REFUND',f.refund_no,CASE WHEN f.invoice_id IS NULL THEN 0 ELSE f.amount END,f.amount
          FROM finance_refunds f LEFT JOIN bills i ON i.id=f.invoice_id LEFT JOIN cash r ON r.id=f.receipt_id WHERE f.company_id=co AND f.status='PAID'
        UNION ALL SELECT i.customer_id,w.currency,i.id,j.accounting_date,w.id,p.source_type,w.reference,x.n,x.n FROM finance_gl_writeoffs w JOIN bills i ON i.id=w.invoice_id
          JOIN finance_operating_postings p ON p.source_id=w.id AND p.company_id=co AND p.source_type IN ('INVOICE_WRITE_OFF','INVOICE_WRITE_OFF_REVERSAL')
          JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE'
          CROSS JOIN LATERAL(VALUES(CASE p.source_type WHEN 'INVOICE_WRITE_OFF' THEN -w.amount ELSE w.amount END))x(n)
        UNION ALL SELECT d.customer_id,d.currency,v.invoice_id,d.effective_date,d.id,d.kind,'AR-'||d.sequence,v.amount,v.amount FROM finance_ar_movements v
          JOIN finance_ar_documents d ON d.id=v.document_id WHERE d.company_id=co AND d.state='POSTED'
        UNION ALL SELECT d.customer_id,d.currency,NULL,d.effective_date,d.id,d.kind,'AR-'||d.sequence,0,0 FROM finance_ar_documents d
          WHERE d.company_id=co AND d.state='POSTED' AND d.kind IN ('ADVANCE','ADVANCE_APPLICATION','ADVANCE_RELEASE','IMPAIRMENT')
      $$;
      CREATE VIEW finance_ar_advance_movements AS
        SELECT d.id,d.book_id,d.receipt_id,d.currency,d.effective_date,d.state,
          CASE coalesce(o.kind,d.kind) WHEN 'ADVANCE' THEN d.amount ELSE -d.amount END * CASE WHEN o.id IS NULL THEN 1 ELSE -1 END amount,
          d.kind='ADVANCE' OR (d.kind='REVERSAL' AND o.kind='ADVANCE_RELEASE') reserve_cash
        FROM finance_ar_documents d LEFT JOIN finance_ar_documents o ON d.kind='REVERSAL' AND o.id=d.related_id
        WHERE coalesce(o.kind,d.kind) IN ('ADVANCE','ADVANCE_APPLICATION','ADVANCE_RELEASE');
      CREATE FUNCTION finance_ar_free_cash(rid uuid, bill uuid, exclude_refund uuid DEFAULT NULL) RETURNS numeric LANGUAGE sql VOLATILE AS $$
        SELECT CASE WHEN bill IS NULL THEN r.amount-coalesce((SELECT sum(a.amount) FROM receipt_allocations a WHERE a.receipt_id=r.id AND a.status='ACTIVE'),0)
          -coalesce((SELECT sum(amount) FROM finance_ar_advance_movements d WHERE d.receipt_id=r.id AND (d.state='POSTED' OR (d.reserve_cash AND d.state='APPROVED'))),0)
          ELSE coalesce((SELECT sum(a.amount) FROM receipt_allocations a WHERE a.receipt_id=r.id AND a.invoice_id=bill AND a.status='ACTIVE'),0) END
        -coalesce((SELECT sum(f.amount) FROM finance_refunds f WHERE f.receipt_id=r.id AND f.invoice_id IS NOT DISTINCT FROM bill
          AND f.id IS DISTINCT FROM exclude_refund AND f.status IN ('REQUESTED','APPROVED','PAID')),0)
        FROM receipts r WHERE r.id=rid $$;
      CREATE FUNCTION finance_ar_payer(company uuid,payer uuid,debtor uuid,ccy text,on_day date) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT payer=debtor OR coalesce((SELECT (d.data->>'enabled')::boolean FROM finance_ar_documents d
          WHERE d.company_id=company AND d.customer_id=debtor AND d.currency=ccy AND d.kind='PAYER_MANDATE'
          AND d.data->>'payerId'=payer::text AND d.state='APPROVED' AND d.effective_date<=on_day
          ORDER BY d.effective_date DESC,d.sequence DESC LIMIT 1),false) $$;
      CREATE FUNCTION finance_ar_cash_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE r receipts; i invoices; available numeric; day date;
      BEGIN
        IF TG_TABLE_NAME='receipts' THEN
          IF NEW.status IN ('REVERSED','VOIDED') AND OLD.status NOT IN ('REVERSED','VOIDED') AND
            (EXISTS(SELECT 1 FROM finance_refunds WHERE receipt_id=NEW.id AND status IN ('REQUESTED','APPROVED','PAID'))
             OR coalesce((SELECT sum(d.amount) FROM finance_ar_advance_movements d WHERE d.receipt_id=NEW.id AND (d.state='POSTED' OR (d.reserve_cash AND d.state='APPROVED'))),0)>0)
            THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Resolve the refund or customer advance before reversing this receipt.'; END IF;
          RETURN NEW;
        END IF;
        IF NEW.receipt_id IS NULL THEN RETURN NEW; END IF;
        SELECT * INTO STRICT r FROM receipts WHERE id=NEW.receipt_id FOR UPDATE;
        IF TG_TABLE_NAME='finance_refunds' THEN
          IF NEW.status NOT IN ('REQUESTED','APPROVED','PAID') THEN RETURN NEW; END IF;
          IF r.company_id<>NEW.company_id OR r.currency<>NEW.currency_code OR NEW.amount<=0 OR r.status NOT IN ('POSTED','PARTIALLY_ALLOCATED','FULLY_ALLOCATED')
            OR NEW.amount>finance_ar_free_cash(r.id,NEW.invoice_id,NEW.id)
            THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Refund exceeds the available cash for this receipt and invoice.'; END IF;
          RETURN NEW;
        END IF;
        IF NEW.status='ACTIVE' AND (TG_OP='INSERT' OR OLD.status<>'ACTIVE') THEN
          SELECT * INTO STRICT i FROM invoices WHERE id=NEW.invoice_id FOR UPDATE;
          SELECT (NEW.allocated_at AT TIME ZONE s.timezone)::date INTO day FROM finance_operating_setups s WHERE s.company_id=r.company_id AND s.book_role='PRIMARY' AND s.withdrawn_at IS NULL ORDER BY s.activated_at DESC LIMIT 1;
          IF nullif(current_setting('finance.ar_allocation',true),'') IS NOT NULL THEN
            SELECT d.id,d.effective_date::timestamp AT TIME ZONE s.timezone INTO NEW.ar_document_id,NEW.allocated_at FROM finance_ar_documents d
              JOIN finance_operating_setups s ON s.book_id=d.book_id AND s.withdrawn_at IS NULL
              WHERE d.id=current_setting('finance.ar_allocation')::uuid AND d.kind='ADVANCE_APPLICATION' AND d.state='POSTED'
                AND d.receipt_id=r.id AND d.invoice_id=i.id AND d.amount=NEW.amount;
            IF NEW.ar_document_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Invalid advance accounting source.'; END IF;
          END IF;
          IF NEW.ar_document_id IS NULL AND EXISTS(SELECT 1 FROM finance_gl_premium_memos WHERE invoice_id=i.id AND event_type='ISSUED')
             AND r.invoice_id IS DISTINCT FROM i.id THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Apply on-account premium cash through an approved advance.'; END IF;
          IF r.company_id<>i.company_id OR r.company_id<>NEW.company_id OR r.currency<>i.currency OR i.currency<>NEW.currency OR
            NOT finance_ar_payer(r.company_id,coalesce(r.payer_customer_id,r.customer_id),i.customer_id,i.currency,coalesce(day,current_date)) OR
            NEW.amount<=0 OR NEW.amount>finance_ar_free_cash(r.id,NULL) OR NEW.amount>i.balance_amount
            THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='The allocation exceeds available cash or invoice balance, or has no approved payer mandate.'; END IF;
        ELSIF TG_OP='UPDATE' AND OLD.status='ACTIVE' AND NEW.status<>'ACTIVE' AND
          (finance_ar_free_cash(r.id,NEW.invoice_id)<OLD.amount OR EXISTS(SELECT 1 FROM finance_ar_documents d WHERE d.id=OLD.ar_document_id AND d.state='POSTED' AND NOT EXISTS(SELECT 1 FROM finance_ar_documents x WHERE x.related_id=d.id AND x.kind='REVERSAL' AND x.state='POSTED')))
          THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Resolve refunds and the approved application before reversing this allocation.'; END IF;
        RETURN NEW;
      END $$;
      CREATE TABLE finance_ar_allocation_keys(company_id uuid NOT NULL REFERENCES companies(id),request_key text NOT NULL,
        allocation_id uuid NOT NULL UNIQUE REFERENCES receipt_allocations(id),PRIMARY KEY(company_id,request_key));
      ALTER TABLE receipt_allocations ADD COLUMN ar_document_id uuid UNIQUE REFERENCES finance_ar_documents(id);
      CREATE TRIGGER fin04_refund BEFORE INSERT OR UPDATE OF status ON finance_refunds FOR EACH ROW EXECUTE FUNCTION finance_ar_cash_guard();
      CREATE TRIGGER fin04_allocate BEFORE INSERT OR UPDATE OF status ON receipt_allocations FOR EACH ROW EXECUTE FUNCTION finance_ar_cash_guard();
      CREATE TRIGGER fin04_reverse BEFORE UPDATE OF status ON receipts FOR EACH ROW EXECUTE FUNCTION finance_ar_cash_guard();
      CREATE FUNCTION finance_ar_paid_refund() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status='PAID' AND NEW.invoice_id IS NULL AND NEW.receipt_id IS NOT NULL AND (TG_OP='INSERT' OR OLD.status<>'PAID') THEN
          UPDATE receipts SET ar_cash_refunded=ar_cash_refunded+NEW.amount, unallocated_amount=unallocated_amount-NEW.amount WHERE id=NEW.receipt_id;
        END IF; RETURN NEW;
      END $$;
      CREATE TRIGGER fin04_cash_paid AFTER INSERT OR UPDATE OF status ON finance_refunds FOR EACH ROW EXECUTE FUNCTION finance_ar_paid_refund();
      CREATE FUNCTION finance_ar_customer_scope() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE payer uuid;
      BEGIN
        payer:=nullif(to_jsonb(NEW)->>'payer_customer_id','')::uuid;
        IF (NEW.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customers c WHERE c.id=NEW.customer_id AND c.company_id=NEW.company_id AND c.deleted_at IS NULL)) OR
          (payer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customers c WHERE c.id=payer AND c.company_id=NEW.company_id AND c.deleted_at IS NULL)) THEN
          RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='The customer and payer must belong to the transaction company.'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin04_customer_scope BEFORE INSERT OR UPDATE OF company_id,customer_id ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_customer_scope();
      CREATE TRIGGER fin04_customer_scope BEFORE INSERT OR UPDATE OF company_id,customer_id ON payment_transactions FOR EACH ROW EXECUTE FUNCTION finance_ar_customer_scope();
      CREATE TRIGGER fin04_customer_scope BEFORE INSERT OR UPDATE OF company_id,customer_id,payer_customer_id ON receipts FOR EACH ROW EXECUTE FUNCTION finance_ar_customer_scope();
      CREATE FUNCTION finance_ar_invoice_terms() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE term text;
      BEGIN
        IF TG_OP='INSERT' OR (NEW.status='ISSUED' AND OLD.status='DRAFT' AND NEW.payment_term_code IS NOT DISTINCT FROM OLD.payment_term_code) THEN
          SELECT data->>'termCode' INTO term FROM finance_ar_documents d WHERE d.company_id=NEW.company_id AND d.customer_id=NEW.customer_id
            AND d.kind='PROFILE' AND d.currency=NEW.currency AND d.state='APPROVED' AND d.effective_date<=(coalesce(NEW.issued_at,now()) AT TIME ZONE (finance_fin01_primary(NEW.company_id)).timezone)::date
            ORDER BY effective_date DESC,sequence DESC LIMIT 1;
          IF term IS NOT NULL AND (NEW.payment_term_code IS NULL OR TG_OP='UPDATE') THEN NEW.payment_term_code:=term; END IF;
        END IF; RETURN NEW;
      END $$;
      CREATE TRIGGER fin00_ar_terms BEFORE INSERT OR UPDATE OF status ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_invoice_terms();
      CREATE FUNCTION finance_ar_invoice_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE p finance_ar_documents; exposure numeric; day date; issue_day date; zone text; credit_limit numeric;
      BEGIN
        IF NEW.status='VOIDED' AND TG_OP='UPDATE' AND OLD.status<>'VOIDED' AND EXISTS(SELECT 1 FROM finance_ar_movements v JOIN finance_ar_documents d ON d.id=v.document_id WHERE v.invoice_id=NEW.id AND d.kind<>'REVERSAL' AND NOT EXISTS(SELECT 1 FROM finance_ar_documents x WHERE x.related_id=d.id AND x.kind='REVERSAL' AND x.state='POSTED'))
          THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Reverse the linked customer adjustments before voiding this invoice.'; END IF;
        IF NEW.status NOT IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID') OR (TG_OP='UPDATE' AND OLD.status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID') AND (NEW.ar_adjustment<=OLD.ar_adjustment OR NEW.balance_amount<=OLD.balance_amount)) THEN RETURN NEW; END IF;
        SELECT s.timezone INTO zone FROM finance_operating_setups s WHERE s.company_id=NEW.company_id AND s.book_role='PRIMARY' AND s.withdrawn_at IS NULL ORDER BY s.activated_at DESC LIMIT 1;
        issue_day:=(coalesce(NEW.issued_at,now()) AT TIME ZONE coalesce(zone,'UTC'))::date;
        day:=coalesce(nullif(current_setting('finance.ar_effective_date',true),'')::date,issue_day);
        PERFORM 1 FROM customers WHERE id=NEW.customer_id FOR UPDATE;
        SELECT * INTO p FROM finance_ar_documents d WHERE d.company_id=NEW.company_id AND d.customer_id=NEW.customer_id AND d.kind='PROFILE' AND d.state='APPROVED' AND d.currency=NEW.currency AND d.effective_date<=day ORDER BY d.effective_date DESC,d.sequence DESC LIMIT 1;
        IF p.id IS NULL THEN
          IF NEW.due_date>issue_day AND coalesce((SELECT (d.data->>'requireProfile')::boolean FROM finance_ar_documents d WHERE d.company_id=NEW.company_id AND d.kind='POLICY' AND d.currency=NEW.currency AND d.state='APPROVED' AND d.effective_date<=day ORDER BY d.effective_date DESC,d.sequence DESC LIMIT 1),false)
          THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Approve a customer credit profile before issuing invoices on terms.'; END IF;
          RETURN NEW;
        END IF;
        credit_limit:=p.amount;
        IF NEW.due_date=issue_day AND day=issue_day AND credit_limit=0 THEN RETURN NEW; END IF;
        SELECT coalesce(sum(balance_amount),0) INTO exposure FROM invoices WHERE company_id=NEW.company_id AND customer_id=NEW.customer_id AND currency=NEW.currency AND id<>NEW.id AND deleted_at IS NULL AND status IN ('ISSUED','PARTIALLY_PAID');
        IF exposure+NEW.balance_amount>credit_limit THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Issuing this amount would exceed the approved customer credit limit.'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin04_credit BEFORE INSERT OR UPDATE OF status,ar_adjustment ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_invoice_guard();
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_ar_documents) OR EXISTS(SELECT 1 FROM finance_ar_collection_events) OR EXISTS(SELECT 1 FROM finance_ar_reminders) OR EXISTS(SELECT 1 FROM finance_ar_allocation_keys) THEN RAISE EXCEPTION 'Archive and reconcile FIN-04 activity before rollback'; END IF; END $$;
      DROP TRIGGER fin04_customer_scope ON invoices; DROP TRIGGER fin04_customer_scope ON receipts; DROP TRIGGER fin04_customer_scope ON payment_transactions; DROP FUNCTION finance_ar_customer_scope();
      DROP TRIGGER fin00_ar_terms ON invoices; DROP FUNCTION finance_ar_invoice_terms(); DROP TRIGGER fin04_credit ON invoices; DROP TRIGGER fin04_cash_paid ON finance_refunds; DROP TRIGGER fin04_reverse ON receipts;
      DROP TRIGGER fin04_allocate ON receipt_allocations; DROP TRIGGER fin04_refund ON finance_refunds;
      DROP FUNCTION finance_ar_activity(uuid,text),finance_ar_invoice_guard(),finance_ar_paid_refund(),finance_ar_cash_guard(),finance_ar_payer(uuid,uuid,uuid,text,date),finance_ar_free_cash(uuid,uuid,uuid);
      DROP VIEW finance_ar_advance_movements;
      ALTER TABLE receipt_allocations DROP COLUMN ar_document_id; ALTER TABLE invoices DROP COLUMN ar_adjustment; ALTER TABLE receipts DROP COLUMN ar_cash_refunded;
      ALTER TABLE finance_gl_bank_settlements DROP CONSTRAINT finance_gl_bank_settlements_source_type_check,
        ADD CONSTRAINT finance_gl_bank_settlements_source_type_check CHECK(source_type IN ('REFUND','COMMISSION_PAYMENT','AP_PAYMENT','AP_IMPREST_RETURN','AP_REVERSAL','AP_SUPPLIER_REFUND'));
      DROP TABLE finance_ar_measurement_memos,finance_ar_allocation_keys,finance_ar_premium_memos,finance_ar_movements,finance_ar_reminders,finance_ar_collection_events,finance_ar_documents`);
  }
}
