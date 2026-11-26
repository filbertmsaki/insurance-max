import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceReceivableBalanceHistory1799900000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE finance_ar_native_balance_changes (
        invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        effective_on date NOT NULL,
        delta numeric NOT NULL,
        PRIMARY KEY(invoice_id,effective_on)
      );
      CREATE FUNCTION finance_ar_native_position(i invoices) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
        SELECT CASE WHEN i.deleted_at IS NULL AND i.status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID')
          THEN i.balance_amount-greatest(i.paid_amount+i.written_off_amount-i.total_amount-i.ar_adjustment,0)
          ELSE 0 END
      $$;
      -- Cash can settle before its confirmation is received. Use the stored event time for each invoice.
      CREATE FUNCTION finance_ar_mark_cash_date() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE stamp timestamptz; dates jsonb;
      BEGIN
        IF NEW.invoice_id IS NULL THEN RETURN NULL; END IF;
        IF TG_TABLE_NAME='receipt_allocations' THEN
          IF TG_OP='INSERT' AND NEW.status='ACTIVE' THEN stamp := NEW.allocated_at;
          ELSIF TG_OP='UPDATE' AND OLD.status='ACTIVE' AND NEW.status='REVERSED' THEN stamp := NEW.reversed_at; END IF;
        ELSIF NEW.status='PAID' AND (TG_OP='INSERT' OR OLD.status<>'PAID') THEN stamp := NEW.paid_at; END IF;
        IF stamp IS NOT NULL THEN
          dates := coalesce(nullif(current_setting('finance.ar_native_cash_dates',true),'')::jsonb,'{}'::jsonb);
          PERFORM set_config('finance.ar_native_cash_dates',(dates||jsonb_build_object(NEW.invoice_id,stamp))::text,true);
        END IF;
        RETURN NULL;
      END $$;
      CREATE TRIGGER finance_ar_mark_allocation_date AFTER INSERT OR UPDATE OF status ON receipt_allocations
        FOR EACH ROW EXECUTE FUNCTION finance_ar_mark_cash_date();
      CREATE TRIGGER finance_ar_mark_refund_date AFTER INSERT OR UPDATE OF status ON finance_refunds
        FOR EACH ROW EXECUTE FUNCTION finance_ar_mark_cash_date();

      CREATE FUNCTION finance_ar_capture_balance() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE change numeric; zone text; observed timestamptz; effective date; dates jsonb;
      BEGIN
        change := finance_ar_native_position(NEW);
        IF TG_OP='UPDATE' THEN change := change-finance_ar_native_position(OLD); END IF;
        IF change=0 THEN RETURN NULL; END IF;
        SELECT s.timezone INTO zone FROM finance_operating_setups s
          WHERE s.company_id=NEW.company_id AND s.book_role='PRIMARY' AND s.withdrawn_at IS NULL ORDER BY s.activated_at DESC LIMIT 1;
        IF TG_OP='INSERT' OR (OLD.status NOT IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID')
          AND NEW.status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERPAID')) THEN
          observed := coalesce(NEW.issued_at,NEW.posted_at,NEW.created_at);
        ELSIF NEW.voided_at IS DISTINCT FROM OLD.voided_at AND NEW.voided_at IS NOT NULL THEN
          observed := NEW.voided_at;
        ELSE
          effective := nullif(current_setting('finance.ar_effective_date',true),'')::date;
          IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
            dates := nullif(current_setting('finance.ar_native_cash_dates',true),'')::jsonb;
            observed := (dates->>NEW.id::text)::timestamptz;
            IF observed IS NOT NULL THEN
              PERFORM set_config('finance.ar_native_cash_dates',(dates-NEW.id::text)::text,true);
            END IF;
          END IF;
        END IF;
        effective := coalesce(effective, (coalesce(observed,statement_timestamp()) AT TIME ZONE coalesce(zone,'UTC'))::date);
        INSERT INTO finance_ar_native_balance_changes(invoice_id,effective_on,delta) VALUES (NEW.id,effective,change)
          ON CONFLICT(invoice_id,effective_on) DO UPDATE SET delta=finance_ar_native_balance_changes.delta+excluded.delta;
        RETURN NULL;
      END $$;
      CREATE TRIGGER finance_ar_capture_balance AFTER INSERT OR UPDATE OF status,deleted_at,balance_amount,paid_amount,
        written_off_amount,total_amount,ar_adjustment ON invoices FOR EACH ROW EXECUTE FUNCTION finance_ar_capture_balance();

      -- Before native history existed, the dated source documents are the historical baseline.
      WITH companies AS (SELECT DISTINCT company_id FROM invoices), events AS (
        SELECT e.invoice_id,e.day,e.invoice_delta FROM companies c
        LEFT JOIN LATERAL (SELECT s.timezone FROM finance_operating_setups s WHERE s.company_id=c.company_id
          AND s.book_role='PRIMARY' AND s.withdrawn_at IS NULL ORDER BY s.activated_at DESC LIMIT 1) setup ON true
        CROSS JOIN LATERAL finance_ar_activity(c.company_id,coalesce(setup.timezone,'UTC')) e
        WHERE e.invoice_id IS NOT NULL AND e.day IS NOT NULL
      )
      INSERT INTO finance_ar_native_balance_changes(invoice_id,effective_on,delta)
        SELECT invoice_id,day,sum(invoice_delta) FROM events GROUP BY invoice_id,day HAVING sum(invoice_delta)<>0;

      -- A pre-existing difference is independently observable at cutover. Its original date is unknown.
      WITH baseline AS (SELECT invoice_id,sum(delta) position FROM finance_ar_native_balance_changes GROUP BY invoice_id),
      differences AS (SELECT i.id,i.company_id,finance_ar_native_position(i)-coalesce(b.position,0) delta
        FROM invoices i LEFT JOIN baseline b ON b.invoice_id=i.id)
      INSERT INTO finance_ar_native_balance_changes(invoice_id,effective_on,delta)
        SELECT d.id,(statement_timestamp() AT TIME ZONE coalesce(s.timezone,'UTC'))::date,d.delta FROM differences d
        LEFT JOIN LATERAL (SELECT timezone FROM finance_operating_setups WHERE company_id=d.company_id
          AND book_role='PRIMARY' AND withdrawn_at IS NULL ORDER BY activated_at DESC LIMIT 1) s ON true WHERE d.delta<>0
        ON CONFLICT(invoice_id,effective_on) DO UPDATE SET delta=finance_ar_native_balance_changes.delta+excluded.delta;
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_ar_native_balance_changes)
        THEN RAISE EXCEPTION 'Preserve the dated native invoice balance history before rollback.'; END IF; END $$;
      DROP TRIGGER finance_ar_capture_balance ON invoices;
      DROP TRIGGER finance_ar_mark_allocation_date ON receipt_allocations;
      DROP TRIGGER finance_ar_mark_refund_date ON finance_refunds;
      DROP FUNCTION finance_ar_capture_balance(),finance_ar_mark_cash_date(),finance_ar_native_position(invoices);
      DROP TABLE finance_ar_native_balance_changes;
    `);
  }
}
