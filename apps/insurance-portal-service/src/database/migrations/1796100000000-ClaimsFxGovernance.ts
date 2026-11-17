import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive Claims FX records; no legacy rate is treated as verified. */
export class ClaimsFxGovernance1796100000000 implements MigrationInterface {
  name = 'ClaimsFxGovernance1796100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE claim_fx_rates (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id uuid NOT NULL REFERENCES companies(id),
      transaction_currency varchar(3) NOT NULL CHECK (transaction_currency ~ '^[A-Z]{3}$'),
      functional_currency varchar(3) NOT NULL CHECK (functional_currency ~ '^[A-Z]{3}$'),
      rate numeric(24,10) NOT NULL CHECK (rate > 0),
      direction varchar(40) NOT NULL CHECK (direction = 'TRANSACTION_TO_FUNCTIONAL_MULTIPLY'),
      effective_date date NOT NULL,
      source_type varchar(20) NOT NULL CHECK (source_type = 'MANUAL'),
      source_reference text NOT NULL CHECK (length(trim(source_reference)) > 0),
      justification text NOT NULL CHECK (length(trim(justification)) > 0),
      status varchar(20) NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','SUPERSEDED')),
      created_by uuid NOT NULL, submitted_by uuid, decided_by uuid,
      submitted_at timestamptz, decided_at timestamptz, rejection_reason text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_claim_fx_rate_company_id UNIQUE (company_id, id),
      CONSTRAINT chk_claim_fx_different_currencies CHECK (transaction_currency <> functional_currency),
      CONSTRAINT chk_claim_fx_checker CHECK (status <> 'APPROVED' OR
        (decided_by IS NOT NULL AND submitted_by IS NOT NULL AND decided_by <> created_by AND decided_by <> submitted_by AND decided_at IS NOT NULL))
    )`);
    await q.query(`CREATE INDEX idx_claim_fx_rate_selection ON claim_fx_rates
      (company_id, transaction_currency, functional_currency, status, effective_date DESC, decided_at DESC, id)`);
    await q.query(`CREATE FUNCTION guard_claim_fx_rate_history() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Claims FX rates cannot be deleted'; END IF;
        IF OLD.status <> 'DRAFT' AND
          (NEW.company_id, NEW.transaction_currency, NEW.functional_currency, NEW.rate, NEW.direction,
           NEW.effective_date, NEW.source_type, NEW.source_reference, NEW.justification, NEW.created_by,
           NEW.submitted_by, NEW.submitted_at) IS DISTINCT FROM
          (OLD.company_id, OLD.transaction_currency, OLD.functional_currency, OLD.rate, OLD.direction,
           OLD.effective_date, OLD.source_type, OLD.source_reference, OLD.justification, OLD.created_by,
           OLD.submitted_by, OLD.submitted_at)
        THEN RAISE EXCEPTION 'Submitted Claims FX terms are immutable'; END IF;
        IF OLD.status IN ('APPROVED','REJECTED','SUPERSEDED') THEN
          RAISE EXCEPTION 'Decided Claims FX rates are immutable';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql`);
    await q.query(
      `CREATE TRIGGER claim_fx_rates_history BEFORE UPDATE OR DELETE ON claim_fx_rates FOR EACH ROW EXECUTE FUNCTION guard_claim_fx_rate_history()`,
    );
    await q.query(`CREATE TABLE claim_fx_rate_audit (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), company_id uuid NOT NULL,
      rate_id uuid NOT NULL, action varchar(20) NOT NULL, actor_id uuid NOT NULL,
      details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY (company_id, rate_id) REFERENCES claim_fx_rates(company_id, id)
    )`);
    await q.query(
      `CREATE UNIQUE INDEX uq_claims_company_id_fx ON claims (company_id, id)`,
    );
    await q.query(`CREATE TABLE claim_fx_snapshots (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), company_id uuid NOT NULL,
      claim_id uuid NOT NULL, event_type varchar(60) NOT NULL, event_id uuid NOT NULL,
      transaction_currency varchar(3) NOT NULL, functional_currency varchar(3) NOT NULL,
      approved_rate_id uuid, rate numeric(24,10) NOT NULL CHECK (rate > 0),
      direction varchar(40) NOT NULL, source_type varchar(20) NOT NULL,
      source_reference text, effective_date date NOT NULL,
      original_amount numeric(24,2) NOT NULL, converted_amount numeric(24,2) NOT NULL,
      rounding_basis varchar(30) NOT NULL, version integer NOT NULL CHECK (version > 0),
      supersedes_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (company_id, claim_id, event_type, event_id, version),
      UNIQUE (company_id, id),
      FOREIGN KEY (company_id, claim_id) REFERENCES claims(company_id, id),
      FOREIGN KEY (company_id, approved_rate_id) REFERENCES claim_fx_rates(company_id, id),
      FOREIGN KEY (company_id, supersedes_id) REFERENCES claim_fx_snapshots(company_id, id),
      CHECK ((transaction_currency = functional_currency AND rate = 1 AND approved_rate_id IS NULL AND source_type = 'PARITY') OR
             (transaction_currency <> functional_currency AND approved_rate_id IS NOT NULL AND source_type = 'MANUAL'))
    )`);
    await q.query(`CREATE FUNCTION reject_claim_fx_history_mutation() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Claims FX history is immutable'; END; $$ LANGUAGE plpgsql`);
    await q.query(
      `CREATE TRIGGER claim_fx_snapshots_immutable BEFORE UPDATE OR DELETE ON claim_fx_snapshots FOR EACH ROW EXECUTE FUNCTION reject_claim_fx_history_mutation()`,
    );
    await q.query(
      `CREATE TRIGGER claim_fx_audit_immutable BEFORE UPDATE OR DELETE ON claim_fx_rate_audit FOR EACH ROW EXECUTE FUNCTION reject_claim_fx_history_mutation()`,
    );
    for (const action of [
      'view',
      'create',
      'submit',
      'approve',
      'history',
      'correct',
    ]) {
      await q.query(
        `INSERT INTO permissions (id, name, display_name, description, is_system_generated, assignment_scope, assignable_to_company_role, assignable_to_platform_role, is_deprecated)
        VALUES (uuid_generate_v4(), $1, $2, $3, true, 'shared', true, true, false) ON CONFLICT (name) DO NOTHING`,
        [`claims.fx.${action}`, `Claims FX: ${action}`, `Claims FX: ${action}`],
      );
    }
  }

  async down(_q: QueryRunner): Promise<void> {
    // Financial evidence and grants must not be silently deleted on rollback.
    throw new Error(
      'Claims FX governance is forward-only; use an audited corrective migration',
    );
  }
}
