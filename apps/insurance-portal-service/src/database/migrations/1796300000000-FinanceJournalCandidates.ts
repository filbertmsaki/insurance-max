import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Inactive validation structures only: no GL posts, policies or grants. */
export class FinanceJournalCandidates1796300000000 implements MigrationInterface {
  name = 'FinanceJournalCandidates1796300000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(`CREATE TABLE finance_journal_candidate_authorities (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL,
      book_id uuid NOT NULL, subject_id uuid NOT NULL, natural_person_id uuid NOT NULL,
      permission varchar(24) NOT NULL CHECK (permission IN ('MANAGE_DRAFT_PERIOD','PREPARE_CANDIDATE','VALIDATE_CANDIDATE')),
      state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','ENABLED','REVOKED')),
      authority_reference varchar(200) NOT NULL CHECK (btrim(authority_reference) <> ''),
      valid_from timestamptz NOT NULL, valid_to timestamptz, revoked_at timestamptz,
      CHECK (valid_to IS NULL OR valid_to > valid_from),
      UNIQUE (tenant_id, legal_entity_id, book_id, id),
      FOREIGN KEY (tenant_id, legal_entity_id, book_id) REFERENCES finance_accounting_books (tenant_id, legal_entity_id, id) ON DELETE RESTRICT
    )`);
    await q.query(
      'CREATE INDEX "IDX_fin_candidate_actor" ON finance_journal_candidate_authorities (tenant_id, legal_entity_id, book_id, subject_id, natural_person_id, permission)',
    );
    await q.query(`CREATE TABLE finance_draft_periods (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL,
      book_id uuid NOT NULL, period_code varchar(50) NOT NULL CHECK (btrim(period_code) <> '' AND period_code = btrim(period_code)),
      starts_on date NOT NULL, ends_before date NOT NULL CHECK (ends_before > starts_on),
      state varchar(24) NOT NULL DEFAULT 'SEALED_DRAFT' CHECK (state IN ('SEALED_DRAFT','OPEN_FOR_VALIDATION')),
      revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
      UNIQUE (tenant_id, legal_entity_id, book_id, id), UNIQUE (tenant_id, legal_entity_id, book_id, period_code),
      FOREIGN KEY (tenant_id, legal_entity_id, book_id) REFERENCES finance_accounting_books (tenant_id, legal_entity_id, id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_journal_candidates (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      period_id uuid NOT NULL, period_revision integer NOT NULL CHECK (period_revision > 0), accounting_date date NOT NULL,
      chart_release_id uuid NOT NULL, chart_release_hash varchar(64) NOT NULL CHECK (chart_release_hash ~ '^[0-9a-f]{64}$'),
      currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'), decimal_scale integer NOT NULL CHECK (decimal_scale BETWEEN 0 AND 12),
      economic_key varchar(64) NOT NULL CHECK (economic_key ~ '^[0-9a-f]{64}$'),
      kind varchar(10) NOT NULL CHECK (kind IN ('ORIGINAL','REVERSAL')), correction_of_id uuid, correction_of_hash varchar(64),
      payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'), subject_hash varchar(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
      maker_subject_id uuid NOT NULL, maker_natural_person_id uuid NOT NULL,
      state varchar(24) NOT NULL DEFAULT 'PREPARED_INACTIVE' CHECK (state IN ('PREPARED_INACTIVE','VALIDATED_INACTIVE')),
      checker_subject_id uuid, checker_natural_person_id uuid, validated_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK ((kind = 'ORIGINAL' AND correction_of_id IS NULL AND correction_of_hash IS NULL) OR (kind = 'REVERSAL' AND correction_of_id IS NOT NULL AND correction_of_hash IS NOT NULL AND correction_of_hash ~ '^[0-9a-f]{64}$')),
      CHECK ((state = 'PREPARED_INACTIVE' AND checker_subject_id IS NULL AND checker_natural_person_id IS NULL AND validated_at IS NULL) OR
        (state = 'VALIDATED_INACTIVE' AND checker_subject_id IS NOT NULL AND checker_natural_person_id IS NOT NULL AND validated_at IS NOT NULL AND checker_subject_id <> maker_subject_id AND checker_natural_person_id <> maker_natural_person_id)),
      UNIQUE (tenant_id, legal_entity_id, book_id, id), UNIQUE (tenant_id, legal_entity_id, book_id, id, period_id),
      UNIQUE (tenant_id, legal_entity_id, book_id, economic_key, kind),
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, period_id) REFERENCES finance_draft_periods (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, chart_release_id) REFERENCES finance_configuration_releases (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, correction_of_id) REFERENCES finance_journal_candidates (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_journal_candidate_lines (
      tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL, candidate_id uuid NOT NULL,
      line_key varchar(80) NOT NULL, role_code varchar(80) NOT NULL, account_code varchar(50) NOT NULL,
      debit numeric(38,12) NOT NULL, credit numeric(38,12) NOT NULL,
      dimensions jsonb NOT NULL CHECK (jsonb_typeof(dimensions) = 'object'),
      PRIMARY KEY (candidate_id, line_key),
      CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
      CHECK (debit >= 0 AND debit < 'Infinity'::numeric AND credit >= 0 AND credit < 'Infinity'::numeric),
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, candidate_id) REFERENCES finance_journal_candidates (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_journal_candidate_events (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      period_id uuid NOT NULL, period_revision integer NOT NULL, candidate_id uuid,
      action varchar(24) NOT NULL CHECK (action IN ('PERIOD_CREATED','PERIOD_FENCED','PREPARED_INACTIVE','VALIDATED_INACTIVE')),
      subject_hash varchar(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
      actor_subject_id uuid NOT NULL, actor_natural_person_id uuid NOT NULL, authority_id uuid NOT NULL,
      reason text NOT NULL CHECK (btrim(reason) <> ''), occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK ((candidate_id IS NULL AND action IN ('PERIOD_CREATED','PERIOD_FENCED')) OR (candidate_id IS NOT NULL AND action IN ('PREPARED_INACTIVE','VALIDATED_INACTIVE'))),
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, period_id) REFERENCES finance_draft_periods (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, candidate_id, period_id) REFERENCES finance_journal_candidates (tenant_id, legal_entity_id, book_id, id, period_id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, authority_id) REFERENCES finance_journal_candidate_authorities (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT
    )`);
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_candidate_event" ON finance_journal_candidate_events (candidate_id, action) WHERE candidate_id IS NOT NULL',
    );
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_draft_period_event" ON finance_journal_candidate_events (period_id, period_revision) WHERE candidate_id IS NULL',
    );
    await q.query(`CREATE FUNCTION fn_fin_candidate_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Candidate history cannot be removed'; END IF;
      IF TG_TABLE_NAME = 'finance_journal_candidates' AND TG_OP = 'UPDATE' THEN
        IF OLD.state <> 'PREPARED_INACTIVE' OR NEW.state <> 'VALIDATED_INACTIVE' OR
          (to_jsonb(OLD) - ARRAY['state','checker_subject_id','checker_natural_person_id','validated_at']) IS DISTINCT FROM
          (to_jsonb(NEW) - ARRAY['state','checker_subject_id','checker_natural_person_id','validated_at']) THEN RAISE EXCEPTION 'Candidate subject is immutable'; END IF;
      ELSIF TG_TABLE_NAME = 'finance_draft_periods' AND TG_OP = 'UPDATE' THEN
        IF NEW.revision <> OLD.revision + 1 OR NEW.state = OLD.state OR
          (to_jsonb(OLD) - ARRAY['state','revision']) IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['state','revision']) THEN RAISE EXCEPTION 'Period changes require an exact next fence'; END IF;
      ELSIF TG_TABLE_NAME = 'finance_journal_candidate_lines' AND TG_OP = 'INSERT' THEN
        IF EXISTS (SELECT 1 FROM finance_journal_candidate_events WHERE candidate_id = NEW.candidate_id) THEN RAISE EXCEPTION 'Candidate lines are frozen'; END IF;
      ELSE RAISE EXCEPTION 'Candidate evidence is append only'; END IF;
      RETURN NEW;
    END $$`);
    for (const table of [
      'finance_draft_periods',
      'finance_journal_candidates',
      'finance_journal_candidate_lines',
      'finance_journal_candidate_events',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fn_fin_candidate_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_candidate_immutable()`,
      );
    }
    await q.query(
      'CREATE TRIGGER frozen_lines BEFORE INSERT ON finance_journal_candidate_lines FOR EACH ROW EXECUTE FUNCTION fn_fin_candidate_immutable()',
    );
    await q.query(`CREATE FUNCTION fn_fin_candidate_commit() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE dr numeric; cr numeric; count_lines integer; BEGIN
      IF TG_TABLE_NAME = 'finance_draft_periods' THEN
        IF NOT EXISTS (SELECT 1 FROM finance_journal_candidate_events e WHERE e.period_id = NEW.id AND e.candidate_id IS NULL AND e.period_revision = NEW.revision AND e.action = CASE WHEN TG_OP = 'INSERT' THEN 'PERIOD_CREATED' ELSE 'PERIOD_FENCED' END) THEN RAISE EXCEPTION 'Period fence requires atomic audit'; END IF;
      ELSE
        IF NOT EXISTS (SELECT 1 FROM finance_journal_candidate_events e WHERE e.candidate_id = NEW.id AND e.action = NEW.state AND e.subject_hash = NEW.subject_hash AND e.actor_subject_id = CASE WHEN NEW.state = 'PREPARED_INACTIVE' THEN NEW.maker_subject_id ELSE NEW.checker_subject_id END AND e.actor_natural_person_id = CASE WHEN NEW.state = 'PREPARED_INACTIVE' THEN NEW.maker_natural_person_id ELSE NEW.checker_natural_person_id END) THEN RAISE EXCEPTION 'Candidate requires atomic audit'; END IF;
        SELECT sum(debit), sum(credit), count(*) INTO dr, cr, count_lines FROM finance_journal_candidate_lines WHERE candidate_id = NEW.id;
        IF count_lines < 2 OR dr IS NULL OR dr <= 0 OR dr <> cr THEN RAISE EXCEPTION 'Stored candidate is not exactly balanced'; END IF;
      END IF;
      RETURN NULL;
    END $$`);
    for (const table of ['finance_draft_periods', 'finance_journal_candidates'])
      await q.query(
        `CREATE CONSTRAINT TRIGGER candidate_commit AFTER INSERT OR UPDATE ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_candidate_commit()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'finance_journal_candidate_events',
      'finance_journal_candidate_lines',
      'finance_journal_candidates',
      'finance_draft_periods',
      'finance_journal_candidate_authorities',
    ]) {
      const [row] = await q.query(
        `SELECT EXISTS (SELECT 1 FROM ${table}) AS in_use`,
      );
      if (row.in_use)
        throw new Error(
          'Journal-candidate rollback requires empty registries.',
        );
    }
    await q.query(
      'DROP TABLE finance_journal_candidate_events, finance_journal_candidate_lines, finance_journal_candidates, finance_draft_periods, finance_journal_candidate_authorities',
    );
    await q.query(
      'DROP FUNCTION fn_fin_candidate_commit(), fn_fin_candidate_immutable()',
    );
  }
}
