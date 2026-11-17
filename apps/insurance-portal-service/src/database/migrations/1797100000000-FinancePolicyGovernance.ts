import { MigrationInterface, QueryRunner } from 'typeorm';

/** Empty governance registries only. Does not approve, activate or migrate money. */
export class FinancePolicyGovernance1797100000000 implements MigrationInterface {
  name = 'FinancePolicyGovernance1797100000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE finance_policy_authorities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      subject_id uuid NOT NULL, natural_person_id uuid NOT NULL, company_role text NOT NULL CHECK(company_role IN ('COMPANY_ADMIN','FINANCE_POLICY_PREPARER','FINANCE_POLICY_VALIDATOR')),
      capability text NOT NULL CHECK(capability IN ('PREPARE','VALIDATE','APPROVE','ACTIVATE')), authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),
      valid_from timestamptz NOT NULL, valid_to timestamptz, revoked_at timestamptz,
      CHECK(valid_to IS NULL OR valid_to>valid_from),
      CHECK(company_role='COMPANY_ADMIN' OR (company_role='FINANCE_POLICY_PREPARER' AND capability='PREPARE') OR (company_role='FINANCE_POLICY_VALIDATOR' AND capability='VALIDATE')),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id)
    )`);
    await q.query(`CREATE TABLE finance_policy_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      policy_code text NOT NULL CHECK(policy_code ~ '^AP-[0-9]{2}\\.[0-9]{2}$'), version integer NOT NULL CHECK(version>0),
      profile text NOT NULL CHECK(profile IN ('PLATFORM_TEMPLATE','INSURER','BROKER','REINSURER','OTHER')),
      definition jsonb NOT NULL, definition_hash text NOT NULL CHECK(definition_hash ~ '^[0-9a-f]{64}$'),
      maker_subject_id uuid NOT NULL, maker_natural_person_id uuid NOT NULL, authority_id uuid NOT NULL REFERENCES finance_policy_authorities(id),
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,legal_entity_id,book_id,policy_code,profile,version), UNIQUE(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id)
    )`);
    await q.query(`CREATE TABLE finance_policy_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      policy_id uuid NOT NULL, sequence integer NOT NULL CHECK(sequence>0), from_state text NOT NULL, to_state text NOT NULL,
      action text NOT NULL, actor_subject_id uuid NOT NULL, actor_natural_person_id uuid NOT NULL,
      authority_id uuid NOT NULL REFERENCES finance_policy_authorities(id), reason text NOT NULL CHECK(btrim(reason)<>''),
      evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'), previous_hash text NOT NULL CHECK(previous_hash ~ '^[0-9a-f]{64}$'),
      event_hash text NOT NULL CHECK(event_hash ~ '^[0-9a-f]{64}$'), recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK(from_state IN ('DRAFT','CONFIGURED','VALIDATED','APPROVED','ACTIVE','BLOCKED_PENDING_APPROVAL','RETIRED','NOT_APPLICABLE')),
      CHECK(to_state IN ('CONFIGURED','VALIDATED','APPROVED','ACTIVE','BLOCKED_PENDING_APPROVAL','RETIRED','NOT_APPLICABLE')),
      UNIQUE(policy_id,sequence), FOREIGN KEY(tenant_id,legal_entity_id,book_id,policy_id) REFERENCES finance_policy_versions(tenant_id,legal_entity_id,book_id,id)
    )`);
    // A policy approval alone cannot create this release. The deployment/cutover
    // authority adapter is intentionally absent until B43-B45 acceptance.
    await q.query(`CREATE TABLE finance_policy_posting_releases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      policy_id uuid NOT NULL, policy_hash text NOT NULL CHECK(policy_hash ~ '^[0-9a-f]{64}$'),
      source_company_id uuid NOT NULL, source_types text[] NOT NULL CHECK(cardinality(source_types)>0),
      basis text NOT NULL CHECK(basis='OPERATIONAL_BRIDGE'), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
      functional_currency text NOT NULL CHECK(functional_currency ~ '^[A-Z]{3}$'),
      period_start date NOT NULL, period_end date NOT NULL, active_from date NOT NULL, active_to date NOT NULL,
      b43_evidence_hash text NOT NULL CHECK(b43_evidence_hash ~ '^[0-9a-f]{64}$'), b44_evidence_hash text NOT NULL CHECK(b44_evidence_hash ~ '^[0-9a-f]{64}$'),
      b45_evidence_hash text NOT NULL CHECK(b45_evidence_hash ~ '^[0-9a-f]{64}$'),
      activation_authority_reference text NOT NULL CHECK(btrim(activation_authority_reference)<>''),
      released_at timestamptz NOT NULL DEFAULT statement_timestamp(), CHECK(period_end>period_start AND active_to>active_from AND active_from>=released_at::date),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,policy_id) REFERENCES finance_policy_versions(tenant_id,legal_entity_id,book_id,id)
    )`);
    await q.query(
      `CREATE FUNCTION finance_policy_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Policy definitions, decisions and release evidence are append-only'; END $$`,
    );
    await q.query(`CREATE FUNCTION finance_policy_check_event() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE p record; a record; prior record; current_state text; permission text;
      BEGIN
        SELECT * INTO p FROM finance_policy_versions WHERE id=NEW.policy_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Policy version unavailable'; END IF;
        SELECT * INTO prior FROM finance_policy_events WHERE policy_id=NEW.policy_id ORDER BY sequence DESC LIMIT 1;
        current_state=coalesce(prior.to_state,'DRAFT');
        IF NEW.from_state<>current_state OR NEW.sequence<>coalesce(prior.sequence,0)+1 OR NEW.previous_hash<>coalesce(prior.event_hash,p.definition_hash) THEN RAISE EXCEPTION 'Stale policy state, sequence or audit-chain reference'; END IF;
        IF NOT ((NEW.action='CONFIGURE' AND current_state='DRAFT' AND NEW.to_state='CONFIGURED') OR
          (NEW.action='VALIDATE' AND current_state='CONFIGURED' AND NEW.to_state='VALIDATED') OR
          (NEW.action='APPROVE' AND current_state='VALIDATED' AND NEW.to_state='APPROVED') OR
          (NEW.action='ACTIVATE' AND current_state='APPROVED' AND NEW.to_state='ACTIVE') OR
          (NEW.action='BLOCK' AND current_state IN ('DRAFT','CONFIGURED','VALIDATED','APPROVED') AND NEW.to_state='BLOCKED_PENDING_APPROVAL') OR
          (NEW.action='DEACTIVATE' AND current_state='ACTIVE' AND NEW.to_state='RETIRED') OR
          (NEW.action='RETIRE' AND current_state IN ('DRAFT','CONFIGURED','VALIDATED','APPROVED','BLOCKED_PENDING_APPROVAL') AND NEW.to_state='RETIRED') OR
          (NEW.action='NOT_APPLICABLE' AND current_state IN ('DRAFT','CONFIGURED','BLOCKED_PENDING_APPROVAL') AND NEW.to_state='NOT_APPLICABLE')) THEN RAISE EXCEPTION 'Invalid policy lifecycle transition'; END IF;
        permission=CASE WHEN NEW.action IN ('APPROVE','RETIRE','NOT_APPLICABLE') THEN 'APPROVE' WHEN NEW.action IN ('ACTIVATE','DEACTIVATE') THEN 'ACTIVATE' WHEN NEW.action='VALIDATE' THEN 'VALIDATE' ELSE 'PREPARE' END;
        SELECT * INTO a FROM finance_policy_authorities WHERE id=NEW.authority_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND subject_id=NEW.actor_subject_id AND natural_person_id=NEW.actor_natural_person_id AND company_role IN ('COMPANY_ADMIN','FINANCE_POLICY_PREPARER','FINANCE_POLICY_VALIDATOR') AND capability=permission AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Current scoped company-admin authority required'; END IF;
        IF NEW.action IN ('VALIDATE','APPROVE','ACTIVATE','DEACTIVATE','RETIRE','NOT_APPLICABLE') AND (p.maker_subject_id=NEW.actor_subject_id OR p.maker_natural_person_id=NEW.actor_natural_person_id) THEN RAISE EXCEPTION 'Independent natural-person review required'; END IF;
        IF NEW.action IN ('VALIDATE','APPROVE','ACTIVATE') AND (jsonb_array_length(p.definition->'unresolvedDecisions')<>0 OR jsonb_array_length(p.definition->'evidenceReferences')=0) THEN RAISE EXCEPTION 'Policy decision or required evidence is unresolved'; END IF;
        IF NEW.action='ACTIVATE' AND NOT EXISTS (SELECT 1 FROM finance_policy_posting_releases r JOIN finance_accounting_books b ON b.tenant_id=r.tenant_id AND b.legal_entity_id=r.legal_entity_id AND b.id=r.book_id JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id WHERE r.policy_id=p.id AND r.policy_hash=p.definition_hash AND r.b45_evidence_hash=NEW.evidence_hash AND p.profile<>'PLATFORM_TEMPLATE' AND b.state='ACTIVE' AND l.state='ACTIVE') THEN RAISE EXCEPTION 'Accepted active book and B43-B45 release required'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(
      'CREATE TRIGGER finance_policy_events_check BEFORE INSERT ON finance_policy_events FOR EACH ROW EXECUTE FUNCTION finance_policy_check_event()',
    );
    await q.query(`CREATE FUNCTION finance_policy_check_authority() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'revoked_at')=(to_jsonb(OLD)-'revoked_at') AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.revoked_at<=statement_timestamp() THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Policy mandates are immutable except one-way revocation';
    END $$`);
    await q.query(
      'CREATE TRIGGER finance_policy_authorities_check BEFORE UPDATE OR DELETE ON finance_policy_authorities FOR EACH ROW EXECUTE FUNCTION finance_policy_check_authority()',
    );
    for (const table of [
      'finance_policy_versions',
      'finance_policy_events',
      'finance_policy_posting_releases',
    ])
      await q.query(
        `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION finance_policy_immutable()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'finance_policy_events',
      'finance_policy_posting_releases',
      'finance_policy_versions',
      'finance_policy_authorities',
    ]) {
      const [{ count }] = await q.query(
        `SELECT count(*)::text AS count FROM ${table}`,
      );
      if (count !== '0')
        throw new Error(
          'Governance evidence exists; destructive rollback is forbidden.',
        );
    }
    for (const table of [
      'finance_policy_events',
      'finance_policy_posting_releases',
      'finance_policy_versions',
      'finance_policy_authorities',
    ])
      await q.query(`DROP TABLE ${table}`);
    await q.query('DROP FUNCTION finance_policy_immutable()');
    await q.query('DROP FUNCTION finance_policy_check_event()');
    await q.query('DROP FUNCTION finance_policy_check_authority()');
  }
}
