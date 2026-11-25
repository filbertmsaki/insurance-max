import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceLedgerCompletion1799100000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE finance_journal_candidates ADD COLUMN supersedes_id uuid UNIQUE REFERENCES finance_journal_candidates(id);
      DO $$ DECLARE key_name name; BEGIN
        SELECT conname INTO STRICT key_name FROM pg_constraint WHERE conrelid='finance_journal_candidates'::regclass
          AND pg_get_constraintdef(oid)='UNIQUE (tenant_id, legal_entity_id, book_id, economic_key, kind)';
        EXECUTE format('ALTER TABLE finance_journal_candidates DROP CONSTRAINT %I',key_name);
      END $$;
      CREATE UNIQUE INDEX finance_candidate_first_attempt ON finance_journal_candidates(tenant_id,legal_entity_id,book_id,economic_key,kind) WHERE supersedes_id IS NULL;
      CREATE FUNCTION finance_gl_reversal_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS(
          SELECT 1 FROM finance_journal_candidates prev JOIN finance_operating_postings p ON p.candidate_id=prev.id
          JOIN LATERAL(SELECT state FROM finance_approval_requests WHERE candidate_id=prev.id ORDER BY expires_at DESC,id DESC LIMIT 1) a ON true
          WHERE prev.id=NEW.supersedes_id AND prev.book_id=NEW.book_id AND prev.economic_key=NEW.economic_key
            AND prev.correction_of_id=NEW.correction_of_id AND NEW.kind='REVERSAL' AND p.source_type='GL_REVERSAL' AND a.state='REJECTED_INACTIVE'
        ) THEN RAISE EXCEPTION 'Only a rejected reversal of the same original can be superseded'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER finance_gl_check_attempt BEFORE INSERT ON finance_journal_candidates FOR EACH ROW EXECUTE FUNCTION finance_gl_reversal_attempt();
      DROP INDEX finance_gl_replacement;
      CREATE UNIQUE INDEX finance_gl_replacement ON finance_operating_postings(book_id,(snapshot->>'replacementOf'),(coalesce(snapshot->>'supersedesCandidateId','first'))) WHERE snapshot->>'replacementOf' IS NOT NULL;
      ALTER TABLE finance_gl_fx_openings DROP CONSTRAINT finance_gl_fx_openings_check;
      ALTER TABLE finance_gl_fx_openings ADD CHECK(sign(foreign_amount)=sign(carrying_amount));
      ALTER TABLE finance_operating_postings DROP CONSTRAINT finance_operating_postings_source_type_check;
      ALTER TABLE finance_operating_postings ADD CHECK(source_type IN ('INVOICE','RECEIPT','WRITE_OFF','INVOICE_WRITE_OFF','INVOICE_WRITE_OFF_REVERSAL','RECEIPT_REVERSAL','COMMISSION_ACCRUAL','COMMISSION_PAYMENT','COMMISSION_ACCRUAL_REVERSAL','COMMISSION_PAYMENT_REVERSAL','REFUND','CLAIM_DISBURSEMENT','CLAIM_DISBURSEMENT_REVERSAL','CLAIM_RECOVERY_RECEIPT','REINSURANCE_SETTLEMENT','GL_VOUCHER','GL_REVERSAL','IFRS17_MEASUREMENT'));
      CREATE TABLE finance_gl_premium_memos (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), company_id uuid NOT NULL REFERENCES companies(id),
        book_id uuid NOT NULL REFERENCES finance_accounting_books(id), invoice_id uuid NOT NULL REFERENCES invoices(id),
        event_type text NOT NULL CHECK(event_type IN ('ISSUED','VOIDED')), event_id text NOT NULL,
        accounting_date date NOT NULL,payload jsonb NOT NULL,subject_hash text NOT NULL,actor_subject_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT statement_timestamp(), UNIQUE(company_id,invoice_id,event_type), UNIQUE(company_id,event_id));
      CREATE INDEX finance_gl_memo_book ON finance_gl_premium_memos(book_id,accounting_date,id);
      CREATE TABLE finance_gl_insurance_measurements (
        id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES finance_accounting_books(id),company_id uuid NOT NULL REFERENCES companies(id),
        run_reference text NOT NULL,group_reference text NOT NULL,component text NOT NULL,currency text NOT NULL,
        payload jsonb NOT NULL,subject_hash text NOT NULL,signature text NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        UNIQUE(book_id,run_reference,group_reference,component,currency));
      CREATE TABLE finance_gl_measurement_memos (
        measurement_id uuid NOT NULL REFERENCES finance_gl_insurance_measurements(id),memo_id uuid NOT NULL REFERENCES finance_gl_premium_memos(id),PRIMARY KEY(measurement_id,memo_id));
      CREATE INDEX finance_gl_memo_measurement ON finance_gl_measurement_memos(memo_id,measurement_id);
    `);
    for (const table of [
      'finance_gl_premium_memos',
      'finance_gl_insurance_measurements',
      'finance_gl_measurement_memos',
    ]) {
      await q.query(`CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION finance_foundation_immutable();
        CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION finance_foundation_immutable()`);
    }
  }
  async down(q: QueryRunner) {
    await q.query(`
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM finance_gl_premium_memos) OR EXISTS(SELECT 1 FROM finance_gl_insurance_measurements)
          OR EXISTS(SELECT 1 FROM finance_journal_candidates WHERE supersedes_id IS NOT NULL)
          OR EXISTS(SELECT 1 FROM finance_operating_postings WHERE snapshot ? 'supersedesCandidateId' OR snapshot ? 'runHash')
          OR EXISTS(SELECT 1 FROM finance_gl_fx_openings WHERE foreign_amount<0 OR carrying_amount<0)
        THEN RAISE EXCEPTION 'Preserve FIN-02 corrections, schedules, revaluations and insurer measurement evidence before retiring the release'; END IF;
      END $$;
      DROP TABLE finance_gl_measurement_memos,finance_gl_insurance_measurements,finance_gl_premium_memos;
      ALTER TABLE finance_operating_postings DROP CONSTRAINT finance_operating_postings_source_type_check;
      ALTER TABLE finance_operating_postings ADD CHECK(source_type IN ('INVOICE','RECEIPT','WRITE_OFF','INVOICE_WRITE_OFF','INVOICE_WRITE_OFF_REVERSAL','RECEIPT_REVERSAL','COMMISSION_ACCRUAL','COMMISSION_PAYMENT','COMMISSION_ACCRUAL_REVERSAL','COMMISSION_PAYMENT_REVERSAL','REFUND','CLAIM_DISBURSEMENT','CLAIM_DISBURSEMENT_REVERSAL','CLAIM_RECOVERY_RECEIPT','REINSURANCE_SETTLEMENT','GL_VOUCHER','GL_REVERSAL'));
      ALTER TABLE finance_gl_fx_openings DROP CONSTRAINT finance_gl_fx_openings_check;
      ALTER TABLE finance_gl_fx_openings ADD CHECK(foreign_amount>=0 AND carrying_amount>=0);
      DROP INDEX finance_gl_replacement;
      CREATE UNIQUE INDEX finance_gl_replacement ON finance_operating_postings(book_id,(snapshot->>'replacementOf')) WHERE snapshot->>'replacementOf' IS NOT NULL;
      ALTER TABLE finance_journal_candidates ADD UNIQUE(tenant_id,legal_entity_id,book_id,economic_key,kind);
      DROP TRIGGER finance_gl_check_attempt ON finance_journal_candidates;
      DROP FUNCTION finance_gl_reversal_attempt();
      DROP INDEX finance_candidate_first_attempt;
      ALTER TABLE finance_journal_candidates DROP COLUMN supersedes_id;
    `);
  }
}
