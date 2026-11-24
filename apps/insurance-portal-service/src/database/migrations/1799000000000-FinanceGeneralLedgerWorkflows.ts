import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceGeneralLedgerWorkflows1799000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE finance_operating_postings DROP CONSTRAINT finance_operating_postings_source_type_check;
      ALTER TABLE finance_operating_postings ADD CONSTRAINT finance_operating_postings_source_type_check CHECK(source_type IN (
        'INVOICE','RECEIPT','WRITE_OFF','INVOICE_WRITE_OFF','INVOICE_WRITE_OFF_REVERSAL','RECEIPT_REVERSAL','COMMISSION_ACCRUAL','COMMISSION_PAYMENT','COMMISSION_ACCRUAL_REVERSAL','COMMISSION_PAYMENT_REVERSAL','REFUND','CLAIM_DISBURSEMENT','CLAIM_DISBURSEMENT_REVERSAL','CLAIM_RECOVERY_RECEIPT','REINSURANCE_SETTLEMENT','GL_VOUCHER','GL_REVERSAL'));
      CREATE UNIQUE INDEX finance_gl_external_reference ON finance_operating_postings(book_id,upper(btrim(snapshot->>'reference')))
        WHERE source_type IN ('GL_VOUCHER','GL_REVERSAL');
      CREATE UNIQUE INDEX finance_gl_replacement ON finance_operating_postings(book_id,(snapshot->>'replacementOf'))
        WHERE snapshot->>'replacementOf' IS NOT NULL;
      CREATE TABLE finance_gl_deployments (
        sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id),book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        release_id uuid NOT NULL REFERENCES finance_foundation_documents(id),action text NOT NULL CHECK(action IN ('ENABLE','PAUSE')),
        reviewer_subject_id uuid NOT NULL,reviewer_person_id uuid NOT NULL,evidence jsonb NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp());
      CREATE INDEX finance_gl_current_deployment ON finance_gl_deployments(book_id,sequence DESC);
      CREATE TABLE finance_gl_writeoffs (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),company_id uuid NOT NULL REFERENCES companies(id),book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        invoice_id uuid NOT NULL REFERENCES invoices(id),request_key text NOT NULL,amount numeric(20,4) NOT NULL CHECK(amount>0),currency text NOT NULL,
        accounting_date date NOT NULL,reference text NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL,dimensions jsonb NOT NULL,request_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT statement_timestamp(), UNIQUE(book_id,request_key));
      CREATE TABLE finance_gl_reopens (
        request_id uuid PRIMARY KEY REFERENCES finance_approval_requests(id),candidate_id uuid NOT NULL REFERENCES finance_operating_postings(candidate_id),
        actor_subject_id uuid NOT NULL,evidence jsonb NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp());
      CREATE TABLE finance_gl_bank_settlements (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),company_id uuid NOT NULL REFERENCES companies(id),book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        issuer text NOT NULL,bank_reference text NOT NULL,source_type text NOT NULL CHECK(source_type IN ('REFUND','COMMISSION_PAYMENT')),source_id uuid NOT NULL,
        attestation jsonb NOT NULL,subject_hash text NOT NULL,signature text NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        UNIQUE(company_id,issuer,bank_reference),UNIQUE(company_id,source_type,source_id));
      CREATE TABLE finance_gl_recovery_cash (
        receipt_id uuid PRIMARY KEY REFERENCES reinsurance_recovery_receipts(id), recovery_id uuid NOT NULL REFERENCES reinsurance_claim_recoveries(id),
        settlement_id uuid NOT NULL REFERENCES reinsurance_settlements(id), journal_id uuid NOT NULL REFERENCES finance_foundation_journals(id),
        amount numeric(20,2) NOT NULL CHECK(amount>0), UNIQUE(settlement_id,recovery_id));
      CREATE TABLE finance_gl_drafts (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        maker_subject_id uuid NOT NULL,maker_person_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),
        input jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),candidate_id uuid UNIQUE REFERENCES finance_journal_candidates(id));
      CREATE TABLE finance_gl_programs (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), company_id uuid NOT NULL REFERENCES companies(id),
        tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL, code text NOT NULL, revision integer NOT NULL CHECK(revision>0),
        kind text NOT NULL CHECK(kind IN ('TEMPLATE','RECURRING','ACCRUAL','PREPAYMENT','INTERBRANCH','ALLOCATION','REVALUATION','RECONCILIATION')),
        definition jsonb NOT NULL, subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
        maker_user_id uuid NOT NULL,maker_subject_id uuid NOT NULL,maker_person_id uuid NOT NULL,
        reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        UNIQUE(book_id,code,revision), FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id));
      CREATE TABLE finance_gl_fx_openings (
        opening_id uuid NOT NULL REFERENCES finance_foundation_documents(id),book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        account_code text NOT NULL,position_key text NOT NULL,foreign_amount numeric(38,12) NOT NULL,carrying_amount numeric(38,12) NOT NULL,evidence jsonb NOT NULL,
        PRIMARY KEY(opening_id,position_key),CHECK(foreign_amount>=0 AND carrying_amount>=0));
      CREATE TABLE finance_gl_zero_revaluations (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),book_id uuid NOT NULL REFERENCES finance_accounting_books(id),program_id uuid NOT NULL REFERENCES finance_gl_programs(id),
        position_key text NOT NULL,as_of date NOT NULL,population_hash text NOT NULL,evidence jsonb NOT NULL,actor_subject_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(book_id,position_key,as_of,population_hash));
      CREATE TABLE finance_gl_decisions (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, program_id uuid NOT NULL REFERENCES finance_gl_programs(id),
        action text NOT NULL CHECK(action IN ('APPROVE','PAUSE')),actor_subject_id uuid NOT NULL,actor_person_id uuid NOT NULL,
        reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp(), UNIQUE(program_id,action));
      CREATE OR REPLACE FUNCTION finance_fin01_request_history() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE previous finance_approval_requests; reopened boolean;
      BEGIN
        PERFORM id FROM finance_journal_candidates WHERE id=NEW.candidate_id FOR UPDATE;
        SELECT * INTO previous FROM finance_approval_requests WHERE candidate_id=NEW.candidate_id ORDER BY expires_at DESC,id DESC LIMIT 1;
        IF NOT FOUND THEN RETURN NEW; END IF;
        reopened:=previous.state='REJECTED_INACTIVE' AND EXISTS(SELECT 1 FROM finance_gl_reopens x WHERE x.request_id=previous.id AND x.candidate_id=NEW.candidate_id AND x.actor_subject_id=NEW.maker_subject_id);
        IF (NOT reopened AND (previous.state<>'OPEN_INACTIVE' OR previous.expires_at>statement_timestamp()))
          OR previous.expires_at>=NEW.expires_at OR previous.candidate_hash<>NEW.candidate_hash OR previous.profile_id<>NEW.profile_id OR previous.profile_hash<>NEW.profile_hash OR previous.beneficiary_hash<>NEW.beneficiary_hash OR previous.maker_subject_id<>NEW.maker_subject_id OR previous.maker_natural_person_id<>NEW.maker_natural_person_id OR NOT EXISTS(SELECT 1 FROM finance_operating_postings p WHERE p.candidate_id=NEW.candidate_id)
          THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='This candidate already has a binding approval request.'; END IF;
        RETURN NEW;
      END $$;
      CREATE INDEX finance_gl_program_book ON finance_gl_programs(book_id,code,revision DESC);
      CREATE INDEX finance_gl_source_program ON finance_operating_postings(book_id,(snapshot->>'programCode'),(snapshot->>'occurrence'));
    `);
    for (const table of [
      'finance_gl_programs',
      'finance_gl_decisions',
      'finance_gl_deployments',
      'finance_gl_writeoffs',
      'finance_gl_zero_revaluations',
      'finance_gl_fx_openings',
      'finance_gl_bank_settlements',
      'finance_gl_recovery_cash',
      'finance_gl_reopens',
    ]) {
      await q.query(`CREATE TRIGGER finance_gl_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION finance_foundation_immutable();
        CREATE TRIGGER finance_gl_no_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION finance_foundation_immutable()`);
    }
  }
  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_gl_recovery_cash) OR EXISTS(SELECT 1 FROM finance_gl_reopens) OR EXISTS(SELECT 1 FROM finance_gl_deployments) OR EXISTS(SELECT 1 FROM finance_gl_drafts) OR EXISTS(SELECT 1 FROM finance_gl_writeoffs) OR EXISTS(SELECT 1 FROM finance_gl_programs) OR EXISTS(SELECT 1 FROM finance_operating_postings WHERE source_type NOT IN ('INVOICE','RECEIPT')) THEN
      RAISE EXCEPTION 'Preserve recorded FIN-02 history. Roll back the book deployment instead.'; END IF; END $$;
      CREATE OR REPLACE FUNCTION finance_fin01_request_history() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE previous finance_approval_requests;
      BEGIN
        PERFORM id FROM finance_journal_candidates WHERE id=NEW.candidate_id FOR UPDATE;
        SELECT * INTO previous FROM finance_approval_requests WHERE candidate_id=NEW.candidate_id ORDER BY expires_at DESC,id DESC LIMIT 1;
        IF FOUND AND (previous.state<>'OPEN_INACTIVE' OR previous.expires_at>statement_timestamp() OR previous.expires_at>=NEW.expires_at OR previous.candidate_hash<>NEW.candidate_hash OR previous.profile_id<>NEW.profile_id OR previous.profile_hash<>NEW.profile_hash OR previous.beneficiary_hash<>NEW.beneficiary_hash OR previous.maker_subject_id<>NEW.maker_subject_id OR previous.maker_natural_person_id<>NEW.maker_natural_person_id OR NOT EXISTS(SELECT 1 FROM finance_operating_postings p WHERE p.candidate_id=NEW.candidate_id))
        THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='This candidate already has a binding approval request.'; END IF; RETURN NEW;
      END $$;
      DROP TABLE finance_gl_recovery_cash,finance_gl_bank_settlements,finance_gl_reopens,finance_gl_fx_openings,finance_gl_zero_revaluations,finance_gl_decisions, finance_gl_programs, finance_gl_drafts, finance_gl_writeoffs, finance_gl_deployments;
      DROP INDEX finance_gl_source_program, finance_gl_replacement, finance_gl_external_reference;
      ALTER TABLE finance_operating_postings DROP CONSTRAINT finance_operating_postings_source_type_check;
      ALTER TABLE finance_operating_postings ADD CONSTRAINT finance_operating_postings_source_type_check CHECK(source_type IN ('INVOICE','RECEIPT'))`);
  }
}
