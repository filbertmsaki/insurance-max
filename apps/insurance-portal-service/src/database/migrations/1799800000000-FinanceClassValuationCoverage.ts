import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceClassValuationCoverage1799800000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER FUNCTION finance_fa_class_status(uuid,date) RENAME TO finance_fa_original_class_status;
      CREATE FUNCTION finance_fa_valuation_coverage(book uuid, cutoff date) RETURNS TABLE(
        run_id uuid, request_key text, category text, reference text, effective_date date,
        total int, posted int, state text, outstanding text[], missing text[])
      LANGUAGE sql STABLE AS $$
        WITH valuations AS MATERIALIZED (
          SELECT d.id,d.code,d.reference,d.effective_date,d.request_key,d.plan->'asset'->>'category' category,
            d.input->>'valuationRunId' supplement,
            CASE WHEN d.state='POSTED' AND EXISTS (SELECT 1 FROM finance_fa_documents v WHERE v.reversal_of=d.id
              AND v.state='POSTED' AND v.effective_date<=cutoff) THEN 'REVERSED' ELSE d.state END decision
          FROM finance_fa_documents d WHERE d.book_id=book AND d.kind='REVALUE' AND d.effective_date<=cutoff
        ), batched AS (
          SELECT r.document_ids[1] run_id,r.request_key run_key,v.*
          FROM finance_fa_runs r CROSS JOIN LATERAL unnest(r.document_ids) member(id)
          JOIN valuations v ON v.id=member.id WHERE r.book_id=book
        ), originals AS (
          -- A single-asset valuation was historically submitted without a run record.
          SELECT * FROM batched UNION ALL
          SELECT v.id,v.request_key,v.* FROM valuations v
          WHERE v.supplement IS NULL AND NOT EXISTS (SELECT 1 FROM batched b WHERE b.id=v.id)
        ), runs AS (
          SELECT DISTINCT o.run_id,o.run_key,o.category,o.reference,o.effective_date FROM originals o
        ), members AS (
          SELECT o.run_id,o.code,o.decision FROM originals o UNION ALL
          SELECT r.run_id,v.code,v.decision FROM valuations v JOIN runs r ON v.supplement=r.run_id::text
            AND v.category=r.category AND v.effective_date=r.effective_date
        ), own AS (
          SELECT m.run_id,m.code,bool_or(m.decision='POSTED') posted,
            bool_or(m.decision IN ('PENDING','APPROVED')) pending FROM members m GROUP BY m.run_id,m.code
        ), live AS (
          SELECT o.run_id,bool_or(o.posted OR o.pending) live FROM own o GROUP BY o.run_id
        ), dates AS (SELECT DISTINCT r.effective_date FROM runs r),
        population AS MATERIALIZED (
          -- Later events may change today's class without changing the class on the valuation date.
          SELECT t.effective_date,a.code,a.asset->>'category' category FROM dates t CROSS JOIN LATERAL (
            SELECT DISTINCT ON (d.code) d.code,d.plan->'asset' asset FROM finance_fa_documents d
            WHERE d.book_id=book AND d.state='POSTED' AND d.effective_date<=t.effective_date
              AND d.kind NOT IN ('GROUP','LOCATION','CATEGORY')
            ORDER BY d.code,d.effective_date DESC,d.sequence DESC
          ) a WHERE a.asset->>'status'='ACTIVE'
        ), required AS (
          SELECT o.run_id,o.code FROM own o JOIN live l ON l.run_id=o.run_id WHERE NOT l.live OR o.pending
          UNION
          SELECT r.run_id,p.code FROM runs r JOIN live l ON l.run_id=r.run_id AND l.live
            JOIN population p ON p.category=r.category AND p.effective_date=r.effective_date
        ), shared AS (
          SELECT v.category,v.effective_date,v.code,bool_or(v.decision='POSTED') posted,
            bool_or(v.decision IN ('PENDING','APPROVED')) pending FROM valuations v GROUP BY v.category,v.effective_date,v.code
        ), coverage AS (
          -- Original and supplemental members require their own decision. A newly discovered
          -- member can also be covered by a posted valuation for the same class and date.
          SELECT k.run_id,k.code,coalesce(o.posted,s.posted,false) posted,coalesce(o.pending,s.pending,false) pending,
            p.code IS NOT NULL active
          FROM required k JOIN runs r ON r.run_id=k.run_id
            LEFT JOIN own o ON o.run_id=k.run_id AND o.code=k.code
            LEFT JOIN shared s ON s.category=r.category AND s.effective_date=r.effective_date AND s.code=k.code
            LEFT JOIN population p ON p.category=r.category AND p.effective_date=r.effective_date AND p.code=k.code
        )
        SELECT r.run_id,r.run_key,r.category,r.reference,r.effective_date,count(c.code)::int,
          count(*) FILTER (WHERE c.posted)::int,
          CASE WHEN NOT l.live THEN 'WITHDRAWN' WHEN coalesce(bool_and(c.posted),true) THEN 'COMPLETE'
            WHEN bool_or(c.posted) THEN 'PARTIAL' ELSE 'IN_REVIEW' END,
          coalesce(array_agg(c.code ORDER BY c.code) FILTER (WHERE NOT c.posted),'{}'),
          coalesce(array_agg(c.code ORDER BY c.code) FILTER (WHERE l.live AND c.active AND NOT c.posted AND NOT c.pending),'{}')
        FROM runs r LEFT JOIN coverage c ON c.run_id=r.run_id JOIN live l ON r.run_id=l.run_id
        GROUP BY r.run_id,r.run_key,r.category,r.reference,r.effective_date,l.live
      $$;

      CREATE FUNCTION finance_fa_class_status(book uuid,cutoff date) RETURNS TABLE(
        request_key text,category text,reference text,effective_date date,total int,posted int,state text,outstanding text[])
      LANGUAGE sql STABLE AS $$
        SELECT v.request_key,v.category,v.reference,v.effective_date,v.total,v.posted,v.state,v.outstanding
        FROM finance_fa_valuation_coverage(book,cutoff) v
      $$;

      CREATE FUNCTION finance_fa_guard_valuation_membership() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE period record;
      BEGIN
        IF NEW.plan->'asset'->>'status' IS DISTINCT FROM 'ACTIVE' OR EXISTS (
          SELECT 1 FROM finance_fa_documents p WHERE p.id=NEW.prior_id AND p.plan->'asset'->>'status'='ACTIVE'
          AND p.plan->'asset'->>'category'=NEW.plan->'asset'->>'category') THEN RETURN NEW; END IF;
        FOR period IN SELECT p.state,p.starts_on,p.ends_before FROM finance_foundation_periods p WHERE p.book_id=NEW.book_id
          AND p.mode='LIVE' AND p.period_kind='REGULAR' AND EXISTS (
            SELECT 1 FROM finance_fa_documents v WHERE v.book_id=NEW.book_id AND v.kind='REVALUE'
            AND v.plan->'asset'->>'category'=NEW.plan->'asset'->>'category' AND v.effective_date>=NEW.effective_date
            AND v.effective_date>=p.starts_on AND v.effective_date<p.ends_before)
          ORDER BY p.starts_on FOR SHARE OF p
        LOOP
          IF period.state='CLOSED' AND EXISTS (
            SELECT 1 FROM finance_fa_valuation_coverage(NEW.book_id,period.ends_before-1) v
            WHERE v.category=NEW.plan->'asset'->>'category' AND v.effective_date>=greatest(NEW.effective_date,period.starts_on)
              AND v.state IN ('PARTIAL','IN_REVIEW') AND NEW.code=ANY(v.outstanding))
          THEN RAISE EXCEPTION USING ERRCODE='P0401',
            MESSAGE='Reopen the class valuation period before adding this asset to its valuation population.'; END IF;
        END LOOP;
        RETURN NEW;
      END $$;
      CREATE TRIGGER finance_fa_guard_valuation_membership AFTER UPDATE OF state ON finance_fa_documents
        FOR EACH ROW WHEN (NEW.state='POSTED' AND OLD.state<>'POSTED')
        EXECUTE FUNCTION finance_fa_guard_valuation_membership();
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`
      DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_fa_documents WHERE input ? 'valuationRunId')
        THEN RAISE EXCEPTION 'Reconcile supplemental class valuations before rollback.'; END IF; END $$;
      DROP TRIGGER finance_fa_guard_valuation_membership ON finance_fa_documents;
      DROP FUNCTION finance_fa_guard_valuation_membership(),finance_fa_class_status(uuid,date),finance_fa_valuation_coverage(uuid,date);
      ALTER FUNCTION finance_fa_original_class_status(uuid,date) RENAME TO finance_fa_class_status;
    `);
  }
}
