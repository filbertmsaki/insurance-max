import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
const tables = [
  'finance_claim_authorities',
  'finance_claim_records',
  'finance_claim_aliases',
  'finance_claim_reviews',
  'finance_claim_settlements',
  'finance_claim_events',
  'finance_claim_recovery_receipts',
  'finance_claim_recovery_decisions',
  'finance_claim_audits',
];
const scope =
    'tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL',
  book =
    'FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id)',
  unique = 'UNIQUE(tenant_id,legal_entity_id,book_id,id)';
const actor =
  'actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL REFERENCES finance_claim_authorities(id)';
const content =
  "subject jsonb NOT NULL,canonical_subject text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash=encode(sha256(convert_to(canonical_subject,'UTF8')),'hex')),CHECK(canonical_subject::jsonb=subject),CHECK(octet_length(canonical_subject)<=262144)";
const fk = (column: string, table = 'finance_claim_records') =>
  `FOREIGN KEY(tenant_id,legal_entity_id,book_id,${column}) REFERENCES ${table}(tenant_id,legal_entity_id,book_id,id)`;
/** Inactive controls only. No source claims, invoices, company mandates or policies are seeded. */
export class FinanceClaimsControls1797900000000 implements MigrationInterface {
  name = 'FinanceClaimsControls1797900000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(
      `CREATE TABLE finance_claim_authorities(id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),${scope},subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,permission text NOT NULL CHECK(permission IN ('OBSERVE_CLAIM','REVIEW_CLAIM','PREPARE_SETTLEMENT','REVIEW_SETTLEMENT','RECONCILE_CLAIM','READ_CLAIM','PREPARE_RECOVERY','REVIEW_RECOVERY')),currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),max_amount numeric(30,12) NOT NULL CHECK(max_amount>=0),state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),valid_from timestamptz NOT NULL,valid_to timestamptz NOT NULL,revoked_at timestamptz,CHECK(valid_to>valid_from),${book})`,
    );
    await q.query(
      `CREATE TABLE finance_claim_records(id uuid PRIMARY KEY,${scope},source_company_id uuid NOT NULL,root_id uuid NOT NULL,source_revision integer NOT NULL CHECK(source_revision>0),claim_id uuid NOT NULL,policy_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('CASE','PAYABLE','RECOVERY')),currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),previous_id uuid,inbox_id uuid NOT NULL,vector_hash text NOT NULL CHECK(vector_hash~'^[a-f0-9]{64}$'),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,kind,root_id,source_revision),${book},${fk('previous_id')},${fk('inbox_id', 'finance_integration_inboxes')})`,
    );
    await q.query(
      `CREATE TABLE finance_claim_aliases(id uuid PRIMARY KEY,${scope},record_id uuid NOT NULL,inbox_id uuid NOT NULL,state text NOT NULL CHECK(state IN ('MATCHED','CONFLICT_HELD')),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,book_id,inbox_id),${book},${fk('record_id')},${fk('inbox_id', 'finance_integration_inboxes')})`,
    );
    await q.query(
      `CREATE TABLE finance_claim_reviews(id uuid PRIMARY KEY,${scope},record_id uuid NOT NULL UNIQUE,decision text NOT NULL CHECK(decision IN ('REVIEWED_INACTIVE','REJECTED_INACTIVE')),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},${book},${fk('record_id')})`,
    );
    await q.query(
      `CREATE TABLE finance_claim_settlements(id uuid PRIMARY KEY,${scope},root_id uuid NOT NULL,claim_id uuid NOT NULL,head_id uuid NOT NULL,command_key text NOT NULL,amount numeric(30,12) NOT NULL CHECK(amount>0),currency varchar(3) NOT NULL,decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),beneficiary_hash text NOT NULL CHECK(beneficiary_hash~'^[a-f0-9]{64}$'),expires_at timestamptz NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},${fk('head_id')})`,
    );
    await q.query(
      `CREATE TABLE finance_claim_events(id uuid PRIMARY KEY,${scope},settlement_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('APPROVE','REJECT','CANCEL','BIND_EXECUTION','RECONCILE_CASH')),command_key text NOT NULL,outgoing_intent_id uuid,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},${fk('settlement_id', 'finance_claim_settlements')},${fk('outgoing_intent_id', 'finance_outgoing_intents')},CHECK((action='BIND_EXECUTION')=(outgoing_intent_id IS NOT NULL)))`,
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_claim_settlement_decision ON finance_claim_events(settlement_id) WHERE action IN ('APPROVE','REJECT')",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_claim_settlement_cancel ON finance_claim_events(settlement_id) WHERE action='CANCEL'",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_claim_execution ON finance_claim_events(outgoing_intent_id) WHERE action='BIND_EXECUTION'",
    );
    await q.query(
      `CREATE TABLE finance_claim_recovery_receipts(id uuid PRIMARY KEY,${scope},root_id uuid NOT NULL,claim_id uuid NOT NULL,recovery_id uuid NOT NULL,receipt_id uuid NOT NULL,command_key text NOT NULL,amount numeric(30,12) NOT NULL CHECK(amount>0),currency varchar(3) NOT NULL,decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},${fk('recovery_id')},${fk('receipt_id', 'finance_confirmed_receipts')})`,
    );
    await q.query(
      `CREATE TABLE finance_claim_recovery_decisions(id uuid PRIMARY KEY,${scope},receipt_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('APPROVE','REJECT','REVERSE')),command_key text NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},${fk('receipt_id', 'finance_claim_recovery_receipts')})`,
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_claim_recovery_decision ON finance_claim_recovery_decisions(receipt_id) WHERE action IN ('APPROVE','REJECT')",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_claim_recovery_reversal ON finance_claim_recovery_decisions(receipt_id) WHERE action='REVERSE'",
    );
    await q.query(
      `CREATE TABLE finance_claim_audits(id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),${scope},object_table text NOT NULL CHECK(object_table IN (${tables
        .slice(1, -1)
        .map((t) => "'" + t + "'")
        .join(
          ',',
        )})),object_id uuid NOT NULL UNIQUE,action text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash~'^[a-f0-9]{64}$'),actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${book})`,
    );
    for (const table of [
      'finance_claim_records',
      'finance_claim_settlements',
      'finance_claim_recovery_receipts',
    ])
      await q.query(
        `CREATE INDEX IDX_${table}_claim ON ${table}(tenant_id,claim_id)`,
      );
    await q.query(
      'CREATE INDEX IDX_claim_records_root ON finance_claim_records(tenant_id,kind,root_id,source_revision)',
    );
    await q.query(
      'CREATE INDEX IDX_claim_recovery_cash ON finance_claim_recovery_receipts(receipt_id)',
    );
    await q.query(
      `CREATE FUNCTION finance_claim_head(tenant uuid,category text,root uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT r.id FROM finance_claim_records r JOIN finance_claim_reviews d ON d.record_id=r.id AND d.decision='REVIEWED_INACTIVE' WHERE r.tenant_id=tenant AND r.kind=category AND r.root_id=root AND NOT EXISTS(SELECT 1 FROM finance_claim_records n JOIN finance_claim_reviews nd ON nd.record_id=n.id AND nd.decision='REVIEWED_INACTIVE' WHERE n.previous_id=r.id) ORDER BY r.source_revision DESC LIMIT 1 $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_current(tenant uuid,category text,root uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT finance_claim_head(tenant,category,root) IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_claim_records r LEFT JOIN finance_claim_reviews d ON d.record_id=r.id WHERE r.tenant_id=tenant AND r.kind=category AND r.root_id=root AND d.decision IS DISTINCT FROM 'REVIEWED_INACTIVE' AND NOT EXISTS(SELECT 1 FROM finance_claim_records n WHERE n.tenant_id=tenant AND n.kind=category AND n.root_id=root AND n.source_revision>r.source_revision)) AND NOT EXISTS(SELECT 1 FROM finance_claim_aliases a JOIN finance_claim_records r ON r.id=a.record_id WHERE r.tenant_id=tenant AND r.kind=category AND r.root_id=root AND a.state='CONFLICT_HELD') $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_legacy_consistent(tenant uuid,claim uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM finance_claim_records c WHERE c.id=finance_claim_head(tenant,'CASE',claim)
        AND NOT EXISTS(SELECT 1 FROM finance_claim_aliases a JOIN finance_claim_records r ON r.id=a.record_id WHERE r.tenant_id=tenant AND r.claim_id=claim AND r.kind='PAYABLE' AND a.state='CONFLICT_HELD')
        AND (SELECT COALESCE(sum((p.subject->'snapshot'->'data'->>'legacyPaid')::numeric),0) FROM finance_claim_records p WHERE p.tenant_id=tenant AND p.claim_id=claim AND p.kind='PAYABLE' AND NOT EXISTS(SELECT 1 FROM finance_claim_records n WHERE n.tenant_id=tenant AND n.kind='PAYABLE' AND n.root_id=p.root_id AND n.source_revision>p.source_revision)) <= (c.subject->'snapshot'->'data'->>'paidIndemnity')::numeric+(c.subject->'snapshot'->'data'->>'paidExpenses')::numeric
        AND (SELECT COALESCE(sum((p.subject->'snapshot'->'data'->>'legacyReserved')::numeric),0) FROM finance_claim_records p WHERE p.tenant_id=tenant AND p.claim_id=claim AND p.kind='PAYABLE' AND NOT EXISTS(SELECT 1 FROM finance_claim_records n WHERE n.tenant_id=tenant AND n.kind='PAYABLE' AND n.root_id=p.root_id AND n.source_revision>p.source_revision)) <= (c.subject->'snapshot'->'data'->>'legacyReserved')::numeric) $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_reserved(tenant uuid,root uuid,by_claim boolean DEFAULT false) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT COALESCE(sum(amount),0)::numeric(38,12) FROM finance_claim_settlements r WHERE r.tenant_id=tenant AND (CASE WHEN by_claim THEN r.claim_id=root ELSE r.root_id=root END) AND NOT EXISTS(SELECT 1 FROM finance_claim_events e WHERE e.settlement_id=r.id AND e.action IN ('REJECT','CANCEL')) $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_eligible(settlement uuid,approval boolean DEFAULT true) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM finance_claim_settlements r JOIN finance_claim_records p ON p.id=r.head_id JOIN finance_claim_records c ON c.id=finance_claim_head(r.tenant_id,'CASE',r.claim_id) WHERE r.id=settlement AND p.kind='PAYABLE' AND finance_claim_current(r.tenant_id,'PAYABLE',r.root_id) AND p.id=finance_claim_head(r.tenant_id,'PAYABLE',r.root_id) AND r.subject->'head'->>'hash'=p.subject_hash AND r.root_id=p.root_id AND r.claim_id=p.claim_id AND finance_claim_legacy_consistent(r.tenant_id,r.claim_id) AND finance_claim_current(r.tenant_id,'CASE',r.claim_id) AND p.subject->'snapshot'->'caseRef'->>'id'=c.id::text AND p.subject->'snapshot'->'caseRef'->>'hash'=c.subject_hash AND p.subject->'snapshot'->'data'->>'writer'='HANDOFF_RECONCILED' AND p.subject->'snapshot'->'data'->>'writerEvidenceHash' IS NOT NULL AND (p.subject->'snapshot'->'data'->>'sourceApproved')::boolean AND p.subject->'snapshot'->'data'->>'taxEvidenceHash' IS NOT NULL AND r.expires_at>statement_timestamp() AND (p.subject->'snapshot'->'data'->>'amount')::numeric-(p.subject->'snapshot'->'data'->>'legacyPaid')::numeric-(p.subject->'snapshot'->'data'->>'legacyReserved')::numeric>=finance_claim_reserved(r.tenant_id,r.root_id) AND c.subject->'snapshot'->'data'->>'acceptedOffer' IS NOT NULL AND least((c.subject->'snapshot'->'data'->>'approvedLimit')::numeric,(c.subject->'snapshot'->'data'->>'acceptedOffer')::numeric)-(c.subject->'snapshot'->'data'->>'paidIndemnity')::numeric-(c.subject->'snapshot'->'data'->>'paidExpenses')::numeric-(c.subject->'snapshot'->'data'->>'legacyReserved')::numeric>=finance_claim_reserved(r.tenant_id,r.claim_id,true) AND NOT EXISTS(SELECT 1 FROM finance_claim_events e WHERE e.settlement_id=r.id AND e.action IN ('REJECT','CANCEL')) AND (NOT approval OR EXISTS(SELECT 1 FROM finance_claim_events e JOIN finance_claim_authorities g ON g.id=e.authority_id WHERE e.settlement_id=r.id AND e.action='APPROVE' AND g.state='ENABLED' AND g.revoked_at IS NULL AND g.valid_from<=statement_timestamp() AND g.valid_to>=r.expires_at AND g.valid_to>statement_timestamp()))) $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_recovery_reserved(tenant uuid,root uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT COALESCE(sum(r.amount),0)::numeric(38,12) FROM finance_claim_recovery_receipts r WHERE r.tenant_id=tenant AND r.root_id=root AND NOT EXISTS(SELECT 1 FROM finance_claim_recovery_decisions d WHERE d.receipt_id=r.id AND d.action IN ('REJECT','REVERSE')) $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_receipt_reserved(receipt uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT COALESCE(sum(r.amount),0)::numeric(38,12) FROM finance_claim_recovery_receipts r WHERE r.receipt_id=receipt AND NOT EXISTS(SELECT 1 FROM finance_claim_recovery_decisions d WHERE d.receipt_id=r.id AND d.action IN ('REJECT','REVERSE')) $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_receipt_available(receipt uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT c.received-c.legacy_allocated-c.legacy_refunded-c.legacy_reserved-COALESCE((SELECT sum(CASE WHEN a.kind='ALLOCATE' AND d.decision IS DISTINCT FROM 'REJECTED_INACTIVE' THEN a.amount WHEN a.kind='REVERSE' AND d.decision='REVIEWED_INACTIVE' THEN -a.amount ELSE 0 END) FROM finance_receivable_requests a LEFT JOIN finance_receivable_decisions d ON d.request_id=a.id WHERE a.receipt_id=c.id),0)-finance_claim_receipt_reserved(c.id) FROM finance_confirmed_receipts c WHERE c.id=receipt $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_recovery_eligible(allocation uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM finance_claim_recovery_receipts a JOIN finance_claim_records r ON r.id=a.recovery_id JOIN finance_confirmed_receipts c ON c.id=a.receipt_id JOIN finance_claim_records h ON h.id=finance_claim_head(a.tenant_id,'CASE',a.claim_id) WHERE a.id=allocation AND r.kind='RECOVERY' AND r.root_id=a.root_id AND r.claim_id=a.claim_id AND finance_claim_current(a.tenant_id,'RECOVERY',a.root_id) AND r.id=finance_claim_head(a.tenant_id,'RECOVERY',a.root_id) AND finance_claim_current(a.tenant_id,'CASE',a.claim_id) AND r.subject->'snapshot'->'caseRef'->>'id'=h.id::text AND r.subject->'snapshot'->'caseRef'->>'hash'=h.subject_hash AND r.subject->'snapshot'->'data'->>'type'<>'REINSURANCE' AND r.subject->'snapshot'->'data'->>'legalStatus'='ESTABLISHED' AND r.subject->'snapshot'->'data'->>'legalEvidenceHash' IS NOT NULL AND r.subject->'snapshot'->'data'->>'debtorId'=c.customer_id::text AND c.currency=r.currency AND c.decimal_scale=r.decimal_scale AND c.source_company_id=r.source_company_id AND a.currency=r.currency AND a.decimal_scale=r.decimal_scale AND (r.subject->'snapshot'->'data'->>'expected')::numeric-(r.subject->'snapshot'->'data'->>'legacyReceived')::numeric>=finance_claim_recovery_reserved(a.tenant_id,a.root_id) AND finance_claim_receipt_available(c.id)>=0 AND NOT EXISTS(SELECT 1 FROM finance_receipt_sources z WHERE z.receipt_id=c.id AND z.state='CONFLICT_HELD') AND NOT EXISTS(SELECT 1 FROM finance_claim_recovery_decisions d WHERE d.receipt_id=a.id AND d.action IN ('REJECT','REVERSE'))) $$`,
    );
    await q.query(
      `CREATE FUNCTION finance_claim_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Claims control evidence is append-only';END $$`,
    );
    await q.query(`CREATE FUNCTION finance_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE payload jsonb:=to_jsonb(NEW);r finance_claim_records;h finance_claim_records;s finance_claim_settlements;a finance_claim_recovery_receipts;c finance_confirmed_receipts;g finance_claim_authorities;i finance_outgoing_intents;o finance_outgoing_evidence;req finance_receivable_requests;snap jsonb;d jsonb;need text;curr text;value numeric:=0;bound numeric;BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('finance-inactive-config:'||NEW.tenant_id::text,0));
    IF TG_TABLE_NAME IN ('finance_receivable_requests','finance_receivable_decisions') THEN
      IF TG_TABLE_NAME='finance_receivable_requests' THEN SELECT * INTO req FROM finance_receivable_requests WHERE id=NEW.id;ELSE SELECT * INTO req FROM finance_receivable_requests WHERE id=(payload->>'request_id')::uuid;END IF;
      IF req.receipt_id IS NOT NULL AND finance_claim_receipt_available(req.receipt_id)<0 THEN RAISE EXCEPTION 'Receipt capacity is reserved by claims recovery or billing';END IF;RETURN NEW;
    END IF;
    IF TG_TABLE_NAME IN ('finance_outgoing_events','finance_outgoing_calls') THEN
      IF (TG_TABLE_NAME='finance_outgoing_events' AND payload->>'action'='RESERVE') OR (TG_TABLE_NAME='finance_outgoing_calls' AND payload->>'operation'='SUBMIT') THEN
        SELECT * INTO i FROM finance_outgoing_intents WHERE id=(payload->>'intent_id')::uuid;SELECT * INTO o FROM finance_outgoing_evidence WHERE id=i.obligation_id;
        SELECT * INTO s FROM finance_claim_settlements WHERE tenant_id=i.tenant_id AND subject_hash=o.subject->'snapshot'->>'entitlementEvidenceHash';
        IF FOUND AND (NOT finance_claim_eligible(s.id) OR NOT EXISTS(SELECT 1 FROM finance_claim_events WHERE settlement_id=s.id AND outgoing_intent_id=i.id AND action='BIND_EXECUTION')) THEN RAISE EXCEPTION 'Claim cash is stale, unbound or exceeds entitlement';END IF;
      END IF;RETURN NEW;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM finance_accounting_books b JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id WHERE b.tenant_id=NEW.tenant_id AND b.legal_entity_id=NEW.legal_entity_id AND b.id=NEW.book_id AND b.state='DRAFT' AND l.state='DRAFT') THEN RAISE EXCEPTION 'Inactive claims scope unavailable';END IF;
    IF TG_TABLE_NAME='finance_claim_records' THEN
      need:='OBSERVE_CLAIM';curr:=NEW.currency;snap:=NEW.subject->'snapshot';
      IF NOT (snap->>'id'=NEW.root_id::text AND snap->>'kind'=NEW.kind AND snap->>'claimId'=NEW.claim_id::text AND snap->>'policyId'=NEW.policy_id::text AND snap->>'sourceCompanyId'=NEW.source_company_id::text AND snap->>'currency'=NEW.currency AND (snap->>'decimalScale')::integer=NEW.decimal_scale AND (snap->>'sourceRevision')::integer=NEW.source_revision AND (snap->'previous'->>'id')::uuid IS NOT DISTINCT FROM NEW.previous_id) IS TRUE THEN RAISE EXCEPTION 'Claim source identity vector differs';END IF;
      IF EXISTS(SELECT 1 FROM finance_claim_records x WHERE x.tenant_id=NEW.tenant_id AND x.claim_id=NEW.claim_id AND (x.book_id<>NEW.book_id OR x.legal_entity_id<>NEW.legal_entity_id OR x.source_company_id<>NEW.source_company_id OR x.policy_id<>NEW.policy_id OR x.currency<>NEW.currency OR x.decimal_scale<>NEW.decimal_scale)) THEN RAISE EXCEPTION 'Claim economic identity belongs to another scope';END IF;
    ELSIF TG_TABLE_NAME='finance_claim_aliases' THEN SELECT * INTO r FROM finance_claim_records WHERE id=NEW.record_id;need:='OBSERVE_CLAIM';curr:=r.currency;
      IF NEW.subject->>'recordHash' IS DISTINCT FROM r.subject_hash OR (NEW.state='MATCHED') IS DISTINCT FROM (((NEW.subject->'incomingSnapshot')-'sourceRevision'-'previous')=((r.subject->'snapshot')-'sourceRevision'-'previous')) THEN RAISE EXCEPTION 'Claim alias vector differs';END IF;
    ELSIF TG_TABLE_NAME='finance_claim_reviews' THEN
      SELECT * INTO r FROM finance_claim_records WHERE id=NEW.record_id;snap:=r.subject->'snapshot';d:=snap->'data';need:='REVIEW_CLAIM';curr:=r.currency;value:=CASE r.kind WHEN 'CASE' THEN greatest((d->>'caseEstimateIncludingPaid')::numeric,(d->>'approvedLimit')::numeric,(d->>'acceptedOffer')::numeric,(d->>'paidIndemnity')::numeric+(d->>'paidExpenses')::numeric+(d->>'legacyReserved')::numeric) WHEN 'PAYABLE' THEN greatest((d->>'amount')::numeric,(d->>'legacyPaid')::numeric+(d->>'legacyReserved')::numeric) ELSE greatest((d->>'expected')::numeric,(d->>'legacyReceived')::numeric) END;
      IF NEW.actor_subject_id=r.actor_subject_id OR NEW.actor_natural_person_id=r.actor_natural_person_id OR (d->'beneficiary'->'naturalPersonIds') ? NEW.actor_natural_person_id::text THEN RAISE EXCEPTION 'Independent claims review required';END IF;
      IF NEW.subject->>'recordHash' IS DISTINCT FROM r.subject_hash THEN RAISE EXCEPTION 'Claims review hash differs';END IF;
      IF NEW.decision='REVIEWED_INACTIVE' THEN
        IF EXISTS(SELECT 1 FROM finance_claim_records x WHERE x.tenant_id=r.tenant_id AND x.kind=r.kind AND x.root_id=r.root_id AND x.source_revision>r.source_revision) OR EXISTS(SELECT 1 FROM finance_claim_aliases x JOIN finance_claim_records z ON z.id=x.record_id WHERE z.tenant_id=r.tenant_id AND z.kind=r.kind AND z.root_id=r.root_id AND x.state='CONFLICT_HELD') THEN RAISE EXCEPTION 'Current unconflicted claims source required';END IF;
        SELECT x.* INTO h FROM finance_claim_records x JOIN finance_claim_reviews z ON z.record_id=x.id AND z.decision='REVIEWED_INACTIVE' WHERE x.tenant_id=r.tenant_id AND x.kind=r.kind AND x.root_id=r.root_id AND x.id<>r.id ORDER BY x.source_revision DESC LIMIT 1;
        IF r.previous_id IS DISTINCT FROM h.id OR (h.id IS NOT NULL AND snap->'previous'->>'hash' IS DISTINCT FROM h.subject_hash) THEN RAISE EXCEPTION 'Claims chain changed';END IF;
        IF r.kind='CASE' THEN IF (d->>'caseEstimateIncludingPaid')::numeric-(d->>'paidIndemnity')::numeric-(d->>'paidExpenses')::numeric IS DISTINCT FROM (d->>'caseOutstanding')::numeric THEN RAISE EXCEPTION 'Claims paid/case components differ';END IF;
        ELSE
          SELECT * INTO h FROM finance_claim_records WHERE id=finance_claim_head(r.tenant_id,'CASE',r.claim_id);
          IF NOT finance_claim_current(r.tenant_id,'CASE',r.claim_id) OR snap->'caseRef'->>'id' IS DISTINCT FROM h.id::text OR snap->'caseRef'->>'hash' IS DISTINCT FROM h.subject_hash THEN RAISE EXCEPTION 'Current reviewed case required';END IF;
          IF r.kind='PAYABLE' AND (NOT COALESCE((d->>'sourceApproved')::boolean,false) OR d->>'taxEvidenceHash' IS NULL) THEN RAISE EXCEPTION 'Claims source approval or tax unresolved';END IF;
          IF r.kind='PAYABLE' AND EXISTS(SELECT 1 FROM finance_claim_records x JOIN finance_claim_reviews z ON z.record_id=x.id AND z.decision='REVIEWED_INACTIVE' WHERE x.tenant_id=r.tenant_id AND x.kind=r.kind AND x.root_id=r.root_id AND x.id<>r.id AND x.subject->'snapshot'->'data'->'beneficiary' IS DISTINCT FROM d->'beneficiary') THEN RAISE EXCEPTION 'Claim payee changed';END IF;
          IF r.kind='RECOVERY' AND (d->>'type'='REINSURANCE' OR d->>'legalStatus'<>'ESTABLISHED' OR d->>'debtorId' IS NULL OR d->>'legalEvidenceHash' IS NULL) THEN RAISE EXCEPTION 'Recovery rights or B19 ownership unresolved';END IF;
        END IF;
      END IF;
    ELSIF TG_TABLE_NAME='finance_claim_settlements' THEN
      need:='PREPARE_SETTLEMENT';curr:=NEW.currency;value:=NEW.amount;SELECT * INTO r FROM finance_claim_records WHERE id=NEW.head_id;
      IF NOT finance_claim_eligible(NEW.id,false) OR NEW.currency<>r.currency OR NEW.decimal_scale<>r.decimal_scale OR (NEW.subject->'plan'->>'amount')::numeric<>NEW.amount OR NEW.subject->'plan'->'beneficiary' IS DISTINCT FROM r.subject->'snapshot'->'data'->'beneficiary' THEN RAISE EXCEPTION 'Claim settlement exceeds current payable or shared case capacity';END IF;
    ELSIF TG_TABLE_NAME='finance_claim_events' THEN
      SELECT * INTO s FROM finance_claim_settlements WHERE id=NEW.settlement_id;curr:=s.currency;value:=s.amount;need:=CASE WHEN NEW.action IN ('APPROVE','REJECT','CANCEL') THEN 'REVIEW_SETTLEMENT' WHEN NEW.action='RECONCILE_CASH' THEN 'RECONCILE_CLAIM' ELSE 'PREPARE_SETTLEMENT' END;
      IF NEW.subject->>'settlementHash' IS DISTINCT FROM s.subject_hash THEN RAISE EXCEPTION 'Claim settlement hash differs';END IF;
      IF NEW.action IN ('APPROVE','REJECT','CANCEL','RECONCILE_CASH') AND (NEW.actor_subject_id=s.actor_subject_id OR NEW.actor_natural_person_id=s.actor_natural_person_id OR (s.subject->'plan'->'beneficiary'->'naturalPersonIds') ? NEW.actor_natural_person_id::text) THEN RAISE EXCEPTION 'Independent claim settlement checker required';END IF;
      IF NEW.action='APPROVE' AND NOT finance_claim_eligible(s.id,false) THEN RAISE EXCEPTION 'Claim approval stale';END IF;
      IF NEW.action='BIND_EXECUTION' THEN
        SELECT * INTO i FROM finance_outgoing_intents WHERE id=NEW.outgoing_intent_id;SELECT * INTO o FROM finance_outgoing_evidence WHERE id=i.obligation_id;
        IF NOT finance_claim_eligible(s.id) OR i.beneficiary_hash<>s.beneficiary_hash OR i.currency<>s.currency OR i.decimal_scale<>s.decimal_scale OR i.expires_at>s.expires_at OR o.subject->'snapshot'->>'obligationId'<>s.id::text OR o.subject->'snapshot'->>'entitlementEvidenceHash'<>s.subject_hash OR NOT EXISTS(SELECT 1 FROM finance_outgoing_events WHERE intent_id=i.id AND action='APPROVE') OR EXISTS(SELECT 1 FROM finance_outgoing_calls WHERE intent_id=i.id) THEN RAISE EXCEPTION 'Exact approved unexecuted claim intent required';END IF;
        SELECT COALESCE(sum(ci.amount),0) INTO bound FROM finance_claim_events e JOIN finance_outgoing_intents ci ON ci.id=e.outgoing_intent_id WHERE e.settlement_id=s.id AND e.action='BIND_EXECUTION' AND NOT EXISTS(SELECT 1 FROM finance_outgoing_events ce WHERE ce.intent_id=ci.id AND ce.action='CANCEL') AND NOT EXISTS(SELECT 1 FROM finance_outgoing_observations co WHERE co.intent_id=ci.id AND co.state='FAILED_FINAL' AND NOT finance_outgoing_exception(ci.id));IF bound>s.amount THEN RAISE EXCEPTION 'Claim executions exceed settlement';END IF;
      END IF;
      IF NEW.action IN ('CANCEL','REJECT') AND EXISTS(SELECT 1 FROM finance_claim_events e WHERE e.settlement_id=s.id AND e.action='BIND_EXECUTION' AND NOT EXISTS(SELECT 1 FROM finance_outgoing_events ce WHERE ce.intent_id=e.outgoing_intent_id AND ce.action='CANCEL') AND NOT EXISTS(SELECT 1 FROM finance_outgoing_observations co WHERE co.intent_id=e.outgoing_intent_id AND co.state='FAILED_FINAL' AND NOT finance_outgoing_exception(co.intent_id))) THEN RAISE EXCEPTION 'Claim cash still consumes capacity';END IF;
    ELSIF TG_TABLE_NAME='finance_claim_recovery_receipts' THEN
      need:='PREPARE_RECOVERY';curr:=NEW.currency;value:=NEW.amount;SELECT * INTO r FROM finance_claim_records WHERE id=NEW.recovery_id;SELECT * INTO c FROM finance_confirmed_receipts WHERE id=NEW.receipt_id;
      IF NOT finance_claim_recovery_eligible(NEW.id) OR NEW.subject->>'recoveryHash' IS DISTINCT FROM r.subject_hash OR NEW.subject->'plan'->'receipt'->>'hash' IS DISTINCT FROM c.subject_hash OR (NEW.subject->'plan'->>'amount')::numeric<>NEW.amount THEN RAISE EXCEPTION 'Recovery allocation exceeds exact legal right or shared receipt capacity';END IF;
    ELSIF TG_TABLE_NAME='finance_claim_recovery_decisions' THEN
      SELECT * INTO a FROM finance_claim_recovery_receipts WHERE id=NEW.receipt_id;need:='REVIEW_RECOVERY';curr:=a.currency;value:=a.amount;
      IF NEW.actor_subject_id=a.actor_subject_id OR NEW.actor_natural_person_id=a.actor_natural_person_id OR NEW.subject->>'receiptHash' IS DISTINCT FROM a.subject_hash THEN RAISE EXCEPTION 'Independent exact recovery review required';END IF;
      IF NEW.action='APPROVE' AND NOT finance_claim_recovery_eligible(a.id) THEN RAISE EXCEPTION 'Recovery allocation stale or over capacity';END IF;
      IF NEW.action='REVERSE' AND NOT EXISTS(SELECT 1 FROM finance_claim_recovery_decisions WHERE receipt_id=a.id AND action='APPROVE') THEN RAISE EXCEPTION 'Exact approved recovery allocation required for reversal';END IF;
    END IF;
    SELECT * INTO g FROM finance_claim_authorities WHERE id=NEW.authority_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND subject_id=NEW.actor_subject_id AND natural_person_id=NEW.actor_natural_person_id AND permission=need AND currency=curr AND max_amount>=value AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND valid_to>statement_timestamp();IF NOT FOUND THEN RAISE EXCEPTION 'Current scoped claims authority required';END IF;
    IF TG_TABLE_NAME='finance_claim_events' AND payload->>'action'='APPROVE' AND g.valid_to<s.expires_at THEN RAISE EXCEPTION 'Claim authority does not cover lifetime';END IF;
    IF NOT EXISTS(SELECT 1 FROM finance_claim_audits WHERE object_table=TG_TABLE_NAME AND object_id=NEW.id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND subject_hash=NEW.subject_hash AND actor_subject_id=NEW.actor_subject_id AND actor_natural_person_id=NEW.actor_natural_person_id) THEN RAISE EXCEPTION 'Claims transaction-bound audit required';END IF;RETURN NEW;END $$`);
    for (const t of tables.slice(1))
      await q.query(
        `CREATE TRIGGER finance_claim_immutable BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION finance_claim_immutable()`,
      );
    for (const t of [
      ...tables.slice(1, -1),
      'finance_outgoing_events',
      'finance_outgoing_calls',
      'finance_receivable_requests',
      'finance_receivable_decisions',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER finance_claim_guard AFTER INSERT ON ${t} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_claim_guard()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const t of tables)
      if (
        (await q.query(`SELECT EXISTS(SELECT 1 FROM ${t}) present`))[0].present
      )
        throw new Error('Claims evidence and mandates must be retained.');
    for (const t of [
      'finance_outgoing_events',
      'finance_outgoing_calls',
      'finance_receivable_requests',
      'finance_receivable_decisions',
    ])
      await q.query(`DROP TRIGGER finance_claim_guard ON ${t}`);
    for (const t of [...tables].reverse()) await q.query(`DROP TABLE ${t}`);
    for (const f of [
      'finance_claim_guard()',
      'finance_claim_immutable()',
      'finance_claim_recovery_eligible(uuid)',
      'finance_claim_receipt_available(uuid)',
      'finance_claim_receipt_reserved(uuid)',
      'finance_claim_recovery_reserved(uuid,uuid)',
      'finance_claim_eligible(uuid,boolean)',
      'finance_claim_legacy_consistent(uuid,uuid)',
      'finance_claim_reserved(uuid,uuid,boolean)',
      'finance_claim_current(uuid,text,uuid)',
      'finance_claim_head(uuid,text,uuid)',
    ])
      await q.query('DROP FUNCTION ' + f);
  }
}
