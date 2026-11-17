import { MigrationInterface, QueryRunner } from 'typeorm';
const tables = [
  'finance_policy_change_authorities',
  'finance_policy_changes',
  'finance_policy_change_aliases',
  'finance_policy_change_decisions',
  'finance_policy_refund_requests',
  'finance_policy_refund_events',
  'finance_policy_change_audits',
];
const scope =
  'tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL';
const book =
  'FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id)';
const unique = 'UNIQUE(tenant_id,legal_entity_id,book_id,id)';
const actor =
  'actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL REFERENCES finance_policy_change_authorities(id)';
const content =
  "subject jsonb NOT NULL,canonical_subject text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash=encode(sha256(convert_to(canonical_subject,'UTF8')),'hex')),CHECK(canonical_subject::jsonb=subject),CHECK(octet_length(canonical_subject)<=262144)";
const changeFk = (c: string) =>
  `FOREIGN KEY(tenant_id,legal_entity_id,book_id,${c}) REFERENCES finance_policy_changes(tenant_id,legal_entity_id,book_id,id)`;
/** Inactive, append-only change/refund evidence. No policies, source rows or grants are seeded. */
export class FinancePolicyChangeControls1797600000000 implements MigrationInterface {
  name = 'FinancePolicyChangeControls1797600000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE finance_policy_change_authorities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),${scope},subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,permission text NOT NULL CHECK(permission IN ('OBSERVE_CHANGE','REVIEW_CHANGE','PREPARE_REFUND','REVIEW_REFUND','RECONCILE_REFUND','READ_CHANGE')),currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),max_amount numeric(30,12) NOT NULL CHECK(max_amount>=0),state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),valid_from timestamptz NOT NULL,valid_to timestamptz NOT NULL,revoked_at timestamptz,CHECK(valid_to>valid_from),${book})`,
    );
    await q.query(
      `CREATE TABLE finance_policy_changes(id uuid PRIMARY KEY,${scope},source_company_id uuid NOT NULL,source_transaction_id uuid NOT NULL,policy_id uuid NOT NULL,source_revision integer NOT NULL CHECK(source_revision>0),economic_root text NOT NULL,vector_hash text NOT NULL CHECK(vector_hash~'^[a-f0-9]{64}$'),currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),source_version_id uuid NOT NULL,source_version_number integer NOT NULL,target_version_id uuid NOT NULL,target_version_number integer NOT NULL CHECK(target_version_number=source_version_number+1),original_billing_id uuid NOT NULL,previous_id uuid,correction_of_id uuid,entitlement_root_id uuid NOT NULL,entitlement_delta numeric(30,12) NOT NULL,inbox_id uuid NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,source_company_id,source_transaction_id,source_revision),${book},${changeFk('previous_id')},${changeFk('correction_of_id')},${changeFk('entitlement_root_id')},FOREIGN KEY(tenant_id,legal_entity_id,book_id,original_billing_id) REFERENCES finance_quotation_memoranda(tenant_id,legal_entity_id,book_id,id),FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id))`,
    );
    await q.query(
      `CREATE TABLE finance_policy_change_aliases(id uuid PRIMARY KEY,${scope},change_id uuid NOT NULL,inbox_id uuid NOT NULL,state text NOT NULL CHECK(state IN ('MATCHED','CONFLICT_HELD')),source_revision integer NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,inbox_id),${book},${changeFk('change_id')},FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id))`,
    );
    await q.query(
      `CREATE TABLE finance_policy_change_decisions(id uuid PRIMARY KEY,${scope},change_id uuid NOT NULL UNIQUE,decision text NOT NULL CHECK(decision IN ('REVIEWED_INACTIVE','REJECTED_INACTIVE')),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},${book},${changeFk('change_id')})`,
    );
    await q.query(
      `CREATE TABLE finance_policy_refund_requests(id uuid PRIMARY KEY,${scope},command_key text NOT NULL,change_id uuid NOT NULL,entitlement_root_id uuid NOT NULL,assignment_id uuid NOT NULL,amount numeric(30,12) NOT NULL CHECK(amount>0),currency varchar(3) NOT NULL,decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),beneficiary_hash text NOT NULL CHECK(beneficiary_hash~'^[a-f0-9]{64}$'),expires_at timestamptz NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},${changeFk('change_id')},${changeFk('entitlement_root_id')},FOREIGN KEY(tenant_id,legal_entity_id,book_id,assignment_id) REFERENCES finance_receivable_requests(tenant_id,legal_entity_id,book_id,id))`,
    );
    await q.query(
      `CREATE TABLE finance_policy_refund_events(id uuid PRIMARY KEY,${scope},refund_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('APPROVE','REJECT','CANCEL','BIND_EXECUTION','RECONCILE_CASH')),command_key text NOT NULL,outgoing_intent_id uuid,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},FOREIGN KEY(tenant_id,legal_entity_id,book_id,refund_id) REFERENCES finance_policy_refund_requests(tenant_id,legal_entity_id,book_id,id),FOREIGN KEY(tenant_id,legal_entity_id,book_id,outgoing_intent_id) REFERENCES finance_outgoing_intents(tenant_id,legal_entity_id,book_id,id),CHECK((action='BIND_EXECUTION' AND outgoing_intent_id IS NOT NULL) OR action='RECONCILE_CASH' OR (action NOT IN ('BIND_EXECUTION','RECONCILE_CASH') AND outgoing_intent_id IS NULL)))`,
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_policy_refund_decision ON finance_policy_refund_events(refund_id) WHERE action IN ('APPROVE','REJECT')",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_policy_refund_cancel ON finance_policy_refund_events(refund_id) WHERE action='CANCEL'",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_policy_refund_execution ON finance_policy_refund_events(outgoing_intent_id) WHERE action='BIND_EXECUTION'",
    );
    await q.query(
      `CREATE TABLE finance_policy_change_audits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),${scope},object_table text NOT NULL CHECK(object_table IN (${tables
        .slice(1, -1)
        .map((t) => "'" + t + "'")
        .join(
          ',',
        )})),object_id uuid NOT NULL UNIQUE,action text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash~'^[a-f0-9]{64}$'),actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${book})`,
    );
    await q.query(
      'CREATE INDEX IDX_policy_change_head ON finance_policy_changes(tenant_id,policy_id,target_version_number,source_revision)',
    );
    await q.query(
      'CREATE INDEX IDX_policy_change_root ON finance_policy_changes(entitlement_root_id)',
    );
    await q.query(
      'CREATE INDEX IDX_policy_refund_assignment ON finance_policy_refund_requests(assignment_id)',
    );
    await q.query(
      'CREATE INDEX IDX_policy_refund_root ON finance_policy_refund_requests(entitlement_root_id)',
    );
    await q.query(
      `CREATE FUNCTION finance_policy_refund_reserved(assignment uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT COALESCE(sum(r.amount),0)::numeric(38,12) FROM finance_policy_refund_requests r WHERE r.assignment_id=assignment AND NOT EXISTS(SELECT 1 FROM finance_policy_refund_events e WHERE e.refund_id=r.id AND e.action IN ('REJECT','CANCEL')) $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_policy_root_entitlement(root uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT COALESCE(sum(c.entitlement_delta),0)::numeric(38,12) FROM finance_policy_changes c JOIN finance_policy_change_decisions d ON d.change_id=c.id AND d.decision='REVIEWED_INACTIVE' WHERE c.entitlement_root_id=root $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_policy_head(policy uuid,tenant uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT c.id FROM finance_policy_changes c JOIN finance_policy_change_decisions d ON d.change_id=c.id AND d.decision='REVIEWED_INACTIVE' WHERE c.policy_id=policy AND c.tenant_id=tenant ORDER BY c.target_version_number DESC,c.source_revision DESC LIMIT 1 $$`,
    );
    await q.query(`CREATE FUNCTION finance_policy_refund_eligible(refund uuid,require_approval boolean DEFAULT true) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM finance_policy_refund_requests r JOIN finance_policy_changes c ON c.id=r.change_id JOIN finance_policy_changes h ON h.id=finance_policy_head(c.policy_id,c.tenant_id) JOIN finance_receivable_requests a ON a.id=r.assignment_id
    WHERE r.id=refund AND r.expires_at>statement_timestamp() AND r.subject->>'policyHeadHash'=h.subject_hash AND (NOT require_approval OR EXISTS(SELECT 1 FROM finance_policy_refund_events e JOIN finance_policy_change_authorities g ON g.id=e.authority_id WHERE e.refund_id=r.id AND e.action='APPROVE' AND g.state='ENABLED' AND g.revoked_at IS NULL AND g.valid_from<=statement_timestamp() AND g.valid_to>=r.expires_at AND g.valid_to>statement_timestamp())) AND NOT EXISTS(SELECT 1 FROM finance_policy_refund_events WHERE refund_id=r.id AND action IN ('REJECT','CANCEL'))
    AND NOT EXISTS(SELECT 1 FROM finance_policy_change_aliases x JOIN finance_policy_changes z ON z.id=x.change_id WHERE z.policy_id=c.policy_id AND z.tenant_id=c.tenant_id AND x.state='CONFLICT_HELD')
    AND NOT EXISTS(SELECT 1 FROM finance_policy_changes z WHERE z.policy_id=c.policy_id AND z.tenant_id=c.tenant_id AND NOT EXISTS(SELECT 1 FROM finance_policy_changes newer WHERE newer.tenant_id=z.tenant_id AND newer.source_company_id=z.source_company_id AND newer.source_transaction_id=z.source_transaction_id AND newer.source_revision>z.source_revision) AND NOT EXISTS(SELECT 1 FROM finance_policy_change_decisions zd WHERE zd.change_id=z.id AND zd.decision='REVIEWED_INACTIVE'))
    AND NOT EXISTS(SELECT 1 FROM finance_receipt_sources WHERE receipt_id=a.receipt_id AND state='CONFLICT_HELD')
    AND finance_policy_root_entitlement(r.entitlement_root_id)>=(SELECT COALESCE(sum(amount),0) FROM finance_policy_refund_requests z WHERE z.entitlement_root_id=r.entitlement_root_id AND NOT EXISTS(SELECT 1 FROM finance_policy_refund_events WHERE refund_id=z.id AND action IN ('REJECT','CANCEL')))) $$`);
    await q.query(
      `CREATE FUNCTION finance_policy_change_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Policy change and refund control evidence is append-only';END $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_policy_change_audit_required() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM finance_policy_change_audits WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND object_table=TG_TABLE_NAME AND object_id=NEW.id AND subject_hash=NEW.subject_hash) THEN RAISE EXCEPTION 'Policy change/refund requires transaction-bound audit';END IF;RETURN NEW;END $$`,
    );
    // Guard is shared by B16 records and the existing B14/B15 entry points. None of
    // these hooks post accounting or change historical source rows.
    await q.query(`CREATE FUNCTION finance_policy_change_guard() RETURNS trigger LANGUAGE plpgsql AS $$
   DECLARE payload jsonb:=to_jsonb(NEW);c finance_policy_changes;r finance_policy_refund_requests;i finance_outgoing_intents;o finance_outgoing_evidence;a finance_receivable_requests;g finance_policy_change_authorities;h uuid;need text;cash_currency text;limit_amount numeric:=0;reserved numeric;reversed numeric;used numeric;BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('finance-inactive-config:'||NEW.tenant_id::text,0));
    IF TG_TABLE_NAME IN ('finance_receivable_requests','finance_receivable_decisions') THEN
      IF TG_TABLE_NAME='finance_receivable_requests' THEN SELECT * INTO a FROM finance_receivable_requests WHERE id=NEW.id;ELSE SELECT * INTO a FROM finance_receivable_requests WHERE id=(payload->>'request_id')::uuid;END IF;
      IF a.kind='REVERSE' THEN SELECT COALESCE(sum(x.amount),0) INTO reversed FROM finance_receivable_requests x LEFT JOIN finance_receivable_decisions d ON d.request_id=x.id WHERE x.original_id=a.original_id AND d.decision IS DISTINCT FROM 'REJECTED_INACTIVE';
        SELECT amount INTO used FROM finance_receivable_requests WHERE id=a.original_id;
        IF reversed+finance_policy_refund_reserved(a.original_id)>used THEN RAISE EXCEPTION 'Original allocation is reserved by refunds or reversals';END IF;
      END IF;RETURN NEW;
    END IF;
    IF TG_TABLE_NAME IN ('finance_outgoing_calls','finance_outgoing_events') THEN
      IF (TG_TABLE_NAME='finance_outgoing_calls' AND payload->>'operation'='SUBMIT') OR (TG_TABLE_NAME='finance_outgoing_events' AND payload->>'action'='RESERVE') THEN
        SELECT * INTO i FROM finance_outgoing_intents WHERE id=(payload->>'intent_id')::uuid;SELECT * INTO o FROM finance_outgoing_evidence WHERE id=i.obligation_id;
        SELECT * INTO r FROM finance_policy_refund_requests WHERE tenant_id=i.tenant_id AND legal_entity_id=i.legal_entity_id AND book_id=i.book_id AND subject_hash=o.subject->'snapshot'->>'entitlementEvidenceHash';
        IF FOUND AND (NOT finance_policy_refund_eligible(r.id) OR NOT EXISTS(SELECT 1 FROM finance_policy_refund_events WHERE refund_id=r.id AND outgoing_intent_id=i.id AND action='BIND_EXECUTION')) THEN RAISE EXCEPTION 'Refund execution is stale, unbound or exceeds approved entitlement';END IF;
      END IF;RETURN NEW;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM finance_accounting_books b JOIN finance_legal_entities e ON e.tenant_id=b.tenant_id AND e.id=b.legal_entity_id WHERE b.tenant_id=NEW.tenant_id AND b.legal_entity_id=NEW.legal_entity_id AND b.id=NEW.book_id AND b.state='DRAFT' AND e.state='DRAFT') THEN RAISE EXCEPTION 'Inactive policy-change book unavailable';END IF;
    IF TG_TABLE_NAME='finance_policy_changes' THEN need:='OBSERVE_CHANGE';cash_currency:=NEW.currency;
      IF NOT (NEW.subject->'snapshot'->>'id'=NEW.source_transaction_id::text AND NEW.subject->'snapshot'->>'sourceCompanyId'=NEW.source_company_id::text AND NEW.subject->'snapshot'->>'policyId'=NEW.policy_id::text AND (NEW.subject->'snapshot'->>'sourceRevision')::integer=NEW.source_revision AND NEW.subject->'snapshot'->>'currency'=NEW.currency AND (NEW.subject->'snapshot'->>'decimalScale')::integer=NEW.decimal_scale) IS TRUE THEN RAISE EXCEPTION 'Policy-change source metadata differs';END IF;
      IF EXISTS(SELECT 1 FROM finance_policy_changes x WHERE x.tenant_id=NEW.tenant_id AND x.source_company_id=NEW.source_company_id AND x.policy_id=NEW.policy_id AND (x.book_id<>NEW.book_id OR x.legal_entity_id<>NEW.legal_entity_id)) THEN RAISE EXCEPTION 'Policy economic identity already belongs to another book';END IF;
      IF NOT ((NEW.subject->'snapshot'->'sourceVersion'->>'id')::uuid=NEW.source_version_id AND (NEW.subject->'snapshot'->'sourceVersion'->>'number')::integer=NEW.source_version_number AND (NEW.subject->'snapshot'->'targetVersion'->>'id')::uuid=NEW.target_version_id AND (NEW.subject->'snapshot'->'targetVersion'->>'number')::integer=NEW.target_version_number AND (NEW.subject->'snapshot'->'originalBilling'->>'id')::uuid=NEW.original_billing_id AND NEW.entitlement_delta=CASE WHEN NEW.subject->'snapshot'->>'effect'='NORMAL' THEN (NEW.subject->'snapshot'->>'returnPremium')::numeric ELSE (NEW.subject->'snapshot'->>'returnPremium')::numeric-(NEW.subject->'snapshot'->>'additionalPremium')::numeric END) IS TRUE THEN RAISE EXCEPTION 'Policy term or entitlement vector differs';END IF;
    ELSIF TG_TABLE_NAME='finance_policy_change_aliases' THEN SELECT * INTO c FROM finance_policy_changes WHERE id=NEW.change_id;need:='OBSERVE_CHANGE';cash_currency:=c.currency;
    ELSIF TG_TABLE_NAME='finance_policy_change_decisions' THEN
      SELECT * INTO c FROM finance_policy_changes WHERE id=NEW.change_id;need:='REVIEW_CHANGE';cash_currency:=c.currency;
      IF NEW.actor_subject_id=c.actor_subject_id OR NEW.actor_natural_person_id=c.actor_natural_person_id THEN RAISE EXCEPTION 'Independent policy-change review is required';END IF;
      IF NEW.subject->>'changeHash' IS DISTINCT FROM c.subject_hash THEN RAISE EXCEPTION 'Policy-change review hash differs';END IF;
      IF NEW.decision='REVIEWED_INACTIVE' THEN
        IF EXISTS(SELECT 1 FROM finance_policy_changes x WHERE x.economic_root=c.economic_root AND x.source_revision>c.source_revision) OR EXISTS(SELECT 1 FROM finance_policy_change_aliases x WHERE x.change_id=c.id AND x.state='CONFLICT_HELD') THEN RAISE EXCEPTION 'Latest unconflicted policy-change evidence required';END IF;
        SELECT x.id INTO h FROM finance_policy_changes x JOIN finance_policy_change_decisions d ON d.change_id=x.id AND d.decision='REVIEWED_INACTIVE' WHERE x.policy_id=c.policy_id AND x.tenant_id=c.tenant_id AND x.id<>c.id ORDER BY x.target_version_number DESC,x.source_revision DESC LIMIT 1;
        IF c.previous_id IS DISTINCT FROM h OR (h IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_policy_changes x WHERE x.id=h AND x.target_version_id=c.source_version_id AND x.target_version_number=c.source_version_number)) THEN RAISE EXCEPTION 'Policy term chain changed or is out of order';END IF;
        IF c.subject->'snapshot'->>'taxDifference' IS NULL OR c.subject->'snapshot'->>'taxEvidenceHash' IS NULL OR jsonb_typeof(c.subject->'snapshot'->'taxLines') IS DISTINCT FROM 'array' OR c.subject->'snapshot'->>'feeDifference' IS NULL OR c.subject->'snapshot'->>'commissionDifference' IS NULL OR c.subject->'snapshot'->>'invoiceReconciliation'<>'MATCHED' THEN RAISE EXCEPTION 'Policy-change component breakdown remains unresolved';END IF;
        IF (SELECT COALESCE(sum((line->>'amount')::numeric),0) FROM jsonb_array_elements(c.subject->'snapshot'->'taxLines') line) IS DISTINCT FROM (c.subject->'snapshot'->>'taxDifference')::numeric THEN RAISE EXCEPTION 'Policy tax lines do not reconcile';END IF;
        IF c.correction_of_id IS NOT NULL THEN
          IF NOT EXISTS(SELECT 1 FROM finance_policy_changes x JOIN finance_policy_change_decisions d ON d.change_id=x.id AND d.decision='REVIEWED_INACTIVE' WHERE x.id=c.correction_of_id AND x.policy_id=c.policy_id AND x.entitlement_root_id=c.entitlement_root_id) THEN RAISE EXCEPTION 'Correction requires accepted original effect';END IF;
          IF c.subject->'snapshot'->>'effect'='REVERSAL' AND EXISTS(SELECT 1 FROM finance_policy_changes x WHERE x.id=c.correction_of_id AND ((c.subject->'snapshot'->>'additionalPremium')::numeric-(c.subject->'snapshot'->>'returnPremium')::numeric <> (x.subject->'snapshot'->>'returnPremium')::numeric-(x.subject->'snapshot'->>'additionalPremium')::numeric OR (c.subject->'snapshot'->>'taxDifference')::numeric <> -(x.subject->'snapshot'->>'taxDifference')::numeric OR (c.subject->'snapshot'->>'feeDifference')::numeric <> -(x.subject->'snapshot'->>'feeDifference')::numeric OR (c.subject->'snapshot'->>'commissionDifference')::numeric <> -(x.subject->'snapshot'->>'commissionDifference')::numeric)) THEN RAISE EXCEPTION 'Full reversal component vector differs';END IF;
        END IF;
      END IF;
    ELSIF TG_TABLE_NAME='finance_policy_refund_requests' THEN
      SELECT * INTO c FROM finance_policy_changes WHERE id=NEW.change_id;SELECT * INTO a FROM finance_receivable_requests WHERE id=NEW.assignment_id;need:='PREPARE_REFUND';cash_currency:=NEW.currency;limit_amount:=NEW.amount;
      IF NEW.subject->'plan'->'change'->>'hash' IS DISTINCT FROM c.subject_hash OR NEW.subject->'plan'->'assignment'->>'hash' IS DISTINCT FROM a.subject_hash OR (NEW.subject->'plan'->>'amount')::numeric IS DISTINCT FROM NEW.amount OR (NEW.subject->'plan'->>'expiresAt')::timestamptz IS DISTINCT FROM NEW.expires_at OR NEW.currency<>c.currency OR NEW.decimal_scale<>c.decimal_scale OR NEW.subject->>'policyHeadHash' IS DISTINCT FROM (SELECT subject_hash FROM finance_policy_changes WHERE id=finance_policy_head(c.policy_id,c.tenant_id)) OR NEW.expires_at<=statement_timestamp() OR NOT EXISTS(SELECT 1 FROM finance_policy_change_decisions WHERE change_id=c.id AND decision='REVIEWED_INACTIVE') OR NOT EXISTS(SELECT 1 FROM finance_receivable_decisions WHERE request_id=a.id AND decision='REVIEWED_INACTIVE') OR a.kind<>'ALLOCATE' OR a.memo_id<>c.original_billing_id OR a.currency<>NEW.currency OR a.decimal_scale<>NEW.decimal_scale OR NEW.entitlement_root_id<>c.entitlement_root_id THEN RAISE EXCEPTION 'Refund must reference original reviewed change and allocation';END IF;
      SELECT COALESCE(sum(x.amount),0) INTO reversed FROM finance_receivable_requests x LEFT JOIN finance_receivable_decisions d ON d.request_id=x.id WHERE x.original_id=a.id AND d.decision IS DISTINCT FROM 'REJECTED_INACTIVE';
      IF finance_policy_refund_reserved(a.id)+reversed>a.amount THEN RAISE EXCEPTION 'Refund exceeds original allocation capacity';END IF;
      SELECT COALESCE(sum(x.amount),0) INTO reserved FROM finance_policy_refund_requests x WHERE x.entitlement_root_id=c.entitlement_root_id AND NOT EXISTS(SELECT 1 FROM finance_policy_refund_events e WHERE e.refund_id=x.id AND e.action IN ('REJECT','CANCEL'));
      IF NOT finance_policy_refund_eligible(NEW.id,false) OR reserved>finance_policy_root_entitlement(c.entitlement_root_id) THEN RAISE EXCEPTION 'Refund exceeds source return-premium entitlement';END IF;
    ELSE
      SELECT * INTO r FROM finance_policy_refund_requests WHERE id=NEW.refund_id;SELECT * INTO c FROM finance_policy_changes WHERE id=r.change_id;cash_currency:=r.currency;limit_amount:=r.amount;
      need:=CASE WHEN NEW.action IN ('APPROVE','REJECT','CANCEL') THEN 'REVIEW_REFUND' WHEN NEW.action='BIND_EXECUTION' THEN 'PREPARE_REFUND' ELSE 'RECONCILE_REFUND' END;
      IF NEW.subject->>'refundHash' IS DISTINCT FROM r.subject_hash THEN RAISE EXCEPTION 'Refund event subject changed';END IF;
      IF NEW.action IN ('APPROVE','REJECT','CANCEL','RECONCILE_CASH') AND (NEW.actor_subject_id=r.actor_subject_id OR NEW.actor_natural_person_id=r.actor_natural_person_id OR r.subject->'plan'->'beneficiary'->'naturalPersonIds' ? NEW.actor_natural_person_id::text) THEN RAISE EXCEPTION 'Independent refund review is required';END IF;
      IF NEW.action IN ('APPROVE','BIND_EXECUTION') AND NOT finance_policy_refund_eligible(r.id) THEN RAISE EXCEPTION 'Current approved refund source and capacity are required';END IF;
      IF NEW.action='BIND_EXECUTION' THEN
        SELECT * INTO i FROM finance_outgoing_intents WHERE id=NEW.outgoing_intent_id;SELECT * INTO o FROM finance_outgoing_evidence WHERE id=i.obligation_id;
        IF i.tenant_id<>r.tenant_id OR i.legal_entity_id<>r.legal_entity_id OR i.book_id<>r.book_id OR i.currency<>r.currency OR i.decimal_scale<>r.decimal_scale OR i.beneficiary_hash<>r.beneficiary_hash OR i.expires_at>r.expires_at OR o.subject->'snapshot'->>'obligationId' IS DISTINCT FROM r.id::text OR o.subject->'snapshot'->>'entitlementEvidenceHash' IS DISTINCT FROM r.subject_hash OR EXISTS(SELECT 1 FROM finance_outgoing_calls WHERE intent_id=i.id) THEN RAISE EXCEPTION 'Refund must bind its exact original unexecuted cash intent';END IF;
        SELECT COALESCE(sum(x.amount),0) INTO used FROM finance_policy_refund_events e JOIN finance_outgoing_intents x ON x.id=e.outgoing_intent_id WHERE e.refund_id=r.id AND e.action='BIND_EXECUTION' AND NOT EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=x.id AND action='CANCEL') AND (NOT EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=x.id AND state='FAILED_FINAL') OR EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=x.id AND state IN ('CONFIRMED','CONFLICT_HELD')));
        IF used>r.amount THEN RAISE EXCEPTION 'Bound executions exceed approved refund';END IF;
      END IF;
      IF NEW.action='CANCEL' AND EXISTS(SELECT 1 FROM finance_policy_refund_events e JOIN finance_outgoing_intents x ON x.id=e.outgoing_intent_id WHERE e.refund_id=r.id AND e.action='BIND_EXECUTION' AND NOT EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=x.id AND action='CANCEL') AND (NOT EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=x.id AND state='FAILED_FINAL') OR EXISTS(SELECT 1 FROM finance_outgoing_observations WHERE intent_id=x.id AND state='CONFIRMED'))) THEN RAISE EXCEPTION 'Attempted or active cash must retain refund capacity';END IF;
    END IF;
    SELECT * INTO g FROM finance_policy_change_authorities WHERE id=NEW.authority_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND subject_id=NEW.actor_subject_id AND natural_person_id=NEW.actor_natural_person_id AND permission=need AND finance_policy_change_authorities.currency=cash_currency AND max_amount>=limit_amount AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp();
    IF NOT FOUND THEN RAISE EXCEPTION 'Current exact policy-change/refund authority is required';END IF;RETURN NEW;END $$`);
    for (const t of tables.slice(1)) {
      await q.query(
        `CREATE TRIGGER finance_policy_change_immutable BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION finance_policy_change_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER finance_policy_change_no_truncate BEFORE TRUNCATE ON ${t} FOR EACH STATEMENT EXECUTE FUNCTION finance_policy_change_immutable()`,
      );
      if (t !== 'finance_policy_change_audits') {
        await q.query(
          `CREATE CONSTRAINT TRIGGER finance_policy_change_guard AFTER INSERT ON ${t} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_policy_change_guard()`,
        );
        await q.query(
          `CREATE CONSTRAINT TRIGGER finance_policy_change_audit_required AFTER INSERT ON ${t} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_policy_change_audit_required()`,
        );
      }
    }
    for (const t of [
      'finance_receivable_requests',
      'finance_receivable_decisions',
      'finance_outgoing_calls',
      'finance_outgoing_events',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER finance_policy_change_link_guard AFTER INSERT ON ${t} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_policy_change_guard()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const t of tables)
      if (
        (await q.query(`SELECT EXISTS(SELECT 1 FROM ${t}) present`))[0].present
      )
        throw new Error(
          'Policy-change/refund evidence or mandates must be retained.',
        );
    for (const t of [
      'finance_receivable_requests',
      'finance_receivable_decisions',
      'finance_outgoing_calls',
      'finance_outgoing_events',
    ])
      await q.query(`DROP TRIGGER finance_policy_change_link_guard ON ${t}`);
    for (const t of [...tables].reverse()) await q.query(`DROP TABLE ${t}`);
    for (const fn of [
      'finance_policy_change_guard()',
      'finance_policy_change_audit_required()',
      'finance_policy_change_immutable()',
      'finance_policy_refund_eligible(uuid,boolean)',
      'finance_policy_head(uuid,uuid)',
      'finance_policy_root_entitlement(uuid)',
      'finance_policy_refund_reserved(uuid)',
    ])
      await q.query('DROP FUNCTION ' + fn);
  }
}
