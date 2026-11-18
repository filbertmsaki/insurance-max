import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive empty B43-B45 structures. No grants, currencies, policies or financial rows are seeded. */
export class FinanceLedgerFoundation1797200000000 implements MigrationInterface {
  name = 'FinanceLedgerFoundation1797200000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    for (const [table, constraint] of [
      ['finance_legal_entities', 'CK_fin_entity_state'],
      ['finance_accounting_books', 'CK_fin_book_state'],
    ]) {
      await q.query(`ALTER TABLE ${table} DROP CONSTRAINT "${constraint}"`);
      await q.query(
        `ALTER TABLE ${table} ADD CONSTRAINT "${constraint}" CHECK(state IN ('DRAFT','ACTIVE','DISABLED'))`,
      );
    }
    await q.query(`CREATE FUNCTION finance_foundation_limits_valid(limits jsonb,capability text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$ DECLARE entry record; BEGIN
      IF jsonb_typeof(limits)<>'object' THEN RETURN false; END IF;
      IF capability<>'ACCEPT' THEN RETURN limits='{}'::jsonb; END IF;
      IF limits='{}'::jsonb THEN RETURN false; END IF;
      FOR entry IN SELECT * FROM jsonb_each(limits) LOOP
        IF entry.key !~ '^[A-Z]{3}$' OR jsonb_typeof(entry.value)<>'string' OR (entry.value#>>'{}') !~ '^(0|[1-9][0-9]{0,25})([.][0-9]{1,12})?$' THEN RETURN false; END IF;
        IF (entry.value#>>'{}')::numeric<=0 THEN RETURN false; END IF;
      END LOOP;RETURN true;END $$`);
    await q.query(`CREATE TABLE finance_foundation_authorities(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,capability text NOT NULL CHECK(capability IN ('PREPARE','REVIEW','ACCEPT','READ','RELEASE')),
      company_role text NOT NULL CHECK(company_role IN ('COMPANY_ADMIN','FINANCE_OPERATOR')),authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),
      limits jsonb NOT NULL CHECK(finance_foundation_limits_valid(limits,capability)),
      valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),CHECK(capability<>'RELEASE' OR company_role='COMPANY_ADMIN'),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id),UNIQUE(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_identity_bindings(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),source_company_id uuid NOT NULL,source_user_id uuid NOT NULL,
      tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,
      authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,
      CHECK(valid_to IS NULL OR valid_to>valid_from),FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_documents(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      kind text NOT NULL CHECK(kind IN ('CURRENCY_CONTEXT','EXCHANGE_RATE','OPENING','B45_ACCEPTANCE','RELEASE')),mode text NOT NULL CHECK(mode IN ('VALIDATION','LIVE')),
      document_key text NOT NULL CHECK(btrim(document_key)<>''),version integer NOT NULL CHECK(version>0),parent_id uuid,
      payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
      maker_subject_id uuid NOT NULL,maker_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(tenant_id,legal_entity_id,book_id,id),UNIQUE(tenant_id,legal_entity_id,book_id,kind,mode,document_key,version),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,parent_id) REFERENCES finance_foundation_documents(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id) REFERENCES finance_foundation_authorities(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_decisions(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,document_id uuid NOT NULL UNIQUE,
      state text NOT NULL CHECK(state IN ('REVIEWED','APPROVED','REJECTED')),subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
      actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL,evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),
      reason text NOT NULL CHECK(btrim(reason)<>''),decision_hash text NOT NULL CHECK(decision_hash ~ '^[a-f0-9]{64}$'),recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,document_id) REFERENCES finance_foundation_documents(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id) REFERENCES finance_foundation_authorities(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_periods(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,mode text NOT NULL CHECK(mode IN ('VALIDATION','LIVE')),
      period_code text NOT NULL,starts_on date NOT NULL,ends_before date NOT NULL CHECK(ends_before>starts_on),state text NOT NULL CHECK(state IN ('OPEN','CLOSED')),revision integer NOT NULL CHECK(revision>0),
      UNIQUE(tenant_id,legal_entity_id,book_id,id),UNIQUE(tenant_id,legal_entity_id,book_id,mode,period_code),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_period_events(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,period_id uuid NOT NULL,revision integer NOT NULL,
      state text NOT NULL CHECK(state IN ('OPEN','CLOSED')),actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL,
      reason text NOT NULL CHECK(btrim(reason)<>''),evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(period_id,revision),FOREIGN KEY(tenant_id,legal_entity_id,book_id,period_id) REFERENCES finance_foundation_periods(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id) REFERENCES finance_foundation_authorities(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_journals(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),sequence bigint GENERATED ALWAYS AS IDENTITY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      mode text NOT NULL CHECK(mode IN ('VALIDATION','LIVE')),financial_effects integer NOT NULL CHECK((mode='VALIDATION' AND financial_effects=0) OR (mode='LIVE' AND financial_effects=1)),
      candidate_id uuid NOT NULL,candidate_hash text NOT NULL CHECK(candidate_hash ~ '^[a-f0-9]{64}$'),economic_key text NOT NULL CHECK(economic_key ~ '^[a-f0-9]{64}$'),kind text NOT NULL CHECK(kind IN ('ORIGINAL','REVERSAL')),
      reversal_of uuid,period_id uuid NOT NULL,period_revision integer NOT NULL,context_id uuid NOT NULL,context_hash text NOT NULL CHECK(context_hash ~ '^[a-f0-9]{64}$'),
      rate_id uuid,rate_hash text,transaction_date date NOT NULL,accounting_date date NOT NULL,transaction_currency text NOT NULL,functional_currency text NOT NULL,
      payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,legal_entity_id,book_id,id),UNIQUE(tenant_id,legal_entity_id,book_id,mode,candidate_id),UNIQUE(tenant_id,legal_entity_id,book_id,mode,economic_key,kind),
      CHECK((kind='REVERSAL')=(reversal_of IS NOT NULL)),CHECK((rate_id IS NULL)=(rate_hash IS NULL)),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,candidate_id) REFERENCES finance_journal_candidates(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,period_id) REFERENCES finance_foundation_periods(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,context_id) REFERENCES finance_foundation_documents(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,rate_id) REFERENCES finance_foundation_documents(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,reversal_of) REFERENCES finance_foundation_journals(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_lines(
      tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,journal_id uuid NOT NULL,line_key text NOT NULL,account_code text NOT NULL,role_code text NOT NULL,
      transaction_debit numeric(38,12) NOT NULL,transaction_credit numeric(38,12) NOT NULL,functional_debit numeric(38,12) NOT NULL,functional_credit numeric(38,12) NOT NULL,
      rounding_debit numeric(38,12) NOT NULL,rounding_credit numeric(38,12) NOT NULL,dimensions jsonb NOT NULL,
      PRIMARY KEY(journal_id,line_key),CHECK((transaction_debit>0 AND transaction_credit=0) OR (transaction_credit>0 AND transaction_debit=0)),
      CHECK((functional_debit>0 AND functional_credit=0) OR (functional_credit>0 AND functional_debit=0)),
      CHECK(transaction_debit<'Infinity'::numeric AND transaction_credit<'Infinity'::numeric AND functional_debit<'Infinity'::numeric AND functional_credit<'Infinity'::numeric AND abs(rounding_debit)<'Infinity'::numeric AND abs(rounding_credit)<'Infinity'::numeric),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,journal_id) REFERENCES finance_foundation_journals(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_journal_audits(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,journal_id uuid NOT NULL UNIQUE,
      actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL,subject_hash text NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,journal_id) REFERENCES finance_foundation_journals(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id) REFERENCES finance_foundation_authorities(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_foundation_deployments(
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),sequence bigint GENERATED ALWAYS AS IDENTITY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      action text NOT NULL CHECK(action IN ('ENABLE','DISABLE')),release_id uuid NOT NULL,release_hash text NOT NULL,actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL,
      reason text NOT NULL CHECK(btrim(reason)<>''),recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,release_id) REFERENCES finance_foundation_documents(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id) REFERENCES finance_foundation_authorities(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(
      `CREATE INDEX finance_foundation_journal_window ON finance_foundation_journals(tenant_id,legal_entity_id,book_id,mode,accounting_date,sequence)`,
    );
    await q.query(
      `CREATE FUNCTION finance_foundation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Foundation evidence is append-only'; END $$`,
    );
    for (const table of [
      'documents',
      'decisions',
      'period_events',
      'journals',
      'lines',
      'journal_audits',
      'deployments',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON finance_foundation_${table} FOR EACH ROW EXECUTE FUNCTION finance_foundation_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON finance_foundation_${table} FOR EACH STATEMENT EXECUTE FUNCTION finance_foundation_immutable()`,
      );
    }
    await q.query(`CREATE FUNCTION finance_foundation_mandate_fence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'revoked_at')=(to_jsonb(OLD)-'revoked_at') AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.revoked_at<=statement_timestamp() THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Foundation mandates/bindings are immutable except one-way revocation'; END $$`);
    for (const table of ['authorities', 'identity_bindings'])
      await q.query(
        `CREATE TRIGGER immutable_mandate BEFORE UPDATE OR DELETE ON finance_foundation_${table} FOR EACH ROW EXECUTE FUNCTION finance_foundation_mandate_fence()`,
      );
    await q.query(`CREATE FUNCTION finance_foundation_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE d record; a record; required_cap text; BEGIN
      SELECT * INTO d FROM finance_foundation_documents WHERE id=NEW.document_id FOR UPDATE;
      required_cap=CASE WHEN d.kind='RELEASE' THEN 'RELEASE' ELSE 'REVIEW' END;
      IF NEW.subject_hash<>d.subject_hash OR NEW.actor_subject_id=d.maker_subject_id OR NEW.actor_natural_person_id=d.maker_natural_person_id THEN RAISE EXCEPTION 'Independent review of the exact frozen subject is required'; END IF;
      IF (d.kind='RELEASE' AND NEW.state NOT IN ('APPROVED','REJECTED')) OR (d.kind<>'RELEASE' AND NEW.state NOT IN ('REVIEWED','REJECTED')) THEN RAISE EXCEPTION 'Review cannot invent release approval'; END IF;
      SELECT * INTO a FROM finance_foundation_authorities WHERE id=NEW.authority_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND subject_id=NEW.actor_subject_id AND natural_person_id=NEW.actor_natural_person_id AND capability=required_cap AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Current scoped review/release mandate required'; END IF;RETURN NEW;END $$`);
    await q.query(
      'CREATE TRIGGER review_guard BEFORE INSERT ON finance_foundation_decisions FOR EACH ROW EXECUTE FUNCTION finance_foundation_review_guard()',
    );
    await q.query(`CREATE FUNCTION finance_foundation_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      PERFORM 1 FROM finance_accounting_books WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND id=NEW.book_id FOR UPDATE;
      IF TG_OP='UPDATE' AND (NEW.revision<>OLD.revision+1 OR NEW.state=OLD.state OR (to_jsonb(NEW)-ARRAY['state','revision'])<>(to_jsonb(OLD)-ARRAY['state','revision'])) THEN RAISE EXCEPTION 'Period requires an exact next fence'; END IF;
      IF EXISTS(SELECT 1 FROM finance_foundation_periods WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND mode=NEW.mode AND id<>NEW.id AND starts_on<NEW.ends_before AND ends_before>NEW.starts_on) THEN RAISE EXCEPTION 'Ledger periods overlap'; END IF;RETURN NEW;END $$`);
    await q.query(
      'CREATE TRIGGER period_guard BEFORE INSERT OR UPDATE ON finance_foundation_periods FOR EACH ROW EXECUTE FUNCTION finance_foundation_period_guard()',
    );
    await q.query(
      'CREATE TRIGGER period_no_delete BEFORE DELETE OR TRUNCATE ON finance_foundation_periods FOR EACH STATEMENT EXECUTE FUNCTION finance_foundation_immutable()',
    );
    await q.query(`CREATE FUNCTION finance_foundation_period_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM finance_foundation_period_events e JOIN finance_foundation_authorities a ON a.id=e.authority_id WHERE e.period_id=NEW.id AND e.revision=NEW.revision AND e.state=NEW.state AND a.capability IN ('REVIEW','RELEASE') AND a.subject_id=e.actor_subject_id AND a.natural_person_id=e.actor_natural_person_id AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp())) THEN RAISE EXCEPTION 'Period fence requires atomic current-authority audit'; END IF;RETURN NULL;END $$`);
    await q.query(
      'CREATE CONSTRAINT TRIGGER period_commit AFTER INSERT OR UPDATE ON finance_foundation_periods DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_foundation_period_commit()',
    );
    await q.query(`CREATE FUNCTION finance_foundation_line_fence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      PERFORM 1 FROM finance_foundation_journals WHERE id=NEW.journal_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Journal header is not available in this transaction'; END IF;
      IF EXISTS(SELECT 1 FROM finance_foundation_journal_audits WHERE journal_id=NEW.journal_id) THEN RAISE EXCEPTION 'Accepted journal lines are sealed'; END IF;RETURN NEW;END $$`);
    await q.query(
      'CREATE TRIGGER line_fence BEFORE INSERT ON finance_foundation_lines FOR EACH ROW EXECUTE FUNCTION finance_foundation_line_fence()',
    );
    await q.query(`CREATE FUNCTION finance_foundation_journal_commit() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE n integer; dr numeric; cr numeric; fd numeric; fc numeric; p record; BEGIN
      SELECT count(*),sum(transaction_debit),sum(transaction_credit),sum(functional_debit),sum(functional_credit) INTO n,dr,cr,fd,fc FROM finance_foundation_lines WHERE journal_id=NEW.id;
      IF n<2 OR dr<>cr OR fd<>fc OR dr<=0 OR fd<=0 THEN RAISE EXCEPTION 'Both journal currency vectors must balance independently'; END IF;
      SELECT * INTO p FROM finance_foundation_periods WHERE id=NEW.period_id FOR SHARE;
      IF p.state<>'OPEN' OR p.revision<>NEW.period_revision OR p.mode<>NEW.mode OR NEW.accounting_date<p.starts_on OR NEW.accounting_date>=p.ends_before THEN RAISE EXCEPTION 'Journal period is fenced or out of range'; END IF;
      IF NOT EXISTS(SELECT 1 FROM finance_foundation_journal_audits e JOIN finance_foundation_authorities a ON a.id=e.authority_id JOIN finance_journal_candidates c ON c.id=NEW.candidate_id WHERE e.journal_id=NEW.id AND e.subject_hash=NEW.subject_hash AND a.capability='ACCEPT' AND a.limits ? NEW.transaction_currency AND (a.limits->>NEW.transaction_currency)::numeric>=dr AND a.subject_id=e.actor_subject_id AND a.natural_person_id=e.actor_natural_person_id AND c.state='VALIDATED_INACTIVE' AND c.currency=NEW.transaction_currency AND c.subject_hash=NEW.candidate_hash AND c.accounting_date=NEW.accounting_date AND c.maker_natural_person_id<>e.actor_natural_person_id AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp())) THEN RAISE EXCEPTION 'Journal requires current independent acceptance audit'; END IF;
      IF NEW.mode='LIVE' AND NOT EXISTS(SELECT 1 FROM finance_foundation_deployments d JOIN finance_foundation_documents r ON r.id=d.release_id JOIN finance_foundation_decisions a ON a.document_id=r.id WHERE d.tenant_id=NEW.tenant_id AND d.legal_entity_id=NEW.legal_entity_id AND d.book_id=NEW.book_id AND d.sequence=(SELECT max(sequence) FROM finance_foundation_deployments WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id) AND d.action='ENABLE' AND r.parent_id=NEW.context_id AND a.state='APPROVED') THEN RAISE EXCEPTION 'Company-admin deployment approval required for live effects'; END IF;
      RETURN NULL;END $$`);
    await q.query(
      'CREATE CONSTRAINT TRIGGER journal_commit AFTER INSERT ON finance_foundation_journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_foundation_journal_commit()',
    );
    await q.query(`CREATE FUNCTION finance_foundation_policy_release(policy_id uuid,policy_hash text,evidence_hash text) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM finance_foundation_documents r JOIN finance_foundation_decisions d ON d.document_id=r.id JOIN finance_policy_versions p ON p.id=$1 WHERE r.kind='RELEASE' AND r.mode='LIVE' AND d.state='APPROVED' AND r.tenant_id=p.tenant_id AND r.legal_entity_id=p.legal_entity_id AND r.book_id=p.book_id AND r.payload->>'acceptanceHash'=$3 AND r.payload->'policyPins' @> jsonb_build_array(jsonb_build_object('id',$1::text,'hash',$2))) $$`);
    const [{ definition }] = await q.query(
      "SELECT pg_get_functiondef('finance_policy_check_event()'::regprocedure) AS definition",
    );
    const old = "IF NEW.action='ACTIVATE' AND NOT EXISTS",
      replacement =
        "IF NEW.action='ACTIVATE' AND NOT finance_foundation_policy_release(NEW.policy_id,p.definition_hash,NEW.evidence_hash) AND NOT EXISTS";
    if (!definition.includes(old) || definition.includes(replacement))
      throw new Error(
        'Unexpected policy guard definition; refusing ambiguous migration.',
      );
    await q.query(definition.replace(old, replacement));
    await q.query(`CREATE FUNCTION finance_foundation_deployment_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE r record; a record; BEGIN
      SELECT d.*,e.state INTO r FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.tenant_id=NEW.tenant_id AND d.legal_entity_id=NEW.legal_entity_id AND d.book_id=NEW.book_id AND d.id=NEW.release_id;
      IF NOT FOUND OR r.kind<>'RELEASE' OR r.mode<>'LIVE' OR r.state<>'APPROVED' OR r.subject_hash<>NEW.release_hash OR r.maker_natural_person_id=NEW.actor_natural_person_id THEN RAISE EXCEPTION 'Exact independently approved company-admin release required'; END IF;
      SELECT * INTO a FROM finance_foundation_authorities WHERE id=NEW.authority_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND subject_id=NEW.actor_subject_id AND natural_person_id=NEW.actor_natural_person_id AND capability='RELEASE' AND company_role='COMPANY_ADMIN' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Current company-admin deployment mandate required'; END IF;RETURN NEW;END $$`);
    await q.query(
      'CREATE TRIGGER deployment_guard BEFORE INSERT ON finance_foundation_deployments FOR EACH ROW EXECUTE FUNCTION finance_foundation_deployment_guard()',
    );
    await q.query(`CREATE FUNCTION finance_foundation_live_commit() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE ctx record; p record; pin jsonb; r record; required text[]; found_codes text[] := ARRAY[]::text[]; BEGIN
      IF NEW.mode<>'LIVE' THEN RETURN NULL; END IF;
      SELECT d.*,e.state INTO ctx FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.id=NEW.context_id;
      IF NOT FOUND OR ctx.kind<>'CURRENCY_CONTEXT' OR ctx.state<>'REVIEWED' OR ctx.subject_hash<>NEW.context_hash OR ctx.payload->>'functionalCurrency'<>NEW.functional_currency OR jsonb_array_length(ctx.payload->'unresolvedDecisions')<>0 THEN RAISE EXCEPTION 'Reviewed exact currency context without unresolved decisions required'; END IF;
      required=ARRAY['AP-01.01','AP-02.01','AP-03.01','AP-04.01','AP-05.01','AP-06.01','AP-06.02','AP-33.01','AP-20.01','AP-31.01','AP-32.01'];
      IF EXISTS(SELECT 1 FROM jsonb_object_keys(ctx.payload->'currencyScales') c WHERE c<>ctx.payload->>'functionalCurrency') THEN required=array_append(required,'AP-20.04'); END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(ctx.payload->'allowedComponents') c WHERE c->>'sourceEventType' IS NULL) THEN required=array_append(required,'AP-04.02'); END IF;
      FOR pin IN SELECT value FROM jsonb_array_elements(ctx.payload->'allowedComponents') LOOP required=array_append(required,pin->>'policyCode'); END LOOP;
      FOR pin IN SELECT value FROM jsonb_array_elements(ctx.payload->'policyPins') LOOP
        SELECT v.*,e.to_state INTO p FROM finance_policy_versions v JOIN LATERAL(SELECT to_state FROM finance_policy_events WHERE policy_id=v.id ORDER BY sequence DESC LIMIT 1)e ON true WHERE v.id::text=pin->>'id' AND v.tenant_id=NEW.tenant_id AND v.legal_entity_id=NEW.legal_entity_id AND v.book_id=NEW.book_id FOR SHARE OF v;
        IF NOT FOUND OR p.definition_hash<>pin->>'hash' OR p.to_state<>'ACTIVE' OR p.profile='PLATFORM_TEMPLATE' OR jsonb_array_length(p.definition->'unresolvedDecisions')<>0 OR (p.definition->>'effectiveFrom')::date>NEW.accounting_date OR ((p.definition->>'effectiveTo') IS NOT NULL AND (p.definition->>'effectiveTo')::date<=NEW.accounting_date) THEN RAISE EXCEPTION 'Every exact company policy must be explicitly approved and active'; END IF;
        found_codes=array_append(found_codes,p.policy_code);
      END LOOP;
      IF NOT(required<@found_codes) THEN RAISE EXCEPTION 'Mandatory foundation policies are missing'; END IF;
      SELECT d.payload INTO r FROM finance_foundation_deployments x JOIN finance_foundation_documents d ON d.id=x.release_id JOIN finance_accounting_books b ON b.tenant_id=x.tenant_id AND b.legal_entity_id=x.legal_entity_id AND b.id=x.book_id JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id WHERE x.tenant_id=NEW.tenant_id AND x.legal_entity_id=NEW.legal_entity_id AND x.book_id=NEW.book_id AND x.sequence=(SELECT max(sequence) FROM finance_foundation_deployments WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id) AND x.action='ENABLE' AND b.state='ACTIVE' AND l.state='ACTIVE';
      IF NOT FOUND OR NEW.accounting_date<(r.payload->>'activeFrom')::date OR NEW.accounting_date>=(r.payload->>'activeTo')::date OR statement_timestamp()::date<(r.payload->>'activeFrom')::date OR statement_timestamp()::date>=(r.payload->>'activeTo')::date THEN RAISE EXCEPTION 'Live posting is outside the explicit deployment interval'; END IF;
      IF NOT EXISTS(SELECT 1 FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.id::text=r.payload->>'openingId' AND d.subject_hash=r.payload->>'openingHash' AND d.parent_id=NEW.context_id AND d.kind='OPENING' AND d.mode='LIVE' AND e.state='REVIEWED' AND d.payload->>'date'=r.payload->>'activeFrom' AND d.payload->>'sourceEvidenceHash'=r.payload->>'sourceReconciliationHash') THEN RAISE EXCEPTION 'The exact reconciled cutover opening must be certified before live posting'; END IF;
      RETURN NULL;END $$`);
    await q.query(
      'CREATE CONSTRAINT TRIGGER live_commit AFTER INSERT ON finance_foundation_journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_foundation_live_commit()',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const tables = [
      'deployments',
      'journal_audits',
      'lines',
      'journals',
      'period_events',
      'periods',
      'decisions',
      'documents',
      'identity_bindings',
      'authorities',
    ];
    for (const table of tables) {
      const [{ n }] = await q.query(
        `SELECT count(*)::integer n FROM finance_foundation_${table}`,
      );
      if (n)
        throw new Error(
          'Foundation evidence exists; destructive rollback is forbidden.',
        );
    }
    const [{ definition }] = await q.query(
      "SELECT pg_get_functiondef('finance_policy_check_event()'::regprocedure) AS definition",
    );
    const added =
      "IF NEW.action='ACTIVATE' AND NOT finance_foundation_policy_release(NEW.policy_id,p.definition_hash,NEW.evidence_hash) AND NOT EXISTS";
    if (!definition.includes(added))
      throw new Error(
        'Policy guard changed; rollback requires reviewed repair.',
      );
    await q.query(
      definition.replace(added, "IF NEW.action='ACTIVATE' AND NOT EXISTS"),
    );
    for (const table of tables)
      await q.query(`DROP TABLE finance_foundation_${table}`);
    for (const fn of [
      'finance_foundation_live_commit()',
      'finance_foundation_limits_valid(jsonb,text)',
      'finance_foundation_deployment_guard()',
      'finance_foundation_policy_release(uuid,text,text)',
      'finance_foundation_journal_commit()',
      'finance_foundation_line_fence()',
      'finance_foundation_period_commit()',
      'finance_foundation_period_guard()',
      'finance_foundation_review_guard()',
      'finance_foundation_mandate_fence()',
      'finance_foundation_immutable()',
    ])
      await q.query(`DROP FUNCTION ${fn}`);
    for (const [table, constraint] of [
      ['finance_legal_entities', 'CK_fin_entity_state'],
      ['finance_accounting_books', 'CK_fin_book_state'],
    ]) {
      await q.query(`ALTER TABLE ${table} DROP CONSTRAINT "${constraint}"`);
      await q.query(
        `ALTER TABLE ${table} ADD CONSTRAINT "${constraint}" CHECK(state IN ('DRAFT','DISABLED'))`,
      );
    }
  }
}
