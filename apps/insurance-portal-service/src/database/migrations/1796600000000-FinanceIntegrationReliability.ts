import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Durable reception and inactive held-reference processing; no financial rules. */
export class FinanceIntegrationReliability1796600000000 implements MigrationInterface {
  name = 'FinanceIntegrationReliability1796600000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES','EVENT_CONTRACTS','EVENT_ROUTES','INTEGRATION_RULES'))`,
    );
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_integration_profile_tenant" ON finance_configuration_releases(tenant_id,id)',
    );
    await q.query(`CREATE TABLE finance_integration_channels (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),ingress_subject_id uuid NOT NULL,tenant_id uuid,producer_id varchar(80),producer_subject_id uuid,
      legal_entity_id uuid,book_id uuid,profile_id uuid,profile_hash varchar(64),owner_reference varchar(200) NOT NULL CHECK(btrim(owner_reference)<>''),
      version integer NOT NULL CHECK(version>0),state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),
      valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),
      CHECK((tenant_id IS NULL AND producer_id IS NULL AND producer_subject_id IS NULL AND legal_entity_id IS NULL AND book_id IS NULL AND profile_id IS NULL AND profile_hash IS NULL) OR
      (tenant_id IS NOT NULL AND producer_id IS NOT NULL AND producer_subject_id IS NOT NULL AND ((legal_entity_id IS NULL AND book_id IS NULL AND profile_id IS NULL AND profile_hash IS NULL) OR (legal_entity_id IS NOT NULL AND book_id IS NOT NULL AND profile_id IS NOT NULL AND profile_hash IS NOT NULL AND profile_hash~'^[0-9a-f]{64}$')))),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,profile_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_integration_authorities (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid,book_id uuid,subject_id uuid NOT NULL,
      permission varchar(24) NOT NULL CHECK(permission IN ('PROCESS_INTAKE','PROCESS_INBOX','DELIVER_OUTBOX','RECEIVE_OUTCOME','READ_RECONCILIATION')),
      consumer_id varchar(80),CHECK((permission='RECEIVE_OUTCOME' AND consumer_id IS NOT NULL AND btrim(consumer_id)<>'') OR (permission<>'RECEIVE_OUTCOME' AND consumer_id IS NULL)),
      state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),authority_reference varchar(200) NOT NULL CHECK(btrim(authority_reference)<>''),
      valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),
      CHECK((permission='PROCESS_INTAKE' AND legal_entity_id IS NULL AND book_id IS NULL) OR (permission<>'PROCESS_INTAKE' AND legal_entity_id IS NOT NULL AND book_id IS NOT NULL)),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_integration_intakes (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),channel_id uuid NOT NULL REFERENCES finance_integration_channels(id) ON DELETE RESTRICT,receipt_key uuid NOT NULL,
      tenant_id uuid,channel_snapshot jsonb NOT NULL,channel_hash varchar(64) NOT NULL CHECK(channel_hash~'^[0-9a-f]{64}$'),
      raw_body bytea,raw_hash varchar(64) NOT NULL CHECK(raw_hash~'^[0-9a-f]{64}$'),byte_length bigint NOT NULL CHECK(byte_length>=0),
      signature_input text,signature_hash varchar(64) NOT NULL CHECK(signature_hash~'^[0-9a-f]{64}$'),owner_reference varchar(200) NOT NULL,
      state varchar(28) NOT NULL CHECK(state IN ('PENDING','QUARANTINED','LEASED','RETRY_WAIT','HELD','DEAD_LETTER','DISPOSITION_RECORDED')),
      version integer NOT NULL DEFAULT 1 CHECK(version>0),attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
      lease_token uuid,lease_subject_id uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      reason_code varchar(64) NOT NULL,preview_id uuid,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(channel_id,receipt_key),UNIQUE(tenant_id,id),CHECK(tenant_id IS NOT NULL OR state='QUARANTINED'),
      CHECK(raw_body IS NULL OR octet_length(raw_body)<=262144),CHECK(signature_input IS NULL OR length(signature_input)<=1024),
      CHECK((state='LEASED' AND lease_token IS NOT NULL AND lease_subject_id IS NOT NULL AND lease_until IS NOT NULL) OR (state<>'LEASED' AND lease_token IS NULL AND lease_subject_id IS NULL AND lease_until IS NULL)),
      CHECK((state='DISPOSITION_RECORDED' AND preview_id IS NOT NULL) OR (state<>'DISPOSITION_RECORDED' AND preview_id IS NULL)),
      FOREIGN KEY(tenant_id,preview_id) REFERENCES finance_source_event_previews(tenant_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_integration_conflicts (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),intake_id uuid NOT NULL REFERENCES finance_integration_intakes(id) ON DELETE RESTRICT,
      tenant_id uuid,raw_hash varchar(64) NOT NULL,signature_hash varchar(64) NOT NULL,owner_reference varchar(200) NOT NULL,
      reason_code varchar(64) NOT NULL CHECK(reason_code='RECEIPT_KEY_CONTENT_CONFLICT'),created_at timestamptz NOT NULL DEFAULT statement_timestamp()
    )`);
    await q.query(`CREATE TABLE finance_integration_inboxes (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      preview_id uuid NOT NULL,semantic_hash varchar(64) NOT NULL CHECK(semantic_hash~'^[0-9a-f]{64}$'),target_hash varchar(64) NOT NULL,
      first_intake_id uuid NOT NULL,profile_id uuid NOT NULL,profile_hash varchar(64) NOT NULL,consumer_id varchar(80) NOT NULL,
      state varchar(24) NOT NULL DEFAULT 'HELD_INACTIVE' CHECK(state='HELD_INACTIVE'),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,book_id,preview_id),UNIQUE(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,first_intake_id) REFERENCES finance_integration_intakes(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,preview_id) REFERENCES finance_source_event_previews(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,profile_id) REFERENCES finance_configuration_releases(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_reference_dispositions (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,inbox_id uuid NOT NULL UNIQUE,
      owner_reference varchar(200) NOT NULL CHECK(btrim(owner_reference)<>''),reason_code varchar(64) NOT NULL CHECK(reason_code='UNRESOLVED_ACCOUNTING_POLICIES'),
      accounting_state varchar(24) NOT NULL CHECK(accounting_state='HELD_INACTIVE'),financial_effects integer NOT NULL CHECK(financial_effects=0),subject_hash varchar(64) NOT NULL,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_reference_outbox (
      id uuid PRIMARY KEY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,inbox_id uuid NOT NULL UNIQUE,
      profile_id uuid NOT NULL,profile_hash varchar(64) NOT NULL,control_entity_id uuid NOT NULL,control_book_id uuid NOT NULL,
      consumer_id varchar(80) NOT NULL,contract varchar(100) NOT NULL,payload jsonb NOT NULL,payload_hash varchar(64) NOT NULL CHECK(payload_hash~'^[0-9a-f]{64}$'),
      owner_reference varchar(200) NOT NULL,state varchar(24) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','LEASED','RETRY_WAIT','HELD_UNSUPPORTED','DEAD_LETTER','ACKNOWLEDGED')),
      version integer NOT NULL DEFAULT 1 CHECK(version>0),attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
      lease_token uuid,lease_subject_id uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      reason_code varchar(64) NOT NULL DEFAULT 'PENDING_DELIVERY',ack_receipt_id uuid,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,legal_entity_id,book_id,id),
      CHECK((state='LEASED' AND lease_token IS NOT NULL AND lease_subject_id IS NOT NULL AND lease_until IS NOT NULL) OR (state<>'LEASED' AND lease_token IS NULL AND lease_subject_id IS NULL AND lease_until IS NULL)),
      CHECK((state='ACKNOWLEDGED' AND ack_receipt_id IS NOT NULL) OR (state<>'ACKNOWLEDGED' AND ack_receipt_id IS NULL)),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,control_entity_id,control_book_id,profile_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_reference_receipts (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,consumer_id varchar(80) NOT NULL,
      message_id uuid NOT NULL,payload_hash varchar(64) NOT NULL CHECK(payload_hash~'^[0-9a-f]{64}$'),payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,consumer_id,message_id),FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_integration_audits (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid,legal_entity_id uuid,book_id uuid,
      intake_id uuid REFERENCES finance_integration_intakes(id) ON DELETE RESTRICT,conflict_id uuid REFERENCES finance_integration_conflicts(id) ON DELETE RESTRICT,
      inbox_id uuid REFERENCES finance_integration_inboxes(id) ON DELETE RESTRICT,outbox_id uuid REFERENCES finance_reference_outbox(id) ON DELETE RESTRICT,
      receipt_id uuid REFERENCES finance_reference_receipts(id) ON DELETE RESTRICT,
      action varchar(48) NOT NULL,version integer NOT NULL,lease_token uuid,actor_subject_id uuid NOT NULL,subject_hash varchar(64) NOT NULL,reason_code varchar(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),CHECK(num_nonnulls(intake_id,conflict_id,inbox_id,outbox_id,receipt_id)=1)
    )`);
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_intake_state_audit" ON finance_integration_audits(intake_id,version) WHERE intake_id IS NOT NULL',
    );
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_outbox_state_audit" ON finance_integration_audits(outbox_id,version) WHERE outbox_id IS NOT NULL AND action<>\'DISPATCH_STARTED\'',
    );
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_outbox_dispatch_audit" ON finance_integration_audits(outbox_id,lease_token) WHERE action=\'DISPATCH_STARTED\'',
    );
    await q.query(`CREATE FUNCTION fn_fin_integration_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('finance_integration_intakes','finance_reference_outbox') THEN
        IF NEW.version<>OLD.version+1 OR
          (to_jsonb(OLD)-ARRAY['state','version','attempt_count','lease_token','lease_subject_id','lease_until','next_attempt_at','reason_code','preview_id','ack_receipt_id']) IS DISTINCT FROM
          (to_jsonb(NEW)-ARRAY['state','version','attempt_count','lease_token','lease_subject_id','lease_until','next_attempt_at','reason_code','preview_id','ack_receipt_id']) THEN RAISE EXCEPTION 'Integration subject or version is immutable';END IF;
        IF OLD.state IN ('DISPOSITION_RECORDED','QUARANTINED','HELD','DEAD_LETTER','ACKNOWLEDGED','HELD_UNSUPPORTED') THEN RAISE EXCEPTION 'Terminal integration evidence cannot be reopened';END IF;RETURN NEW;
      END IF;RAISE EXCEPTION 'Integration evidence is append only';
    END $$`);
    for (const table of [
      'finance_integration_intakes',
      'finance_integration_conflicts',
      'finance_integration_inboxes',
      'finance_reference_dispositions',
      'finance_reference_outbox',
      'finance_reference_receipts',
      'finance_integration_audits',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fn_fin_integration_guard()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_integration_guard()`,
      );
    }
    await q.query(`CREATE FUNCTION fn_fin_integration_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_TABLE_NAME='finance_integration_intakes' THEN
        IF TG_OP='UPDATE' AND NEW.state='DISPOSITION_RECORDED' AND (OLD.state<>'LEASED' OR OLD.lease_until<=statement_timestamp() OR NOT EXISTS(SELECT 1 FROM finance_integration_audits a WHERE a.intake_id=NEW.id AND a.version=NEW.version AND a.lease_token=OLD.lease_token AND a.actor_subject_id=OLD.lease_subject_id)) THEN RAISE EXCEPTION 'Intake completion requires current fenced worker lease';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_integration_audits a WHERE a.intake_id=NEW.id AND a.version=NEW.version AND a.tenant_id IS NOT DISTINCT FROM NEW.tenant_id AND a.subject_hash=NEW.raw_hash) THEN RAISE EXCEPTION 'Intake requires atomic version audit';END IF;
        IF NEW.state='DISPOSITION_RECORDED' AND EXISTS(SELECT 1 FROM finance_source_event_preview_targets t WHERE t.preview_id=NEW.preview_id AND NOT EXISTS(SELECT 1 FROM finance_integration_inboxes i JOIN finance_reference_dispositions d ON d.inbox_id=i.id JOIN finance_reference_outbox o ON o.inbox_id=i.id WHERE i.tenant_id=NEW.tenant_id AND i.preview_id=NEW.preview_id AND i.legal_entity_id=t.legal_entity_id AND i.book_id=t.book_id)) THEN RAISE EXCEPTION 'Intake checkpoint requires every destination disposition and outbox';END IF;
      ELSIF TG_TABLE_NAME='finance_reference_outbox' THEN
        IF TG_OP='UPDATE' AND NEW.state='ACKNOWLEDGED' AND (OLD.state<>'LEASED' OR OLD.lease_until<=statement_timestamp() OR NOT EXISTS(SELECT 1 FROM finance_integration_audits a WHERE a.outbox_id=NEW.id AND a.version=NEW.version AND a.lease_token=OLD.lease_token AND a.actor_subject_id=OLD.lease_subject_id)) THEN RAISE EXCEPTION 'Acknowledgement requires current fenced worker lease';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_integration_audits a WHERE a.outbox_id=NEW.id AND a.version=NEW.version AND a.action<>'DISPATCH_STARTED' AND a.tenant_id=NEW.tenant_id AND a.legal_entity_id=NEW.legal_entity_id AND a.book_id=NEW.book_id AND a.subject_hash=NEW.payload_hash) THEN RAISE EXCEPTION 'Outbox requires atomic version audit';END IF;
      ELSIF TG_TABLE_NAME='finance_integration_inboxes' THEN
        IF NOT EXISTS(SELECT 1 FROM finance_reference_dispositions d JOIN finance_reference_outbox o ON o.inbox_id=d.inbox_id JOIN finance_integration_audits a ON a.inbox_id=d.inbox_id WHERE d.inbox_id=NEW.id AND a.tenant_id=NEW.tenant_id AND a.legal_entity_id=NEW.legal_entity_id AND a.book_id=NEW.book_id AND a.subject_hash=NEW.semantic_hash) THEN RAISE EXCEPTION 'Inbox requires disposition, outbox and atomic audit';END IF;
      ELSIF TG_TABLE_NAME='finance_reference_receipts' THEN
        IF NOT EXISTS(SELECT 1 FROM finance_integration_audits a WHERE a.receipt_id=NEW.id AND a.tenant_id=NEW.tenant_id AND a.legal_entity_id=NEW.legal_entity_id AND a.book_id=NEW.book_id AND a.subject_hash=NEW.payload_hash) THEN RAISE EXCEPTION 'Consumer receipt requires atomic audit';END IF;
      ELSE
        IF NOT EXISTS(SELECT 1 FROM finance_integration_audits a WHERE a.conflict_id=NEW.id AND a.tenant_id IS NOT DISTINCT FROM NEW.tenant_id) THEN RAISE EXCEPTION 'Intake conflict requires atomic audit';END IF;
      END IF;RETURN NULL;
    END $$`);
    for (const table of [
      'finance_integration_intakes',
      'finance_integration_conflicts',
      'finance_integration_inboxes',
      'finance_reference_outbox',
      'finance_reference_receipts',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER integration_commit AFTER INSERT OR UPDATE ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_integration_commit()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    const tables = [
      'finance_integration_audits',
      'finance_reference_receipts',
      'finance_reference_outbox',
      'finance_reference_dispositions',
      'finance_integration_inboxes',
      'finance_integration_conflicts',
      'finance_integration_intakes',
      'finance_integration_authorities',
      'finance_integration_channels',
    ];
    for (const table of tables) {
      const [r] = await q.query(
        `SELECT EXISTS(SELECT 1 FROM ${table}) AS in_use`,
      );
      if (r.in_use)
        throw new Error('Integration rollback requires empty registries.');
    }
    const [profiles] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM finance_configuration_releases WHERE kind='INTEGRATION_RULES') AS in_use",
    );
    if (profiles.in_use)
      throw new Error('Integration rollback requires no new profile versions.');
    await q.query('DROP TABLE ' + tables.join(','));
    await q.query('DROP INDEX "UQ_fin_integration_profile_tenant"');
    await q.query(
      'DROP FUNCTION fn_fin_integration_commit(),fn_fin_integration_guard()',
    );
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES','EVENT_CONTRACTS','EVENT_ROUTES'))`,
    );
  }
}
