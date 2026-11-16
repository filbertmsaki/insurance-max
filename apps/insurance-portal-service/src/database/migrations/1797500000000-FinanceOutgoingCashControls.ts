import { MigrationInterface, QueryRunner } from 'typeorm';

const tables = [
  'finance_outgoing_authorities',
  'finance_outgoing_evidence',
  'finance_outgoing_aliases',
  'finance_outgoing_intents',
  'finance_outgoing_events',
  'finance_outgoing_calls',
  'finance_outgoing_observations',
  'finance_outgoing_audits',
];
const scope =
  'tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL';
const book =
  'FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT';
const content =
  "subject jsonb NOT NULL,canonical_subject text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash~'^[a-f0-9]{64}$'),CHECK(canonical_subject::jsonb=subject),CHECK(subject_hash=encode(sha256(convert_to(canonical_subject,'UTF8')),'hex')),CHECK(octet_length(canonical_subject)<=262144)";
const scopedId = 'UNIQUE(tenant_id,legal_entity_id,book_id,id)';
const actor =
  'actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL REFERENCES finance_outgoing_authorities(id) ON DELETE RESTRICT';
const evidenceRef = (column: string) =>
  `FOREIGN KEY(tenant_id,legal_entity_id,book_id,${column}) REFERENCES finance_outgoing_evidence(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT`;
const intentRef =
  'FOREIGN KEY(tenant_id,legal_entity_id,book_id,intent_id) REFERENCES finance_outgoing_intents(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT';
