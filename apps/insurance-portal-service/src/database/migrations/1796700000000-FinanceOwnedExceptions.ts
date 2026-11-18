import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceOwnedExceptions1796700000000 implements MigrationInterface {
  name = 'FinanceOwnedExceptions1796700000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES','EVENT_CONTRACTS','EVENT_ROUTES','INTEGRATION_RULES','EXCEPTION_RULES'))`,
    );
    await q.query(`CREATE TABLE finance_operations_authorities (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,scope_kind varchar(8) NOT NULL CHECK(scope_kind IN ('SOURCE','BOOK')),legal_entity_id uuid,book_id uuid,
      subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,permission varchar(32) NOT NULL CHECK(permission IN ('VIEW_EXCEPTIONS','OWN_EXCEPTION','ASSIGN_EXCEPTION','PREPARE_REPLAY','REVIEW_REPLAY','EXECUTE_REPLAY','ESCALATE_EXCEPTION','VERIFY_HANDOFF','READ_TELEMETRY')),
      state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),authority_reference varchar(200) NOT NULL CHECK(btrim(authority_reference)<>''),
      valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),
      CHECK((scope_kind='SOURCE' AND legal_entity_id IS NULL AND book_id IS NULL) OR (scope_kind='BOOK' AND legal_entity_id IS NOT NULL AND book_id IS NOT NULL)),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_owned_exceptions (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,scope_kind varchar(8) NOT NULL CHECK(scope_kind IN ('SOURCE','BOOK')),legal_entity_id uuid,book_id uuid,
      intake_id uuid,outbox_id uuid,observation jsonb NOT NULL CHECK(jsonb_typeof(observation)='object'),observation_hash varchar(64) NOT NULL CHECK(observation_hash~'^[0-9a-f]{64}$'),
      control_entity_id uuid NOT NULL,control_book_id uuid NOT NULL,profile_id uuid NOT NULL,profile_hash varchar(64) NOT NULL,
      owner_subject_id uuid,owner_natural_person_id uuid,assigned_at timestamptz,proposed_due_at timestamptz,origin_owner_reference varchar(200) NOT NULL,
      state varchar(24) NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','ESCALATED','MONITORING_REPLAY','CLOSED_OPERATIONAL')),version integer NOT NULL DEFAULT 1 CHECK(version>0),case_hash varchar(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK((scope_kind='SOURCE' AND intake_id IS NOT NULL AND outbox_id IS NULL AND legal_entity_id IS NULL AND book_id IS NULL) OR (scope_kind='BOOK' AND outbox_id IS NOT NULL AND intake_id IS NULL AND legal_entity_id IS NOT NULL AND book_id IS NOT NULL)),
      CHECK((owner_subject_id IS NULL AND owner_natural_person_id IS NULL AND assigned_at IS NULL AND proposed_due_at IS NULL) OR (owner_subject_id IS NOT NULL AND owner_natural_person_id IS NOT NULL AND assigned_at IS NOT NULL)),
      UNIQUE(tenant_id,id),UNIQUE(intake_id),UNIQUE(outbox_id),
      FOREIGN KEY(tenant_id,intake_id) REFERENCES finance_integration_intakes(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,outbox_id) REFERENCES finance_reference_outbox(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,control_entity_id,control_book_id,profile_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_replay_requests (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,case_id uuid NOT NULL,case_version integer NOT NULL,
      subject jsonb NOT NULL CHECK(jsonb_typeof(subject)='object'),request_hash varchar(64) NOT NULL CHECK(request_hash~'^[0-9a-f]{64}$'),
      maker_subject_id uuid NOT NULL,maker_natural_person_id uuid NOT NULL,reviewer_subject_id uuid,reviewer_natural_person_id uuid,reviewer_grant_id uuid,reviewer_grant_hash varchar(64),
      expires_at timestamptz NOT NULL,state varchar(12) NOT NULL DEFAULT 'PREPARED' CHECK(state IN ('PREPARED','APPROVED','REJECTED','EXECUTED')),
      CHECK((state='PREPARED' AND reviewer_subject_id IS NULL AND reviewer_natural_person_id IS NULL AND reviewer_grant_id IS NULL AND reviewer_grant_hash IS NULL) OR
        (state<>'PREPARED' AND reviewer_subject_id IS NOT NULL AND reviewer_natural_person_id IS NOT NULL AND reviewer_grant_id IS NOT NULL AND reviewer_grant_hash IS NOT NULL AND reviewer_subject_id<>maker_subject_id AND reviewer_natural_person_id<>maker_natural_person_id)),
      UNIQUE(case_id,case_version),FOREIGN KEY(tenant_id,case_id) REFERENCES finance_owned_exceptions(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(reviewer_grant_id) REFERENCES finance_operations_authorities(id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_replay_executions (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),request_id uuid NOT NULL UNIQUE REFERENCES finance_replay_requests(id) ON DELETE RESTRICT,
      tenant_id uuid NOT NULL,case_id uuid NOT NULL,lane varchar(8) NOT NULL CHECK(lane IN ('INTAKE','OUTBOX')),item_id uuid NOT NULL,
      before_version integer NOT NULL,after_version integer NOT NULL CHECK(after_version=before_version+1),prior_attempt_count integer NOT NULL,
      attempt_ceiling integer NOT NULL CHECK(attempt_ceiling>prior_attempt_count),executor_subject_id uuid NOT NULL,executor_natural_person_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,case_id) REFERENCES finance_owned_exceptions(tenant_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_operations_audits (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,case_id uuid NOT NULL,request_id uuid,execution_id uuid,
      action varchar(32) NOT NULL,case_version integer NOT NULL,subject_hash varchar(64) NOT NULL,
      actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),evidence jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,case_id) REFERENCES finance_owned_exceptions(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(request_id) REFERENCES finance_replay_requests(id) ON DELETE RESTRICT,
      FOREIGN KEY(execution_id) REFERENCES finance_replay_executions(id) ON DELETE RESTRICT
    )`);
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_exception_case_version_audit" ON finance_operations_audits(case_id,case_version) WHERE request_id IS NULL',
    );
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_exception_request_action" ON finance_operations_audits(request_id,action) WHERE request_id IS NOT NULL',
    );
    await q.query(`CREATE FUNCTION fn_fin_operations_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' THEN
      IF TG_TABLE_NAME='finance_owned_exceptions' THEN
      IF OLD.state<>'CLOSED_OPERATIONAL' AND NEW.version=OLD.version+1 AND
        (to_jsonb(OLD)-ARRAY['observation','observation_hash','owner_subject_id','owner_natural_person_id','assigned_at','proposed_due_at','state','version','case_hash']) IS NOT DISTINCT FROM
        (to_jsonb(NEW)-ARRAY['observation','observation_hash','owner_subject_id','owner_natural_person_id','assigned_at','proposed_due_at','state','version','case_hash']) THEN RETURN NEW;END IF;
      ELSIF TG_TABLE_NAME='finance_replay_requests' THEN
      IF
        (to_jsonb(OLD)-ARRAY['state','reviewer_subject_id','reviewer_natural_person_id','reviewer_grant_id','reviewer_grant_hash']) IS NOT DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','reviewer_subject_id','reviewer_natural_person_id','reviewer_grant_id','reviewer_grant_hash']) AND
        ((OLD.state='PREPARED' AND NEW.state IN ('APPROVED','REJECTED')) OR (OLD.state='APPROVED' AND NEW.state='EXECUTED' AND OLD.reviewer_subject_id=NEW.reviewer_subject_id AND OLD.reviewer_natural_person_id=NEW.reviewer_natural_person_id AND OLD.reviewer_grant_id=NEW.reviewer_grant_id AND OLD.reviewer_grant_hash=NEW.reviewer_grant_hash)) THEN RETURN NEW;END IF;
      END IF;END IF;
      RAISE EXCEPTION 'Operations subject and audit history are immutable';
    END $$`);
    for (const table of [
      'finance_owned_exceptions',
      'finance_replay_requests',
      'finance_replay_executions',
      'finance_operations_audits',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fn_fin_operations_guard()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_operations_guard()`,
      );
    }
    await q.query(`CREATE OR REPLACE FUNCTION fn_fin_integration_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('finance_integration_intakes','finance_reference_outbox') THEN
        IF NEW.version<>OLD.version+1 OR (to_jsonb(OLD)-ARRAY['state','version','attempt_count','lease_token','lease_subject_id','lease_until','next_attempt_at','reason_code','preview_id','ack_receipt_id']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','version','attempt_count','lease_token','lease_subject_id','lease_until','next_attempt_at','reason_code','preview_id','ack_receipt_id']) THEN RAISE EXCEPTION 'Integration subject or version is immutable';END IF;
        IF OLD.state IN ('HELD','DEAD_LETTER','HELD_UNSUPPORTED') AND NEW.state='RETRY_WAIT' AND NEW.attempt_count=OLD.attempt_count AND NEW.lease_token IS NULL AND NEW.lease_subject_id IS NULL AND NEW.lease_until IS NULL AND NEW.reason_code='CONTROLLED_REFERENCE_REPLAY' AND
          EXISTS(SELECT 1 FROM finance_replay_executions e JOIN finance_replay_requests r ON r.id=e.request_id JOIN finance_owned_exceptions c ON c.id=e.case_id WHERE e.tenant_id=OLD.tenant_id AND e.item_id=OLD.id AND e.lane=CASE WHEN TG_TABLE_NAME='finance_integration_intakes' THEN 'INTAKE' ELSE 'OUTBOX' END AND e.before_version=OLD.version AND e.after_version=NEW.version AND e.prior_attempt_count=OLD.attempt_count AND r.state='APPROVED' AND r.expires_at>statement_timestamp() AND r.case_version=c.version AND c.case_hash=r.subject->>'caseHash') THEN RETURN NEW;END IF;
        IF OLD.state IN ('DISPOSITION_RECORDED','QUARANTINED','HELD','DEAD_LETTER','ACKNOWLEDGED','HELD_UNSUPPORTED') THEN RAISE EXCEPTION 'Terminal integration evidence requires controlled replay';END IF;RETURN NEW;
      END IF;RAISE EXCEPTION 'Integration evidence is append only';END $$`);
    await q.query(`CREATE FUNCTION fn_fin_replay_authorized(request_id uuid) RETURNS boolean LANGUAGE sql AS $$
      SELECT EXISTS(SELECT 1 FROM finance_replay_requests r JOIN finance_owned_exceptions c ON c.id=r.case_id AND c.tenant_id=r.tenant_id
        JOIN finance_configuration_releases p ON p.id=c.profile_id AND p.tenant_id=c.tenant_id AND p.legal_entity_id=c.control_entity_id AND p.book_id=c.control_book_id
        WHERE r.id=request_id AND r.expires_at>statement_timestamp() AND r.subject->>'expiresAt'=to_char(r.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        AND r.maker_subject_id::text=r.subject->'maker'->>'subjectId' AND r.maker_natural_person_id::text=r.subject->'maker'->>'naturalPersonId' AND r.tenant_id::text=r.subject->'maker'->>'tenantId'
        AND c.owner_subject_id=r.maker_subject_id AND c.owner_natural_person_id=r.maker_natural_person_id
        AND p.kind='EXCEPTION_RULES' AND p.state='REVIEWED_INACTIVE' AND p.release_hash=c.profile_hash AND p.release_hash=r.subject->>'profileHash' AND p.id::text=r.subject->>'profileId' AND p.payload=r.subject->'policy'
        AND p.effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (p.effective_to IS NULL OR p.effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date)
        AND EXISTS(SELECT 1 FROM finance_operations_audits a WHERE a.case_id=c.id AND a.request_id IS NULL AND a.case_version=r.case_version AND a.subject_hash=r.subject->>'caseHash')
        AND ((r.state='EXECUTED' AND c.version=r.case_version+1 AND c.state='MONITORING_REPLAY') OR (r.state<>'EXECUTED' AND c.version=r.case_version AND c.case_hash=r.subject->>'caseHash'))
        AND NOT EXISTS(SELECT 1 FROM (VALUES ('OWN_EXCEPTION','ownerGrant'),('PREPARE_REPLAY','makerGrant')) v(permission,slot)
          WHERE NOT EXISTS(SELECT 1 FROM finance_operations_authorities g WHERE g.id::text=r.subject->v.slot->>'id' AND g.tenant_id=c.tenant_id AND g.scope_kind=c.scope_kind AND g.legal_entity_id IS NOT DISTINCT FROM c.legal_entity_id AND g.book_id IS NOT DISTINCT FROM c.book_id AND g.subject_id=r.maker_subject_id AND g.natural_person_id=r.maker_natural_person_id AND g.permission=v.permission AND g.state='ENABLED' AND g.revoked_at IS NULL AND g.valid_from<=statement_timestamp() AND (g.valid_to IS NULL OR g.valid_to>statement_timestamp())))
        AND (r.state='PREPARED' OR EXISTS(SELECT 1 FROM finance_operations_authorities g WHERE g.id=r.reviewer_grant_id AND g.tenant_id=c.tenant_id AND g.scope_kind=c.scope_kind AND g.legal_entity_id IS NOT DISTINCT FROM c.legal_entity_id AND g.book_id IS NOT DISTINCT FROM c.book_id AND g.subject_id=r.reviewer_subject_id AND g.natural_person_id=r.reviewer_natural_person_id AND g.permission='REVIEW_REPLAY' AND g.state='ENABLED' AND g.revoked_at IS NULL AND g.valid_from<=statement_timestamp() AND (g.valid_to IS NULL OR g.valid_to>statement_timestamp())))
        AND (r.state<>'EXECUTED' OR EXISTS(SELECT 1 FROM finance_operations_authorities g WHERE g.tenant_id=c.tenant_id AND g.scope_kind=c.scope_kind AND g.legal_entity_id IS NOT DISTINCT FROM c.legal_entity_id AND g.book_id IS NOT DISTINCT FROM c.book_id AND g.subject_id=r.reviewer_subject_id AND g.natural_person_id=r.reviewer_natural_person_id AND g.permission='EXECUTE_REPLAY' AND g.state='ENABLED' AND g.revoked_at IS NULL AND g.valid_from<=statement_timestamp() AND (g.valid_to IS NULL OR g.valid_to>statement_timestamp())))
      )
    $$`);
    await q.query(`CREATE FUNCTION fn_fin_operations_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_TABLE_NAME='finance_owned_exceptions' THEN
        IF NOT EXISTS(SELECT 1 FROM finance_operations_audits a WHERE a.case_id=NEW.id AND a.request_id IS NULL AND a.case_version=NEW.version AND a.subject_hash=NEW.case_hash AND a.tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'Exception update requires atomic audit';END IF;
      ELSIF TG_TABLE_NAME='finance_replay_requests' THEN
        IF NOT fn_fin_replay_authorized(NEW.id) THEN RAISE EXCEPTION 'Replay requires exact current scoped human authorities and frozen policy';END IF;
        IF NEW.state='EXECUTED' AND NOT EXISTS(SELECT 1 FROM finance_replay_executions e WHERE e.request_id=NEW.id AND e.tenant_id=NEW.tenant_id AND e.case_id=NEW.case_id AND e.executor_subject_id=NEW.reviewer_subject_id AND e.executor_natural_person_id=NEW.reviewer_natural_person_id) THEN RAISE EXCEPTION 'Executed replay requires its atomic execution record';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_operations_audits a WHERE a.request_id=NEW.id AND a.tenant_id=NEW.tenant_id AND a.case_id=NEW.case_id AND a.case_version=NEW.case_version+CASE WHEN NEW.state='EXECUTED' THEN 1 ELSE 0 END AND a.subject_hash=NEW.request_hash AND a.action=CASE WHEN TG_OP='INSERT' THEN 'REPLAY_PREPARED' ELSE 'REPLAY_'||NEW.state END AND a.actor_subject_id=CASE WHEN TG_OP='INSERT' THEN NEW.maker_subject_id ELSE NEW.reviewer_subject_id END AND a.actor_natural_person_id=CASE WHEN TG_OP='INSERT' THEN NEW.maker_natural_person_id ELSE NEW.reviewer_natural_person_id END) THEN RAISE EXCEPTION 'Replay request requires atomic audit';END IF;
      ELSE
        IF NOT fn_fin_replay_authorized(NEW.request_id) OR NOT EXISTS(SELECT 1 FROM finance_replay_requests r JOIN finance_owned_exceptions c ON c.id=r.case_id WHERE r.id=NEW.request_id AND r.tenant_id=NEW.tenant_id AND c.id=NEW.case_id AND NEW.attempt_ceiling=NEW.prior_attempt_count+(r.subject->'policy'->>'additionalAttempts')::integer AND NEW.item_id=COALESCE(c.intake_id,c.outbox_id) AND NEW.lane=CASE WHEN c.scope_kind='SOURCE' THEN 'INTAKE' ELSE 'OUTBOX' END) THEN RAISE EXCEPTION 'Replay execution scope or attempt budget is invalid';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_replay_requests r JOIN finance_owned_exceptions c ON c.id=r.case_id JOIN finance_operations_authorities g ON g.id=r.reviewer_grant_id WHERE r.id=NEW.request_id AND r.state='EXECUTED' AND r.expires_at>statement_timestamp() AND r.reviewer_subject_id=NEW.executor_subject_id AND r.reviewer_natural_person_id=NEW.executor_natural_person_id AND c.state='MONITORING_REPLAY' AND c.version=r.case_version+1 AND g.state='ENABLED' AND g.revoked_at IS NULL AND g.valid_from<=statement_timestamp() AND (g.valid_to IS NULL OR g.valid_to>statement_timestamp())) THEN RAISE EXCEPTION 'Replay execution requires current independent approval';END IF;
        IF NEW.lane='INTAKE' THEN
          IF NOT EXISTS(SELECT 1 FROM finance_integration_intakes i WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.item_id AND i.version=NEW.after_version AND i.state='RETRY_WAIT' AND i.attempt_count=NEW.prior_attempt_count) THEN RAISE EXCEPTION 'Replay must preserve original intake identity and attempts';END IF;
        ELSE
          IF NOT EXISTS(SELECT 1 FROM finance_reference_outbox o WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.item_id AND o.version=NEW.after_version AND o.state='RETRY_WAIT' AND o.attempt_count=NEW.prior_attempt_count AND o.contract='finance.reference-held.v1' AND o.payload->>'financialEffects'='0' AND o.payload->>'accountingState'='HELD_INACTIVE') THEN RAISE EXCEPTION 'Replay only supports the exact inactive reference outcome';END IF;
        END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_operations_audits a JOIN finance_replay_requests r ON r.id=NEW.request_id WHERE a.execution_id=NEW.id AND a.request_id=r.id AND a.tenant_id=NEW.tenant_id AND a.case_id=NEW.case_id AND a.case_version=r.case_version+1 AND a.subject_hash=r.request_hash AND a.action='REPLAY_EXECUTED' AND a.actor_subject_id=NEW.executor_subject_id AND a.actor_natural_person_id=NEW.executor_natural_person_id) THEN RAISE EXCEPTION 'Replay execution requires atomic audit';END IF;
      END IF;RETURN NULL;END $$`);
    for (const table of [
      'finance_owned_exceptions',
      'finance_replay_requests',
      'finance_replay_executions',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER operations_commit AFTER INSERT OR UPDATE ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_operations_commit()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'finance_operations_audits',
      'finance_replay_executions',
      'finance_replay_requests',
      'finance_owned_exceptions',
      'finance_operations_authorities',
    ]) {
      const [r] = await q.query(
        `SELECT EXISTS(SELECT 1 FROM ${table}) AS in_use`,
      );
      if (r.in_use)
        throw new Error('Owned exception rollback requires empty registries.');
    }
    const [p] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM finance_configuration_releases WHERE kind='EXCEPTION_RULES') AS in_use",
    );
    if (p.in_use)
      throw new Error('Owned exception rollback requires no new profiles.');
    await q.query(`CREATE OR REPLACE FUNCTION fn_fin_integration_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('finance_integration_intakes','finance_reference_outbox') THEN
        IF NEW.version<>OLD.version+1 OR (to_jsonb(OLD)-ARRAY['state','version','attempt_count','lease_token','lease_subject_id','lease_until','next_attempt_at','reason_code','preview_id','ack_receipt_id']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','version','attempt_count','lease_token','lease_subject_id','lease_until','next_attempt_at','reason_code','preview_id','ack_receipt_id']) THEN RAISE EXCEPTION 'Integration subject or version is immutable';END IF;
        IF OLD.state IN ('DISPOSITION_RECORDED','QUARANTINED','HELD','DEAD_LETTER','ACKNOWLEDGED','HELD_UNSUPPORTED') THEN RAISE EXCEPTION 'Terminal integration evidence cannot be reopened';END IF;RETURN NEW;
      END IF;RAISE EXCEPTION 'Integration evidence is append only';END $$`);
    await q.query(
      'DROP TABLE finance_operations_audits,finance_replay_executions,finance_replay_requests,finance_owned_exceptions,finance_operations_authorities',
    );
    await q.query(
      'DROP FUNCTION fn_fin_operations_commit(),fn_fin_operations_guard(),fn_fin_replay_authorized(uuid)',
    );
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES','EVENT_CONTRACTS','EVENT_ROUTES','INTEGRATION_RULES'))`,
    );
  }
}
