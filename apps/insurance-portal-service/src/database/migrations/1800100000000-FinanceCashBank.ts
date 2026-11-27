import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceCashBank1800100000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE finance_cb_documents (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
        company_id uuid NOT NULL REFERENCES companies(id), book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        kind text NOT NULL, reference text NOT NULL, day date NOT NULL, input jsonb NOT NULL,
        request_key text NOT NULL, request_hash text NOT NULL, maker_id uuid NOT NULL, maker_person uuid NOT NULL,
        reviewer_id uuid, reviewer_person uuid, reason text, reviewed_at timestamptz,
        state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','POSTED','REJECTED','CANCELLED')),
        candidate_id uuid UNIQUE REFERENCES finance_journal_candidates(id), journal_id uuid UNIQUE REFERENCES finance_foundation_journals(id),
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(book_id,request_key), UNIQUE(book_id,id),
        CHECK(maker_id IS DISTINCT FROM reviewer_id AND maker_person IS DISTINCT FROM reviewer_person)
      );
      CREATE UNIQUE INDEX finance_cb_active_reference ON finance_cb_documents(book_id,kind,upper(reference)) WHERE state NOT IN ('REJECTED','CANCELLED');
      CREATE UNIQUE INDEX finance_cb_variance_once ON finance_cb_documents(book_id,((input->'fields')->>'target')) WHERE kind IN ('SHORTAGE','OVERAGE') AND state NOT IN ('REJECTED','CANCELLED');
      CREATE UNIQUE INDEX finance_cb_eft_once ON finance_cb_documents(book_id,((input->'fields')->>'target')) WHERE kind IN ('EFT_CANCEL','EFT_SETTLE','EFT_LINK') AND state NOT IN ('REJECTED','CANCELLED');
      CREATE UNIQUE INDEX finance_cb_eft_payable_once ON finance_cb_documents(book_id,((input->'fields')->>'entry')) WHERE kind='EFT_LINK' AND state NOT IN ('REJECTED','CANCELLED');
      CREATE UNIQUE INDEX finance_cb_correction_once ON finance_cb_documents(book_id,((input->'fields')->>'target')) WHERE kind IN ('REVERSE','STOP','VOID','DISHONOUR') AND state NOT IN ('REJECTED','CANCELLED');
      CREATE TABLE finance_cb_accounts (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id), book_id uuid NOT NULL REFERENCES finance_accounting_books(id), code text NOT NULL,
        name text NOT NULL, kind text NOT NULL CHECK(kind IN ('BANK','TILL','WALLET')), currency text NOT NULL, role text NOT NULL, account_code text NOT NULL,
        branch uuid NOT NULL, institution uuid REFERENCES finance_cb_documents(id), office uuid REFERENCES finance_cb_documents(id),
        account_number text, purpose text NOT NULL, manager_id uuid, starts date NOT NULL, opening numeric(38,12) NOT NULL,
        certificate uuid NOT NULL REFERENCES finance_foundation_documents(id), maximum_float numeric(38,12), payment_limit numeric(38,12), minimum_alert numeric(38,12),
        active boolean NOT NULL DEFAULT true, UNIQUE(book_id,code), UNIQUE(book_id,account_code), UNIQUE(book_id,id)
      );
      CREATE UNIQUE INDEX finance_cb_bank_number ON finance_cb_accounts(book_id,institution,account_number) WHERE account_number IS NOT NULL;
      CREATE TABLE finance_cb_masters (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id), book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        code text NOT NULL, kind text NOT NULL CHECK(kind IN ('BANK','OFFICE')), name text NOT NULL, branch uuid,
        branch_name text, swift text, active boolean NOT NULL DEFAULT true, decision_id uuid NOT NULL REFERENCES finance_cb_documents(id)
      );
      CREATE TABLE finance_cb_cashiers (
        account_id uuid NOT NULL REFERENCES finance_cb_accounts(id), user_id uuid NOT NULL, active boolean NOT NULL,
        decision_id uuid NOT NULL REFERENCES finance_cb_documents(id), PRIMARY KEY(account_id,user_id)
      );
      CREATE TABLE finance_cb_shifts (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id), account_id uuid NOT NULL REFERENCES finance_cb_accounts(id), cashier uuid NOT NULL,
        day date NOT NULL, opening numeric(38,12) NOT NULL, closing numeric(38,12), close_id uuid UNIQUE REFERENCES finance_cb_documents(id)
      );
      CREATE UNIQUE INDEX finance_cb_open_shift ON finance_cb_shifts(account_id) WHERE close_id IS NULL;
      CREATE UNIQUE INDEX finance_cb_cashier_shift ON finance_cb_shifts(cashier) WHERE close_id IS NULL;
      ALTER TABLE finance_cb_documents ADD shift_id uuid REFERENCES finance_cb_shifts(id);
      CREATE TABLE finance_cb_receipt_shifts (
        receipt_id uuid NOT NULL REFERENCES receipts(id),source_type text NOT NULL CHECK(source_type IN ('RECEIPT','RECEIPT_REVERSAL')),
        shift_id uuid NOT NULL REFERENCES finance_cb_shifts(id),amount numeric(38,12) NOT NULL,
        journal_id uuid REFERENCES finance_foundation_journals(id),PRIMARY KEY(receipt_id,source_type)
      );
      CREATE TABLE finance_cb_counts (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id),shift_id uuid NOT NULL REFERENCES finance_cb_shifts(id),
        expected numeric(38,12) NOT NULL, counted numeric(38,12) NOT NULL
      );
      CREATE TABLE finance_cb_entries (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), account_id uuid NOT NULL REFERENCES finance_cb_accounts(id),
        journal_id uuid, line_key text, shift_id uuid REFERENCES finance_cb_shifts(id), offset_id uuid REFERENCES finance_cb_documents(id), day date NOT NULL,
        reference text NOT NULL, amount numeric(38,12) NOT NULL CHECK(amount<>0), cutover boolean NOT NULL DEFAULT false,
        UNIQUE(journal_id,line_key), FOREIGN KEY(journal_id,line_key) REFERENCES finance_foundation_lines(journal_id,line_key),
        CHECK(cutover=(journal_id IS NULL) AND cutover=(line_key IS NULL))
      );
      CREATE INDEX finance_cb_entry_date ON finance_cb_entries(account_id,day);
      CREATE TABLE finance_cb_transfers (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id),source uuid NOT NULL REFERENCES finance_cb_accounts(id),
        destination uuid NOT NULL REFERENCES finance_cb_accounts(id), amount numeric(38,12) NOT NULL CHECK(amount>0), transit_role text NOT NULL,
        destination_amount numeric(38,12) NOT NULL CHECK(destination_amount>0),
        received_id uuid UNIQUE REFERENCES finance_cb_documents(id), fx_difference numeric(38,12) NOT NULL DEFAULT 0,
        fx_id uuid UNIQUE REFERENCES finance_cb_documents(id), CHECK(source<>destination)
      );
      CREATE TABLE finance_cb_chequebooks (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id), account_id uuid NOT NULL REFERENCES finance_cb_accounts(id),
        first_serial bigint NOT NULL, last_serial bigint NOT NULL CHECK(last_serial>=first_serial)
      );
      CREATE TABLE finance_cb_cheques (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id), book_id uuid NOT NULL REFERENCES finance_cb_chequebooks(id),
        serial bigint NOT NULL, state text NOT NULL CHECK(state IN ('ISSUED','PRESENTED','CLEARED','STOPPED','CANCELLED','DISHONOURED')),
        UNIQUE(book_id,serial)
      );
      CREATE TABLE finance_cb_statements (
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id), account_id uuid NOT NULL REFERENCES finance_cb_accounts(id),
        starts date NOT NULL, ends date NOT NULL CHECK(ends>=starts), opening numeric(38,12) NOT NULL, closing numeric(38,12) NOT NULL,
        digest text NOT NULL, source_batch uuid, signoff_id uuid UNIQUE REFERENCES finance_cb_documents(id), summary jsonb,
        UNIQUE(account_id,digest), UNIQUE(account_id,starts), UNIQUE(source_batch)
      );
      CREATE TABLE finance_cb_statement_lines (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),statement_id uuid NOT NULL REFERENCES finance_cb_statements(id),
        ordinal integer NOT NULL, day date NOT NULL, reference text NOT NULL, description text NOT NULL, amount numeric(38,12) NOT NULL CHECK(amount<>0),
        suggested_kind text,suggested_role text, UNIQUE(statement_id,ordinal)
      );
      CREATE TABLE finance_cb_rules (
        account_id uuid NOT NULL REFERENCES finance_cb_accounts(id), pattern text NOT NULL, incoming boolean NOT NULL,
        kind text NOT NULL CHECK(kind IN ('FEE','INTEREST')),role text NOT NULL,decision_id uuid NOT NULL REFERENCES finance_cb_documents(id),
        PRIMARY KEY(account_id,pattern,incoming)
      );
      CREATE TABLE finance_cb_matches (
        line_id uuid PRIMARY KEY REFERENCES finance_cb_statement_lines(id),entry_id uuid UNIQUE NOT NULL REFERENCES finance_cb_entries(id),
        decision_id uuid NOT NULL REFERENCES finance_cb_documents(id)
      );
      CREATE TABLE finance_cb_timing (
        entry_id uuid PRIMARY KEY REFERENCES finance_cb_entries(id),decision_id uuid NOT NULL REFERENCES finance_cb_documents(id)
      );
      CREATE VIEW finance_cb_balances AS SELECT a.*,a.opening+coalesce(m.delta,0) balance
        FROM finance_cb_accounts a LEFT JOIN LATERAL(SELECT sum(e.amount) delta FROM finance_cb_entries e WHERE e.account_id=a.id AND NOT e.cutover)m ON true;
      CREATE FUNCTION finance_cb_receipt_custody() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE a finance_cb_accounts; s finance_cb_shifts; action text; who uuid; on_day date; zone text; primary_book uuid; held numeric; total numeric;
      BEGIN
        IF TG_OP='UPDATE' AND (NEW.status<>'REVERSED' OR OLD.status='REVERSED') THEN RETURN NEW; END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_cb_accounts ca JOIN finance_cb_documents d ON d.id=ca.id WHERE d.company_id=NEW.company_id AND ca.account_code=NEW.settlement_account_code AND ca.kind='TILL') THEN RETURN NEW; END IF;
        SELECT book_id,timezone INTO primary_book,zone FROM finance_fin01_primary(NEW.company_id);
        SELECT ca.* INTO a FROM finance_cb_accounts ca WHERE ca.book_id=primary_book AND ca.account_code=NEW.settlement_account_code AND ca.kind='TILL' FOR UPDATE OF ca;
        IF NOT FOUND THEN RETURN NEW; END IF;
        IF NOT a.active THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='Choose an active till for this receipt.'; END IF;
        IF NEW.status='REVERSED' THEN action:='RECEIPT_REVERSAL';who:=NEW.reversed_by;on_day:=(NEW.reversed_at AT TIME ZONE zone)::date;
        ELSE action:='RECEIPT';who:=NEW.posted_by;on_day:=(NEW.received_at AT TIME ZONE zone)::date; END IF;
        SELECT * INTO s FROM finance_cb_shifts WHERE account_id=a.id AND cashier=who AND close_id IS NULL AND day=on_day FOR UPDATE;
        IF NOT FOUND OR a.currency<>NEW.currency THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='Open the assigned cashier shift in the receipt currency before recording this receipt.'; END IF;
        SELECT balance INTO total FROM finance_cb_balances WHERE id=a.id;
        SELECT coalesce(sum(CASE WHEN action='RECEIPT' THEN greatest(x.amount,0) ELSE least(x.amount,0) END),0) INTO held FROM finance_cb_receipt_shifts x WHERE x.shift_id=s.id AND x.journal_id IS NULL;
        IF (action='RECEIPT' AND total+held+NEW.amount>a.maximum_float) OR (action='RECEIPT_REVERSAL' AND total+held<NEW.amount) THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='This receipt exceeds the available till capacity.'; END IF;
        INSERT INTO finance_cb_receipt_shifts(receipt_id,source_type,shift_id,amount) VALUES(NEW.id,action,s.id,CASE WHEN action='RECEIPT' THEN NEW.amount ELSE -NEW.amount END);
        RETURN NEW;
      END $$;
      CREATE TRIGGER finance_cb_receipt_capture AFTER INSERT OR UPDATE OF status ON receipts FOR EACH ROW EXECUTE FUNCTION finance_cb_receipt_custody();
      CREATE FUNCTION finance_cb_register_line() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE a finance_cb_accounts; j finance_foundation_journals; s finance_cb_shifts; delta numeric; balance_now numeric;
              doc finance_cb_documents; op finance_operating_postings; ref text;
      BEGIN
        SELECT * INTO a FROM finance_cb_accounts WHERE book_id=NEW.book_id AND account_code=NEW.account_code FOR UPDATE;
        IF NOT FOUND THEN RETURN NEW; END IF;
        SELECT * INTO STRICT j FROM finance_foundation_journals WHERE id=NEW.journal_id;
        IF j.mode<>'LIVE' THEN RETURN NEW; END IF;
        SELECT * INTO op FROM finance_operating_postings WHERE candidate_id=j.candidate_id;
        IF a.currency<>j.functional_currency AND j.transaction_currency=j.functional_currency AND
          (op.snapshot->>'programKind'='REVALUATION' OR op.snapshot->>'component'='REVALUATION') THEN RETURN NEW; END IF;
        IF NOT a.active OR j.accounting_date<a.starts OR EXISTS(SELECT 1 FROM finance_cb_statements WHERE account_id=a.id AND signoff_id IS NOT NULL AND ends>=j.accounting_date)
          THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='This cash account is closed or the posting date is already reconciled.'; END IF;
        SELECT * INTO doc FROM finance_cb_documents WHERE candidate_id=j.candidate_id;
        IF a.currency=j.functional_currency THEN delta:=NEW.functional_debit-NEW.functional_credit;
        ELSIF a.currency=j.transaction_currency THEN delta:=NEW.transaction_debit-NEW.transaction_credit;
        ELSE RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='Use the registered bank account currency.'; END IF;
        IF a.kind='TILL' THEN
          SELECT * INTO s FROM finance_cb_shifts WHERE account_id=a.id AND close_id IS NULL AND day=j.accounting_date FOR UPDATE;
          IF NOT FOUND OR a.branch::text IS DISTINCT FROM NEW.dimensions->>'BRANCH'
            THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='Open the assigned till for this branch and accounting day.'; END IF;
          IF doc.id IS NOT NULL THEN
            IF doc.maker_id<>s.cashier OR doc.shift_id IS DISTINCT FROM s.id THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='The originating cashier shift must remain open.'; END IF;
          ELSIF op.source_type IN ('RECEIPT','RECEIPT_REVERSAL') THEN
            IF NOT EXISTS(SELECT 1 FROM finance_cb_receipt_shifts r WHERE r.receipt_id=op.source_id AND r.source_type=op.source_type AND r.shift_id=s.id AND r.journal_id IS NULL)
              THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='The cashier on the receipt must hold the open till.'; END IF;
            UPDATE finance_cb_receipt_shifts SET journal_id=j.id WHERE receipt_id=op.source_id AND source_type=op.source_type;
          ELSIF NOT EXISTS(SELECT 1 FROM finance_ap_records ap WHERE ap.book_id=a.book_id AND ap.candidate_id=j.candidate_id AND ap.data->'details'->>'tillId'=a.id::text AND ap.settlement->>'shiftId'=s.id::text AND ap.settlement->>'cashier'=s.cashier::text)
            THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='Use a cash desk voucher or a linked receivable or payable for this till.'; END IF;
          IF delta<0 AND abs(delta)>a.payment_limit AND coalesce(doc.kind,op.source_type,'PAYMENT') NOT IN ('DEPOSIT','TRANSFER','REVERSE','SHORTAGE','RECEIPT_REVERSAL') THEN
            RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='Payment exceeds the approved till payment limit.'; END IF;
          SELECT balance+coalesce((SELECT sum(CASE WHEN delta>0 THEN greatest(x.amount,0) ELSE least(x.amount,0) END) FROM finance_cb_receipt_shifts x WHERE x.shift_id=s.id AND x.journal_id IS NULL),0) INTO balance_now FROM finance_cb_balances WHERE id=a.id;
          IF balance_now+delta<0 OR balance_now+delta>a.maximum_float THEN RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='This movement exceeds the approved till float or available cash.'; END IF;
        END IF;
        IF delta=0 THEN RETURN NEW; END IF;
        ref:=coalesce(doc.reference,op.snapshot->>'reference',j.journal_no,j.id::text);
        INSERT INTO finance_cb_entries(account_id,journal_id,line_key,shift_id,day,reference,amount)
        VALUES(a.id,j.id,NEW.line_key,s.id,j.accounting_date,ref,delta);
        RETURN NEW;
      END $$;
      CREATE TRIGGER finance_cb_capture AFTER INSERT ON finance_foundation_lines FOR EACH ROW EXECUTE FUNCTION finance_cb_register_line();
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_cb_documents) THEN RAISE EXCEPTION 'Reconcile and archive cash and bank activity before rollback.'; END IF; END $$;
      DROP TRIGGER finance_cb_capture ON finance_foundation_lines; DROP FUNCTION finance_cb_register_line(); DROP VIEW finance_cb_balances;
      DROP TRIGGER finance_cb_receipt_capture ON receipts; DROP FUNCTION finance_cb_receipt_custody(); DROP TABLE finance_cb_receipt_shifts;
      ALTER TABLE finance_cb_documents DROP COLUMN shift_id;
      DROP TABLE finance_cb_masters,finance_cb_rules,finance_cb_timing,finance_cb_matches,finance_cb_statement_lines,finance_cb_statements,finance_cb_cheques,finance_cb_chequebooks,finance_cb_transfers,finance_cb_entries,finance_cb_counts,finance_cb_shifts,finance_cb_cashiers,finance_cb_accounts,finance_cb_documents;`);
  }
}
