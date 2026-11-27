import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceCashBankControls1800200000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      DROP INDEX finance_cb_active_reference;
      CREATE UNIQUE INDEX finance_cb_active_reference ON finance_cb_documents(book_id,kind,upper(reference)) WHERE kind<>'STATEMENT' AND state NOT IN ('REJECTED','CANCELLED');
      CREATE UNIQUE INDEX finance_cb_pending_statement_reference ON finance_cb_documents(book_id,upper(reference)) WHERE kind='STATEMENT' AND state='PENDING';
      ALTER TABLE finance_cb_statements
        ADD COLUMN withdrawn_id uuid UNIQUE REFERENCES finance_cb_documents(id),
        ADD COLUMN archived_lines jsonb,
        ADD CHECK (withdrawn_id IS NULL OR signoff_id IS NULL),
        DROP CONSTRAINT finance_cb_statements_account_id_digest_key,
        DROP CONSTRAINT finance_cb_statements_account_id_starts_key,
        DROP CONSTRAINT finance_cb_statements_source_batch_key;
      CREATE UNIQUE INDEX finance_cb_live_statement_digest ON finance_cb_statements(account_id,digest) WHERE withdrawn_id IS NULL;
      CREATE UNIQUE INDEX finance_cb_live_statement_start ON finance_cb_statements(account_id,starts) WHERE withdrawn_id IS NULL;
      CREATE UNIQUE INDEX finance_cb_live_statement_batch ON finance_cb_statements(source_batch) WHERE withdrawn_id IS NULL;
      ALTER TABLE finance_cb_matches DROP CONSTRAINT finance_cb_matches_pkey, ADD PRIMARY KEY(line_id,entry_id);
      ALTER TABLE finance_cb_cheques DROP CONSTRAINT finance_cb_cheques_state_check,
        ADD CHECK(state IN ('ISSUED','PRESENTED','CLEARED','STOPPED','CANCELLED','DISHONOURED','LOST','SPOILED'));

      ALTER TABLE finance_cb_documents ADD COLUMN eft_export jsonb;
      CREATE FUNCTION finance_cb_eft_export(eft uuid, as_of timestamptz) RETURNS jsonb LANGUAGE sql STABLE AS $body$
        SELECT jsonb_build_object('instructionId',d.id,'reference',d.reference,'date',d.day,
          'source',a.code,'sourceBank',coalesce(bm.f->>'name',bank.input->'fields'->>'name'),
          'sourceAccountName',coalesce(am.f->>'name',ac.input->'fields'->>'name'),
          'sourceAccountNumber',coalesce(am.f->>'number',ac.input->'fields'->>'number'),
          'currency',a.currency,'amount',d.input->'fields'->>'amount','payee',d.input->'fields'->>'payee',
          'bank',d.input->'fields'->>'bank','beneficiary',d.input->'fields'->>'beneficiary')
        FROM finance_cb_documents d JOIN finance_cb_accounts a ON a.id::text=lower(d.input->'fields'->>'account') AND a.book_id=d.book_id
        JOIN finance_cb_documents ac ON ac.id=a.id JOIN finance_cb_documents bank ON bank.id=a.institution
        LEFT JOIN LATERAL (SELECT x.input->'fields' f FROM finance_cb_documents x WHERE x.book_id=d.book_id AND x.kind='AMEND_ACCOUNT' AND x.state='POSTED'
          AND lower(x.input->'fields'->>'account')=a.id::text AND x.reviewed_at<=as_of ORDER BY x.reviewed_at DESC,x.sequence DESC LIMIT 1) am ON true
        LEFT JOIN LATERAL (SELECT x.input->'fields' f FROM finance_cb_documents x WHERE x.book_id=d.book_id AND x.kind='AMEND_BANK' AND x.state='POSTED'
          AND lower(x.input->'fields'->>'master')=bank.id::text AND x.reviewed_at<=as_of ORDER BY x.reviewed_at DESC,x.sequence DESC LIMIT 1) bm ON true
        WHERE d.id=eft AND d.kind='EFT' AND a.kind='BANK'
      $body$;
      UPDATE finance_cb_documents SET eft_export=finance_cb_eft_export(id,coalesce(reviewed_at,now())) WHERE kind='EFT' AND state IN ('POSTED','PENDING');

      CREATE TABLE finance_cb_ap_proofs(
        id uuid PRIMARY KEY REFERENCES finance_cb_documents(id), book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        eft_id uuid NOT NULL REFERENCES finance_cb_documents(id), voucher_id uuid NOT NULL REFERENCES finance_ap_records(id),
        line_id uuid NOT NULL REFERENCES finance_cb_statement_lines(id), entry_id uuid UNIQUE REFERENCES finance_cb_entries(id),
        released_id uuid UNIQUE REFERENCES finance_cb_documents(id), CHECK(entry_id IS NULL OR released_id IS NULL)
      );
      CREATE UNIQUE INDEX finance_cb_ap_proof_eft ON finance_cb_ap_proofs(eft_id) WHERE released_id IS NULL;
      CREATE UNIQUE INDEX finance_cb_ap_proof_line ON finance_cb_ap_proofs(line_id) WHERE released_id IS NULL;
      CREATE UNIQUE INDEX finance_cb_ap_proof_voucher ON finance_cb_ap_proofs(voucher_id) WHERE released_id IS NULL;
      CREATE FUNCTION finance_cb_match_verified_payment() RETURNS trigger LANGUAGE plpgsql AS $body$
      DECLARE p finance_cb_ap_proofs; l finance_cb_statement_lines; st finance_cb_statements;
      BEGIN
        IF NEW.journal_id IS NULL THEN RETURN NEW; END IF;
        SELECT v.* INTO p FROM finance_cb_ap_proofs v JOIN finance_ap_records ap ON ap.id=v.voucher_id
          JOIN finance_foundation_journals j ON j.candidate_id=ap.candidate_id
          JOIN finance_cb_accounts a ON a.id=NEW.account_id AND a.book_id=v.book_id AND a.account_code=ap.data->>'bankAccount'
          WHERE j.id=NEW.journal_id AND v.released_id IS NULL AND ap.settlement->>'statementProof'=v.id::text FOR UPDATE OF v;
        IF NOT FOUND THEN RETURN NEW; END IF;
        SELECT * INTO STRICT l FROM finance_cb_statement_lines WHERE id=p.line_id;
        SELECT * INTO STRICT st FROM finance_cb_statements WHERE id=l.statement_id FOR UPDATE;
        IF st.withdrawn_id IS NOT NULL OR st.signoff_id IS NOT NULL OR st.account_id<>NEW.account_id OR l.amount<>NEW.amount OR l.day<>NEW.day
          OR EXISTS(SELECT 1 FROM finance_cb_matches WHERE line_id=l.id) THEN
          RAISE EXCEPTION USING ERRCODE='P0601',MESSAGE='The verified statement debit must match the original voucher posting.'; END IF;
        INSERT INTO finance_cb_matches(line_id,entry_id,decision_id) VALUES(l.id,NEW.id,p.id);
        UPDATE finance_cb_ap_proofs SET entry_id=NEW.id WHERE id=p.id;
        RETURN NEW;
      END $body$;
      CREATE TRIGGER finance_cb_match_verified AFTER INSERT ON finance_cb_entries FOR EACH ROW EXECUTE FUNCTION finance_cb_match_verified_payment();

      CREATE INDEX finance_cb_plan_entry_decisions ON finance_cb_documents(book_id,(input->'fields'->>'entry'),day,sequence)
        WHERE kind IN ('LINK_PLAN','UNLINK_PLAN') AND state='POSTED';
      CREATE FUNCTION finance_cb_plan_entries(bid uuid, as_of date)
      RETURNS TABLE(plan_id uuid,entry_id uuid,day date,amount numeric) LANGUAGE sql STABLE AS $body$
        WITH plans AS (SELECT d.*,lower(d.input->'fields'->>'account') account,
          CASE WHEN d.input->'fields'->>'direction'='INFLOW' THEN 1 ELSE -1 END direction
          FROM finance_cb_documents d WHERE d.book_id=bid AND d.kind='PLAN' AND d.state='POSTED' AND d.day<=as_of),
        origin AS (SELECT e.*,j.reversal_of,op.source_type,op.source_id,cd.kind,
          row_number() OVER(PARTITION BY e.journal_id,e.account_id,e.amount ORDER BY e.line_key) line_number
          FROM finance_cb_entries e JOIN finance_cb_accounts a ON a.id=e.account_id
          JOIN finance_foundation_journals j ON j.id=e.journal_id
          LEFT JOIN finance_operating_postings op ON op.candidate_id=j.candidate_id
          LEFT JOIN finance_cb_documents cd ON cd.journal_id=j.id
          WHERE a.book_id=bid AND e.day<=as_of),
        assigned AS (SELECT p.id plan_id,e.* FROM origin e
          LEFT JOIN LATERAL (SELECT x.kind,x.input->'fields'->>'target' target FROM finance_cb_documents x
            WHERE x.book_id=bid AND x.kind IN ('LINK_PLAN','UNLINK_PLAN') AND x.state='POSTED'
              AND lower(x.input->'fields'->>'entry')=e.id::text AND x.day<=as_of ORDER BY x.day DESC,x.sequence DESC LIMIT 1) link ON true
          JOIN plans p ON p.account=e.account_id::text AND p.day<=e.day AND p.direction=sign(e.amount) AND
            (CASE WHEN link.kind IS NULL THEN upper(trim(e.reference))=upper(trim(p.reference)) ELSE link.kind='LINK_PLAN' AND lower(link.target)=p.id::text END)
          WHERE e.reversal_of IS NULL AND coalesce(e.source_type,'')<>'RECEIPT_REVERSAL'
            AND coalesce(e.kind,'') NOT IN ('TRANSFER','WITHDRAW','DEPOSIT','REPLENISH','WALLET_SETTLE','RECEIVE','REVERSE','VOID','STOP','DISHONOUR')
            AND NOT EXISTS(SELECT 1 FROM finance_cb_documents x WHERE x.book_id=bid AND x.kind='CANCEL_PLAN' AND x.state='POSTED' AND x.input->'fields'->>'target'=p.id::text AND x.day<e.day))
        SELECT a.plan_id,a.id,a.day,a.amount FROM assigned a
        UNION ALL SELECT a.plan_id,rev.id,rev.day,rev.amount FROM assigned a JOIN origin rev ON rev.account_id=a.account_id AND rev.amount=-a.amount AND rev.line_number=a.line_number
          AND (rev.reversal_of=a.journal_id OR (a.source_type='RECEIPT' AND rev.source_type='RECEIPT_REVERSAL' AND rev.source_id=a.source_id))
      $body$;
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`
      DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_cb_documents WHERE kind IN ('WITHDRAW_STATEMENT','GROUP_MATCH','RETIRE_LEAF','EFT_VERIFY','EFT_RELEASE','LINK_PLAN','UNLINK_PLAN'))
        OR EXISTS(SELECT 1 FROM finance_cb_statements WHERE withdrawn_id IS NOT NULL)
        OR EXISTS(SELECT 1 FROM finance_cb_documents WHERE kind='STATEMENT' AND input->'fields'->>'replaces' IS NOT NULL)
        OR EXISTS(SELECT 1 FROM finance_cb_documents WHERE kind='EFT' AND state='POSTED' AND eft_export IS DISTINCT FROM finance_cb_eft_export(id,now()))
        THEN RAISE EXCEPTION 'Cash and bank control history requires this migration.'; END IF; END $$;
      DROP INDEX finance_cb_active_reference,finance_cb_pending_statement_reference;
      CREATE UNIQUE INDEX finance_cb_active_reference ON finance_cb_documents(book_id,kind,upper(reference)) WHERE state NOT IN ('REJECTED','CANCELLED');
      DROP FUNCTION finance_cb_plan_entries(uuid,date); DROP INDEX finance_cb_plan_entry_decisions;
      DROP TRIGGER finance_cb_match_verified ON finance_cb_entries; DROP FUNCTION finance_cb_match_verified_payment(); DROP TABLE finance_cb_ap_proofs;
      DROP FUNCTION finance_cb_eft_export(uuid,timestamptz); ALTER TABLE finance_cb_documents DROP COLUMN eft_export;
      ALTER TABLE finance_cb_cheques DROP CONSTRAINT finance_cb_cheques_state_check, ADD CHECK(state IN ('ISSUED','PRESENTED','CLEARED','STOPPED','CANCELLED','DISHONOURED'));
      ALTER TABLE finance_cb_matches DROP CONSTRAINT finance_cb_matches_pkey, ADD PRIMARY KEY(line_id);
      DROP INDEX finance_cb_live_statement_digest,finance_cb_live_statement_start,finance_cb_live_statement_batch;
      ALTER TABLE finance_cb_statements DROP COLUMN withdrawn_id,DROP COLUMN archived_lines,
        ADD UNIQUE(account_id,digest), ADD UNIQUE(account_id,starts), ADD UNIQUE(source_batch);
    `);
  }
}
