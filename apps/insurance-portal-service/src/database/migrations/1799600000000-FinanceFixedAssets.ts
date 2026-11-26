import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceFixedAssets1799600000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE finance_fa_documents (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
        book_id uuid NOT NULL REFERENCES finance_accounting_books(id), company_id uuid NOT NULL REFERENCES companies(id),
        kind text NOT NULL, code text NOT NULL, reference text NOT NULL, effective_date date NOT NULL, currency text NOT NULL,
        request_key text NOT NULL, request_hash text NOT NULL, input jsonb NOT NULL, plan jsonb NOT NULL,
        prior_id uuid REFERENCES finance_fa_documents(id), reversal_of uuid REFERENCES finance_fa_documents(id),
        maker_id uuid NOT NULL, maker_person uuid NOT NULL, reviewer_id uuid, reviewer_person uuid, reason text,
        state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','POSTED','REJECTED','CANCELLED')),
        candidate_id uuid UNIQUE REFERENCES finance_journal_candidates(id), journal_id uuid UNIQUE REFERENCES finance_foundation_journals(id),
        reviewed_at timestamptz, posted_at timestamptz, UNIQUE(book_id,request_key),
        CHECK(maker_id IS DISTINCT FROM reviewer_id AND maker_person IS DISTINCT FROM reviewer_person)
      );
      CREATE INDEX finance_fa_history ON finance_fa_documents(book_id,code,effective_date DESC,sequence DESC) WHERE state='POSTED';
      CREATE UNIQUE INDEX finance_fa_inflight ON finance_fa_documents(book_id,code) WHERE state IN ('PENDING','APPROVED') AND kind NOT IN ('GROUP','CATEGORY','LOCATION');
      CREATE UNIQUE INDEX finance_fa_master_version ON finance_fa_documents(book_id,kind,code,effective_date) WHERE kind IN ('GROUP','CATEGORY','LOCATION') AND state NOT IN ('REJECTED','CANCELLED');
      CREATE UNIQUE INDEX finance_fa_reversal ON finance_fa_documents(reversal_of) WHERE state NOT IN ('REJECTED','CANCELLED');
      CREATE TABLE finance_fa_runs (
        book_id uuid NOT NULL REFERENCES finance_accounting_books(id),request_key text NOT NULL,request_hash text NOT NULL,
        maker_id uuid NOT NULL,document_ids uuid[] NOT NULL,PRIMARY KEY(book_id,request_key)
      );
      CREATE TABLE finance_fa_sources (
        document_id uuid PRIMARY KEY REFERENCES finance_fa_documents(id), journal_id uuid NOT NULL, line_key text NOT NULL,
        amount numeric(38,12) NOT NULL CHECK(amount>0), released_by uuid REFERENCES finance_fa_documents(id),
        FOREIGN KEY(journal_id,line_key) REFERENCES finance_foundation_lines(journal_id,line_key)
      );
      CREATE INDEX finance_fa_used_source ON finance_fa_sources(journal_id,line_key) WHERE released_by IS NULL;
      CREATE FUNCTION finance_fa_source_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.mode='LIVE' AND NEW.reversal_of IS NOT NULL THEN
          PERFORM 1 FROM finance_foundation_journals WHERE id=NEW.reversal_of FOR UPDATE;
          IF EXISTS(SELECT 1 FROM finance_fa_sources WHERE journal_id=NEW.reversal_of AND released_by IS NULL) THEN
            RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Reverse the linked fixed asset transaction before its funding journal.';
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER finance_fa_source_reversal BEFORE INSERT ON finance_foundation_journals
        FOR EACH ROW WHEN (NEW.reversal_of IS NOT NULL) EXECUTE FUNCTION finance_fa_source_reversal();
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_fa_documents) THEN RAISE EXCEPTION 'Archive and reconcile FIN-05 activity before rollback'; END IF; END $$;
      DROP TRIGGER finance_fa_source_reversal ON finance_foundation_journals;
      DROP FUNCTION finance_fa_source_reversal(); DROP TABLE finance_fa_sources,finance_fa_runs,finance_fa_documents;`);
  }
}