/** Inactive registries only. No source-company grants, providers, policies or balances are seeded. */
export class FinanceOutgoingCashControls1797500000000 implements MigrationInterface {
  name = 'FinanceOutgoingCashControls1797500000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE finance_outgoing_authorities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),${scope},subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,
      permission text NOT NULL CHECK(permission IN ('OBSERVE_CASH','PREPARE_PAYMENT','REVIEW_PAYMENT','RESERVE_CASH','EXECUTE_SIMULATION','RECONCILE_CASH','READ_CASH')),
      currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),max_amount numeric(30,12) NOT NULL CHECK(max_amount>=0),
      lease_seconds integer NOT NULL CHECK(lease_seconds BETWEEN 1 AND 3600),state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),
      authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),valid_from timestamptz NOT NULL,valid_to timestamptz NOT NULL,revoked_at timestamptz,
      CHECK(valid_to>valid_from),${book})`);
    await q.query(`CREATE TABLE finance_outgoing_evidence(id uuid PRIMARY KEY,${scope},kind text NOT NULL CHECK(kind IN ('FUNDING','OBLIGATION','BANK_PAYMENT')),
      source_company_id uuid NOT NULL,source_account_id uuid NOT NULL,currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),
      economic_key text NOT NULL CHECK(economic_key~'^[a-f0-9]{64}$'),vector_hash text NOT NULL CHECK(vector_hash~'^[a-f0-9]{64}$'),
      profile_id uuid NOT NULL,profile_hash text NOT NULL,inbox_id uuid NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,economic_key),${scopedId},${book},FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,profile_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(
      "CREATE UNIQUE INDEX UQ_fin_outgoing_funding_owner ON finance_outgoing_evidence(tenant_id,source_company_id,source_account_id,currency) WHERE kind='FUNDING'",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_fin_outgoing_obligation_owner ON finance_outgoing_evidence(tenant_id,source_company_id,((subject->'snapshot'->>'obligationId'))) WHERE kind='OBLIGATION'",
    );
    await q.query(`CREATE TABLE finance_outgoing_aliases(id uuid PRIMARY KEY,${scope},evidence_id uuid NOT NULL,inbox_id uuid NOT NULL,state text NOT NULL CHECK(state IN ('MATCHED','CONFLICT_HELD')),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,legal_entity_id,book_id,inbox_id),${scopedId},${book},${evidenceRef('evidence_id')},
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_outgoing_intents(id uuid PRIMARY KEY,${scope},command_key text NOT NULL CHECK(length(command_key) BETWEEN 1 AND 150),funding_id uuid NOT NULL,obligation_id uuid NOT NULL,
      currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),
      amount numeric(30,12) NOT NULL CHECK(amount>0),maximum_fee numeric(30,12) NOT NULL CHECK(maximum_fee>=0),beneficiary_hash text NOT NULL CHECK(beneficiary_hash~'^[a-f0-9]{64}$'),
      execution_key text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK((amount=round(amount,decimal_scale) AND maximum_fee=round(maximum_fee,decimal_scale)) IS TRUE),
      UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${scopedId},${book},${evidenceRef('funding_id')},${evidenceRef('obligation_id')})`);
    await q.query(`CREATE TABLE finance_outgoing_events(id uuid PRIMARY KEY,${scope},intent_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('APPROVE','REJECT','RESERVE','CANCEL','DISCHARGE_REVIEW','RECONCILE')),
      command_key text NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(intent_id,action),UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${scopedId},${book},${intentRef})`);
    await q.query(
      "CREATE UNIQUE INDEX UQ_fin_outgoing_decision ON finance_outgoing_events(intent_id) WHERE action IN ('APPROVE','REJECT')",
    );
    await q.query(`CREATE TABLE finance_outgoing_calls(id uuid PRIMARY KEY,${scope},intent_id uuid NOT NULL,operation text NOT NULL CHECK(operation IN ('SUBMIT','QUERY')),
      lease_until timestamptz NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${scopedId},${book},${intentRef})`);
    await q.query(
      "CREATE UNIQUE INDEX UQ_fin_outgoing_submit ON finance_outgoing_calls(intent_id) WHERE operation='SUBMIT'",
    );
    await q.query(`CREATE TABLE finance_outgoing_observations(id uuid PRIMARY KEY,${scope},intent_id uuid NOT NULL,call_id uuid NOT NULL UNIQUE,
      provider_code text NOT NULL,provider_account_reference text NOT NULL,provider_payment_id text,
      state text NOT NULL CHECK(state IN ('PENDING','UNKNOWN','NOT_FOUND','FAILED_FINAL','CONFIRMED','CONFLICT_HELD')),
      amount numeric(30,12) NOT NULL CHECK(amount>=0),fee numeric(30,12) NOT NULL CHECK(fee>=0),${content},
      CHECK(state<>'FAILED_FINAL' OR (amount=0 AND fee=0)),CHECK(state<>'CONFIRMED' OR (amount>0 AND provider_payment_id IS NOT NULL)),
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${scopedId},${book},${intentRef},
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,call_id) REFERENCES finance_outgoing_calls(tenant_id,legal_entity_id,book_id,id))`);
    // Confirmation for the same call is idempotent. Cross-intent provider-reference collisions
    // remain observable facts and are held by the controls rather than rolled back/lost.
    await q.query(
      'CREATE INDEX IDX_fin_outgoing_provider_payment ON finance_outgoing_observations(tenant_id,provider_code,provider_account_reference,provider_payment_id) WHERE provider_payment_id IS NOT NULL',
    );
    await q.query(`CREATE TABLE finance_outgoing_audits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),${scope},object_table text NOT NULL CHECK(object_table IN (${tables
      .slice(1, -1)
      .map((t) => "'" + t + "'")
      .join(',')})),object_id uuid NOT NULL,
      action text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash~'^[a-f0-9]{64}$'),actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,
      reason text NOT NULL CHECK(btrim(reason)<>''),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(object_table,object_id),${book})`);
    await q.query(
      `CREATE FUNCTION finance_outgoing_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Outgoing cash evidence is append-only; confirmed cash cannot be undone by rewriting records'; END $$`,
    );
    await q.query(`CREATE FUNCTION finance_outgoing_audit_required() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM finance_outgoing_audits a WHERE a.tenant_id=NEW.tenant_id AND a.legal_entity_id=NEW.legal_entity_id AND a.book_id=NEW.book_id AND a.object_table=TG_TABLE_NAME AND a.object_id=NEW.id AND a.subject_hash=NEW.subject_hash) THEN RAISE EXCEPTION 'Outgoing control evidence requires its transaction-bound audit'; END IF;RETURN NEW;END $$`);
    await q.query(`CREATE FUNCTION finance_outgoing_exception(payment uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM finance_outgoing_observations o JOIN finance_outgoing_intents i ON i.id=o.intent_id WHERE i.id=payment AND
        (o.state='CONFLICT_HELD' OR (o.state='CONFIRMED' AND (o.amount<>i.amount OR o.fee>i.maximum_fee OR EXISTS(
          SELECT 1 FROM finance_outgoing_observations other WHERE other.tenant_id=o.tenant_id AND other.provider_code=o.provider_code AND other.provider_account_reference=o.provider_account_reference AND other.provider_payment_id=o.provider_payment_id AND other.intent_id<>o.intent_id)))))
      OR (SELECT count(DISTINCT provider_payment_id)>1 FROM finance_outgoing_observations WHERE intent_id=payment AND state='CONFIRMED')
      OR EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=payment AND state='CONFIRMED' GROUP BY provider_payment_id HAVING count(DISTINCT (amount,fee))>1)
      OR (EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=payment AND state='CONFIRMED') AND EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=payment AND state='FAILED_FINAL'))
      OR EXISTS(SELECT 1 FROM finance_outgoing_aliases a JOIN finance_outgoing_intents i ON i.id=payment WHERE a.evidence_id IN (i.funding_id,i.obligation_id) AND a.state='CONFLICT_HELD') $$`);
    await q.query(`CREATE FUNCTION finance_outgoing_encumbrance(payment uuid) RETURNS numeric LANGUAGE plpgsql STABLE AS $$
      DECLARE i finance_outgoing_intents; paid numeric; BEGIN SELECT * INTO i FROM finance_outgoing_intents WHERE id=payment;
      SELECT COALESCE(sum(amount),0) INTO paid FROM (SELECT provider_payment_id,max(amount+fee) amount FROM finance_outgoing_observations WHERE intent_id=payment AND state='CONFIRMED' GROUP BY provider_payment_id) amounts;
      IF finance_outgoing_exception(payment) THEN
        IF paid=0 AND NOT EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=payment AND action='RESERVE') AND NOT EXISTS(SELECT 1 FROM finance_outgoing_calls WHERE intent_id=payment) THEN RETURN 0;END IF;
        RETURN greatest(i.amount+i.maximum_fee,paid);END IF;
      IF EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=payment AND state='CONFIRMED') THEN RETURN paid; END IF;
      IF EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=payment AND state='FAILED_FINAL') OR
        NOT EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=payment AND action='RESERVE') OR
        (EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=payment AND action='CANCEL') AND NOT EXISTS(SELECT 1 FROM finance_outgoing_calls WHERE intent_id=payment)) THEN RETURN 0;END IF;
      RETURN i.amount+i.maximum_fee; END $$`);
    await q.query(`CREATE FUNCTION finance_outgoing_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE i finance_outgoing_intents; f finance_outgoing_evidence; o finance_outgoing_evidence; g finance_outgoing_authorities; approval finance_outgoing_events; c finance_outgoing_calls; need text; cash_currency text; cash_limit numeric:=0; used numeric; BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended('finance-inactive-config:'||NEW.tenant_id::text,0));
      IF TG_TABLE_NAME='finance_outgoing_observations' THEN
        SELECT * INTO c FROM finance_outgoing_calls WHERE id=NEW.call_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND intent_id=NEW.intent_id;
        IF NOT FOUND OR NEW.subject->>'callHash' IS DISTINCT FROM c.subject_hash OR NEW.provider_code IS DISTINCT FROM c.subject->'request'->>'providerCode' OR NEW.provider_account_reference IS DISTINCT FROM c.subject->'request'->>'providerAccountReference' THEN RAISE EXCEPTION 'Provider observation differs from its durable call';END IF;
        IF NEW.state<>'CONFLICT_HELD' AND NOT ((NEW.subject->>'matchesRequest')::boolean AND NEW.subject->'outcome'->>'state'=NEW.state AND
          (NEW.subject->'outcome'->>'amount')::numeric=NEW.amount AND (NEW.subject->'outcome'->>'fee')::numeric=NEW.fee AND
          NEW.subject->'outcome'->>'executionKey'=c.subject->'request'->>'executionKey' AND NEW.subject->'outcome'->>'beneficiaryHash'=c.subject->'request'->>'beneficiaryHash' AND
          NEW.subject->'outcome'->>'currency'=c.subject->'request'->>'currency' AND (NEW.subject->'outcome'->>'providerPaymentId') IS NOT DISTINCT FROM NEW.provider_payment_id) IS TRUE THEN RAISE EXCEPTION 'Provider observation vector differs';END IF;
        RETURN NEW; -- Preserve provider facts even if authority/book state changed after submission.
      END IF;
      IF NOT EXISTS(SELECT 1 FROM finance_accounting_books b JOIN finance_legal_entities e ON e.tenant_id=b.tenant_id AND e.id=b.legal_entity_id WHERE b.tenant_id=NEW.tenant_id AND b.legal_entity_id=NEW.legal_entity_id AND b.id=NEW.book_id AND b.state='DRAFT' AND e.state='DRAFT') THEN RAISE EXCEPTION 'Inactive outgoing book unavailable';END IF;
      IF TG_TABLE_NAME IN ('finance_outgoing_evidence','finance_outgoing_aliases') THEN
        need:='OBSERVE_CASH';IF TG_TABLE_NAME='finance_outgoing_evidence' THEN cash_currency:=NEW.currency;
          IF NOT finance_outgoing_profile_valid(NEW.id) THEN RAISE EXCEPTION 'Current reviewed cash ownership profile is required';END IF;
          IF NOT (NEW.subject->'snapshot'->>'kind'=NEW.kind AND NEW.subject->'snapshot'->>'sourceCompanyId'=NEW.source_company_id::text AND NEW.subject->'snapshot'->>'sourceAccountId'=NEW.source_account_id::text AND NEW.subject->'snapshot'->>'currency'=NEW.currency AND (NEW.subject->'snapshot'->>'decimalScale')::integer=NEW.decimal_scale) IS TRUE THEN RAISE EXCEPTION 'Source evidence metadata differs';END IF;
        ELSE SELECT * INTO f FROM finance_outgoing_evidence WHERE id=NEW.evidence_id;cash_currency:=f.currency;
          IF NOT (NEW.subject->>'evidenceHash'=f.subject_hash AND NEW.subject->>'sourceState'=NEW.state AND
            ((NEW.state='MATCHED')=(((NEW.subject->'incomingSnapshot')-'id')=((f.subject->'snapshot')-'id')))) IS TRUE THEN RAISE EXCEPTION 'Cash alias state differs from its canonical source';END IF;
        END IF;
      ELSIF TG_TABLE_NAME='finance_outgoing_intents' THEN
        need:='PREPARE_PAYMENT';cash_currency:=NEW.currency;cash_limit:=NEW.amount+NEW.maximum_fee;
        SELECT * INTO f FROM finance_outgoing_evidence WHERE id=NEW.funding_id;SELECT * INTO o FROM finance_outgoing_evidence WHERE id=NEW.obligation_id;
        IF NOT finance_outgoing_profile_valid(f.id) THEN RAISE EXCEPTION 'Current reviewed cash ownership profile is required';END IF;
        IF NOT (f.kind='FUNDING' AND o.kind='OBLIGATION' AND f.source_company_id=o.source_company_id AND f.source_account_id=o.source_account_id AND f.currency=NEW.currency AND o.currency=NEW.currency AND f.decimal_scale=NEW.decimal_scale AND o.decimal_scale=NEW.decimal_scale AND
          (NEW.subject->'plan'->>'amount')::numeric=NEW.amount AND (NEW.subject->'plan'->>'maximumFee')::numeric=NEW.maximum_fee AND NEW.subject->'plan'->>'beneficiaryHash'=NEW.beneficiary_hash AND
          NEW.subject->'plan'->>'fundingHash'=f.subject_hash AND NEW.subject->'plan'->>'obligationHash'=o.subject_hash AND NEW.subject->'plan'->>'commandKey'=NEW.command_key AND
          NEW.subject->'beneficiary'=o.subject->'snapshot'->'beneficiary' AND NEW.subject->>'providerCode'=f.subject->'snapshot'->>'providerCode' AND NEW.subject->>'providerAccountReference'=f.subject->'snapshot'->>'providerAccountReference' AND
          NEW.subject->>'makerSubjectId'=NEW.actor_subject_id::text AND NEW.subject->>'makerNaturalPersonId'=NEW.actor_natural_person_id::text AND NEW.expires_at>statement_timestamp()) IS TRUE THEN RAISE EXCEPTION 'Frozen cash intent differs from source evidence';END IF;
      ELSE
        SELECT * INTO i FROM finance_outgoing_intents WHERE id=NEW.intent_id;cash_currency:=i.currency;cash_limit:=i.amount+i.maximum_fee;
        IF TG_TABLE_NAME='finance_outgoing_calls' THEN need:='EXECUTE_SIMULATION';
          IF NOT (NEW.subject->>'operation'=(to_jsonb(NEW)->>'operation') AND NEW.subject->>'intentHash'=i.subject_hash AND NEW.subject->'request'->>'executionKey'=i.execution_key AND NEW.subject->'request'->>'beneficiaryHash'=i.beneficiary_hash AND NEW.subject->'request'->>'providerCode'=i.subject->>'providerCode' AND NEW.subject->'request'->>'providerAccountReference'=i.subject->>'providerAccountReference' AND (NEW.subject->'request'->>'amount')::numeric=i.amount AND (NEW.subject->'request'->>'maximumFee')::numeric=i.maximum_fee AND NEW.subject->'request'->>'currency'=i.currency) IS TRUE THEN RAISE EXCEPTION 'Provider call differs from frozen intent';END IF;
          IF (to_jsonb(NEW)->>'operation')='QUERY' AND NOT EXISTS(SELECT 1 FROM finance_outgoing_calls WHERE intent_id=i.id AND operation='SUBMIT') THEN RAISE EXCEPTION 'Query requires original submission';END IF;
        ELSE need:=CASE WHEN (to_jsonb(NEW)->>'action') IN ('APPROVE','REJECT','CANCEL') THEN 'REVIEW_PAYMENT' WHEN (to_jsonb(NEW)->>'action')='RESERVE' THEN 'RESERVE_CASH' ELSE 'RECONCILE_CASH' END;
          IF NOT (NEW.subject->>'intentHash'=i.subject_hash AND NEW.subject->>'action'=(to_jsonb(NEW)->>'action') AND NEW.subject->>'commandKey'=NEW.command_key) IS TRUE THEN RAISE EXCEPTION 'Cash event subject differs';END IF;
          IF (to_jsonb(NEW)->>'action') IN ('APPROVE','REJECT','CANCEL','RECONCILE','DISCHARGE_REVIEW') AND (NEW.actor_natural_person_id=i.actor_natural_person_id OR NEW.actor_subject_id=i.actor_subject_id OR ((to_jsonb(NEW)->>'action')<>'CANCEL' AND i.subject->'beneficiary'->'naturalPersonIds' ? NEW.actor_natural_person_id::text)) THEN RAISE EXCEPTION 'Independent cash review is required';END IF;
          IF (to_jsonb(NEW)->>'action')='CANCEL' AND EXISTS(SELECT 1 FROM finance_outgoing_calls WHERE intent_id=i.id) THEN RAISE EXCEPTION 'Attempted cash cannot be cancelled';END IF;
          IF (to_jsonb(NEW)->>'action') IN ('RECONCILE','DISCHARGE_REVIEW') THEN
            SELECT * INTO f FROM finance_outgoing_evidence WHERE id=i.funding_id;
            IF finance_outgoing_exception(i.id) OR NOT EXISTS(SELECT 1 FROM finance_outgoing_evidence bank JOIN finance_outgoing_observations paid ON paid.intent_id=i.id AND paid.state='CONFIRMED'
              WHERE bank.tenant_id=i.tenant_id AND bank.legal_entity_id=i.legal_entity_id AND bank.book_id=i.book_id AND bank.kind='BANK_PAYMENT' AND bank.id=(NEW.subject->'details'->>'bankId')::uuid AND bank.subject_hash=NEW.subject->'details'->>'bankHash' AND NOT EXISTS(SELECT 1 FROM finance_outgoing_aliases a WHERE a.evidence_id=bank.id AND a.state='CONFLICT_HELD') AND
              bank.source_company_id=f.source_company_id AND bank.source_account_id=f.source_account_id AND bank.currency=i.currency AND bank.decimal_scale=i.decimal_scale AND
              bank.subject->'snapshot'->>'executionKey'=i.execution_key AND bank.subject->'snapshot'->>'beneficiaryHash'=i.beneficiary_hash AND
              bank.subject->'snapshot'->>'providerPaymentId'=paid.provider_payment_id AND bank.subject->'snapshot'->>'providerCode'=paid.provider_code AND bank.subject->'snapshot'->>'providerAccountReference'=paid.provider_account_reference AND
              (bank.subject->'snapshot'->>'amount')::numeric=paid.amount AND (bank.subject->'snapshot'->>'fee')::numeric=paid.fee) OR
              NOT (NEW.subject->'details'->>'legalDischargeAccepted'='false' AND NEW.subject->'details'->>'accountingState'='HELD_INACTIVE' AND (NEW.subject->'details'->>'financialEffects')::integer=0) IS TRUE
              THEN RAISE EXCEPTION 'Cash reconciliation needs matching confirmed bank evidence and inactive accounting';END IF;
          END IF;
        END IF;
        IF (TG_TABLE_NAME='finance_outgoing_calls' AND (to_jsonb(NEW)->>'operation')='SUBMIT') OR (TG_TABLE_NAME='finance_outgoing_events' AND (to_jsonb(NEW)->>'action')='RESERVE') THEN
          SELECT * INTO approval FROM finance_outgoing_events WHERE intent_id=i.id AND action='APPROVE';
          IF NOT FOUND OR i.expires_at<=statement_timestamp() OR EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=i.id AND action IN ('REJECT','CANCEL')) OR NOT EXISTS(SELECT 1 FROM finance_outgoing_authorities WHERE id=approval.authority_id AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>=i.expires_at) THEN RAISE EXCEPTION 'Current approved cash intent is required';END IF;
          IF TG_TABLE_NAME='finance_outgoing_calls' AND NOT EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=i.id AND action='RESERVE') THEN RAISE EXCEPTION 'Provider submission requires reservation';END IF;
          SELECT * INTO f FROM finance_outgoing_evidence WHERE id=i.funding_id;
          IF NOT finance_outgoing_profile_valid(f.id) THEN RAISE EXCEPTION 'Current reviewed cash ownership profile is required';END IF;
          SELECT COALESCE(sum(finance_outgoing_encumbrance(id)),0) INTO used FROM finance_outgoing_intents WHERE funding_id=f.id;
          IF used>(f.subject->'snapshot'->>'available')::numeric OR EXISTS(SELECT 1 FROM finance_outgoing_intents WHERE funding_id=f.id AND finance_outgoing_exception(id)) THEN RAISE EXCEPTION 'Cash capacity exceeded or held by exception';END IF;
          SELECT COALESCE(sum(amount),0) INTO used FROM finance_outgoing_intents WHERE obligation_id=i.obligation_id AND finance_outgoing_encumbrance(id)>0;
          SELECT * INTO o FROM finance_outgoing_evidence WHERE id=i.obligation_id;IF used>(o.subject->'snapshot'->>'amount')::numeric THEN RAISE EXCEPTION 'Obligation capacity exceeded';END IF;
        END IF;
      END IF;
      SELECT * INTO g FROM finance_outgoing_authorities WHERE id=NEW.authority_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND subject_id=NEW.actor_subject_id AND natural_person_id=NEW.actor_natural_person_id AND permission=need AND finance_outgoing_authorities.currency=cash_currency AND max_amount>=cash_limit AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp();
      IF NOT FOUND THEN RAISE EXCEPTION 'Current exact outgoing cash authority is required';END IF;
      IF TG_TABLE_NAME='finance_outgoing_intents' AND (to_jsonb(NEW)->>'expires_at')::timestamptz>g.valid_to THEN RAISE EXCEPTION 'Payment expiry exceeds preparer authority';END IF;
      IF TG_TABLE_NAME='finance_outgoing_events' AND (to_jsonb(NEW)->>'action') IN ('APPROVE','REJECT') AND (i.expires_at<=statement_timestamp() OR i.expires_at>g.valid_to) THEN RAISE EXCEPTION 'Payment review must cover frozen expiry';END IF;
      RETURN NEW;END $$`);
    await q.query(`CREATE FUNCTION finance_outgoing_profile_valid(evidence uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM finance_outgoing_evidence e JOIN finance_configuration_releases c ON c.tenant_id=e.tenant_id AND c.legal_entity_id=e.legal_entity_id AND c.book_id=e.book_id AND c.id=e.profile_id AND c.release_hash=e.profile_hash
        WHERE e.id=evidence AND c.kind='RECEIVABLE_CONTROLS' AND c.state='REVIEWED_INACTIVE' AND c.effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (c.effective_to IS NULL OR c.effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date)
        AND EXISTS(SELECT 1 FROM jsonb_array_elements(c.payload->'cashAccounts') a WHERE a->>'sourceAccountId'=e.source_account_id::text AND a->>'sourceCompanyId'=e.source_company_id::text AND a->>'currency'=e.currency AND (a->>'decimalScale')::integer=e.decimal_scale)) $$`);
    for (const table of tables.slice(1)) {
      await q.query(
        `CREATE TRIGGER finance_outgoing_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION finance_outgoing_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER finance_outgoing_no_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION finance_outgoing_immutable()`,
      );
      if (table !== 'finance_outgoing_audits')
        await q.query(
          `CREATE CONSTRAINT TRIGGER finance_outgoing_guard AFTER INSERT ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_outgoing_guard()`,
        );
      if (table !== 'finance_outgoing_audits')
        await q.query(
          `CREATE CONSTRAINT TRIGGER finance_outgoing_audit_required AFTER INSERT ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_outgoing_audit_required()`,
        );
    }
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of tables)
      if (
        (await q.query(`SELECT EXISTS(SELECT 1 FROM ${table}) populated`))[0]
          .populated
      )
        throw new Error(
          'Outgoing evidence or mandates exist; rollback must retain them.',
        );
    for (const table of [...tables].reverse())
      await q.query(`DROP TABLE ${table}`);
    await q.query('DROP FUNCTION finance_outgoing_audit_required()');
    await q.query('DROP FUNCTION finance_outgoing_immutable()');
    await q.query('DROP FUNCTION finance_outgoing_guard()');
    await q.query('DROP FUNCTION finance_outgoing_profile_valid(uuid)');
    await q.query('DROP FUNCTION finance_outgoing_encumbrance(uuid)');
    await q.query('DROP FUNCTION finance_outgoing_exception(uuid)');
  }
}
