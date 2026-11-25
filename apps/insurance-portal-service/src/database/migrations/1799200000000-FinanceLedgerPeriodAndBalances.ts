import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceLedgerPeriodAndBalances1799200000000 implements MigrationInterface {
  private async periods(q: QueryRunner, allowVoucher: boolean) {
    await q.query(`CREATE OR REPLACE FUNCTION finance_foundation_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      PERFORM 1 FROM finance_accounting_books WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND id=NEW.book_id FOR UPDATE;
      IF TG_OP='UPDATE' AND (NEW.revision<>OLD.revision+1 OR NEW.state=OLD.state OR (to_jsonb(NEW)-ARRAY['state','revision'])<>(to_jsonb(OLD)-ARRAY['state','revision'])) THEN RAISE EXCEPTION 'Period requires an exact next fence'; END IF;
      IF EXISTS(SELECT 1 FROM finance_foundation_periods WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND mode=NEW.mode AND id<>NEW.id AND starts_on<NEW.ends_before AND ends_before>NEW.starts_on ${allowVoucher ? "AND period_kind='REGULAR' AND NEW.period_kind='REGULAR'" : ''}) THEN RAISE EXCEPTION 'Ledger periods overlap'; END IF;
      RETURN NEW; END $$;`);
    await q.query(`CREATE OR REPLACE FUNCTION finance_fin01_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE a finance_operating_setups; r record;
      BEGIN
        IF TG_TABLE_NAME='finance_foundation_deployments' THEN
          IF NEW.action='DISABLE' THEN RETURN NEW; END IF;
        ELSIF NEW.mode<>'LIVE' THEN RETURN NEW; END IF;
        SELECT * INTO a FROM finance_operating_setups WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND withdrawn_at IS NULL;
        IF a.id IS NULL OR NOT finance_fin01_current(a.id,(to_jsonb(NEW)->>'accounting_date')::date)
          THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Complete and activate FIN-01 for this book.'; END IF;
        IF TG_TABLE_NAME='finance_foundation_deployments' THEN
          IF a.release_id<>NEW.release_id THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Ledger release differs from the approved FIN-01 release.'; END IF;
        ELSE
          SELECT period_kind INTO r FROM finance_foundation_periods WHERE id=NEW.period_id;
          IF NOT ((a.controls->'currencies') ? NEW.transaction_currency) THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='The transaction currency is outside the activated book.'; END IF;
          NEW.journal_no:=finance_fin01_number(a.id,'JOURNAL');
          IF EXISTS(SELECT 1 FROM finance_journal_candidate_lines l WHERE l.candidate_id=NEW.candidate_id AND (
            EXISTS(SELECT 1 FROM finance_configuration_releases d CROSS JOIN LATERAL jsonb_array_elements(d.payload->'definitions') def
              WHERE d.id::text=a.controls->>'dimensionReleaseId' AND d.release_hash=a.controls->>'dimensionReleaseHash' AND (def->>'required')::boolean AND NULLIF(btrim(l.dimensions->>(def->>'code')),'') IS NULL) OR
            (l.dimensions ? 'DEPARTMENT' AND (NOT ((a.controls->'departmentIds') ? (l.dimensions->>'DEPARTMENT')) OR NOT EXISTS
              (SELECT 1 FROM departments d WHERE d.id::text=l.dimensions->>'DEPARTMENT' AND d.company_id::text=a.company_id::text AND d.status='active' AND d.deleted_at IS NULL))) OR
            (l.dimensions ? 'COST_CENTRE' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.controls->'costCentres') cc WHERE cc->>'code'=l.dimensions->>'COST_CENTRE')) OR
            (l.dimensions ? 'DIMENSION_RELEASE' AND (l.dimensions->>'DIMENSION_RELEASE' IS DISTINCT FROM a.controls->>'dimensionReleaseId' OR l.dimensions->>'DIMENSION_HASH' IS DISTINCT FROM a.controls->>'dimensionReleaseHash'))))
            THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Journal dimensions differ from the approved company and book values.'; END IF;
          IF r.period_kind='ADJUSTMENT' AND NEW.kind<>'REVERSAL' AND NOT EXISTS(
            SELECT 1 FROM finance_journal_candidates c WHERE c.id=NEW.candidate_id AND (c.payload->>'economicOrigin'='ADJUSTMENT' ${allowVoucher ? `OR (c.payload->>'economicOrigin'='FIN02_GL' AND EXISTS(SELECT 1 FROM finance_operating_postings op JOIN finance_draft_periods dp ON dp.id=c.period_id WHERE op.candidate_id=c.id AND op.source_type='GL_VOUCHER' AND op.snapshot->>'component'='MANUAL' AND op.snapshot->>'adjustmentPeriodId'=NEW.period_id::text AND dp.adjustment_period_id=NEW.period_id))` : ''}))
            THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Only adjustment journals or reversals may use this period.'; END IF;
        END IF;
        RETURN NEW;
      END $$;`);
  }
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE finance_draft_periods ADD COLUMN adjustment_period_id uuid UNIQUE,
      ADD FOREIGN KEY(tenant_id,legal_entity_id,book_id,adjustment_period_id) REFERENCES finance_foundation_periods(tenant_id,legal_entity_id,book_id,id);
      CREATE TABLE finance_gl_schedule_holds (
        program_id uuid NOT NULL REFERENCES finance_gl_programs(id), due_date date NOT NULL, reason text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT statement_timestamp(), PRIMARY KEY(program_id,due_date));
      CREATE TABLE finance_gl_fx_opening_sets (
        opening_id uuid NOT NULL REFERENCES finance_foundation_documents(id), book_id uuid NOT NULL REFERENCES finance_accounting_books(id),
        account_code text NOT NULL, payload jsonb NOT NULL, subject_hash text NOT NULL, program_id uuid NOT NULL REFERENCES finance_gl_programs(id),
        PRIMARY KEY(opening_id,account_code));
      CREATE FUNCTION finance_gl_check_period_binding() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE selected uuid; requested text; kind text; BEGIN
        IF NEW.mode<>'LIVE' THEN RETURN NEW; END IF;
        SELECT d.adjustment_period_id,p.snapshot->>'adjustmentPeriodId',p.source_type INTO selected,requested,kind
          FROM finance_journal_candidates c JOIN finance_draft_periods d ON d.id=c.period_id LEFT JOIN finance_operating_postings p ON p.candidate_id=c.id WHERE c.id=NEW.candidate_id;
        IF (selected IS NOT NULL OR requested IS NOT NULL) AND (selected IS DISTINCT FROM NEW.period_id OR requested IS DISTINCT FROM selected::text OR coalesce(kind,'') NOT IN ('GL_VOUCHER','GL_REVERSAL')) THEN RAISE EXCEPTION 'Adjustment must use the selected book period'; END IF;
        IF kind IS NOT NULL AND selected IS NULL AND EXISTS(SELECT 1 FROM finance_foundation_periods WHERE id=NEW.period_id AND period_kind='ADJUSTMENT') THEN RAISE EXCEPTION 'Ordinary movements require a regular period'; END IF;
        RETURN NEW; END $$;
      CREATE TRIGGER gl_period_binding BEFORE INSERT ON finance_foundation_journals FOR EACH ROW EXECUTE FUNCTION finance_gl_check_period_binding();`);
    for (const table of [
      'finance_gl_schedule_holds',
      'finance_gl_fx_opening_sets',
    ]) {
      await q.query(`CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION finance_foundation_immutable();
        CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION finance_foundation_immutable();`);
    }
    await this.periods(q, true);
  }
  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_draft_periods WHERE adjustment_period_id IS NOT NULL) OR EXISTS(SELECT 1 FROM finance_gl_fx_opening_sets) OR EXISTS(SELECT 1 FROM finance_gl_schedule_holds)
      OR EXISTS(SELECT 1 FROM finance_gl_programs WHERE definition->'reconciliation' ? 'adjustedStatementBalance')
      OR EXISTS(SELECT 1 FROM finance_foundation_periods x JOIN finance_foundation_periods y ON x.id<y.id AND x.book_id=y.book_id AND x.mode=y.mode AND x.starts_on<y.ends_before AND x.ends_before>y.starts_on)
      THEN RAISE EXCEPTION 'Preserve adjustment, schedule and balance history before retiring the release'; END IF; END $$;`);
    await this.periods(q, false);
    await q.query(`DROP TRIGGER gl_period_binding ON finance_foundation_journals; DROP FUNCTION finance_gl_check_period_binding();
      DROP TABLE finance_gl_fx_opening_sets,finance_gl_schedule_holds; ALTER TABLE finance_draft_periods DROP COLUMN adjustment_period_id;`);
  }
}
