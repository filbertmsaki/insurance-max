import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Empty inactive source-event registries. No live routing or credentials. */
export class FinanceEventContractPreviews1796500000000 implements MigrationInterface {
  name = 'FinanceEventContractPreviews1796500000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK (kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES','EVENT_CONTRACTS','EVENT_ROUTES'))`,
    );
    await q.query(`CREATE TABLE finance_event_producer_keys (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,producer_id varchar(80) NOT NULL,subject_id uuid NOT NULL,
      source_system varchar(80) NOT NULL,source_company_id varchar(200) NOT NULL,version integer NOT NULL CHECK(version>0),
      public_key_pem text NOT NULL CHECK(btrim(public_key_pem)<>''),key_fingerprint varchar(64) NOT NULL CHECK(key_fingerprint~'^[0-9a-f]{64}$'),
      authority_reference varchar(200) NOT NULL CHECK(btrim(authority_reference)<>''),state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),
      valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),
      UNIQUE(tenant_id,id),UNIQUE(tenant_id,producer_id,source_system,source_company_id,id)
    )`);
    await q.query(`CREATE TABLE finance_source_event_previews (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,source_system varchar(80) NOT NULL,source_company_id varchar(200) NOT NULL,
      economic_root varchar(64) NOT NULL CHECK(economic_root~'^[0-9a-f]{64}$'),source_revision integer NOT NULL CHECK(source_revision>0),
      previous_preview_id uuid,semantic_hash varchar(64) NOT NULL CHECK(semantic_hash~'^[0-9a-f]{64}$'),subject jsonb NOT NULL CHECK(jsonb_typeof(subject)='object'),
      target_hash varchar(64) NOT NULL CHECK(target_hash~'^[0-9a-f]{64}$'),target_manifest jsonb NOT NULL CHECK(jsonb_typeof(target_manifest)='array' AND jsonb_array_length(target_manifest) BETWEEN 1 AND 20),
      state varchar(24) NOT NULL DEFAULT 'VALIDATED_INACTIVE' CHECK(state='VALIDATED_INACTIVE'),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK((source_revision=1 AND previous_preview_id IS NULL) OR (source_revision>1 AND previous_preview_id IS NOT NULL)),
      UNIQUE(tenant_id,id),UNIQUE(tenant_id,economic_root,source_revision),
      FOREIGN KEY(tenant_id,previous_preview_id) REFERENCES finance_source_event_previews(tenant_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_source_event_preview_targets (
      tenant_id uuid NOT NULL,preview_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      route_id uuid NOT NULL,route_hash varchar(64) NOT NULL CHECK(route_hash~'^[0-9a-f]{64}$'),
      contract_id uuid NOT NULL,contract_hash varchar(64) NOT NULL CHECK(contract_hash~'^[0-9a-f]{64}$'),
      association_id uuid NOT NULL,association_hash varchar(64) NOT NULL CHECK(association_hash~'^[0-9a-f]{64}$'),
      source_map_id uuid NOT NULL,source_map_hash varchar(64) NOT NULL CHECK(source_map_hash~'^[0-9a-f]{64}$'),
      PRIMARY KEY(preview_id,book_id),
      FOREIGN KEY(tenant_id,preview_id) REFERENCES finance_source_event_previews(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,route_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,contract_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,association_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,source_map_id) REFERENCES finance_legal_entity_source_maps(tenant_id,legal_entity_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_source_event_preview_deliveries (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,producer_id varchar(80) NOT NULL,source_system varchar(80) NOT NULL,source_company_id varchar(200) NOT NULL,
      delivery_id uuid NOT NULL,event_id uuid NOT NULL,event_hash varchar(64) NOT NULL CHECK(event_hash~'^[0-9a-f]{64}$'),
      raw_hash varchar(64) NOT NULL CHECK(raw_hash~'^[0-9a-f]{64}$'),signature_hash varchar(64) NOT NULL CHECK(signature_hash~'^[0-9a-f]{64}$'),
      raw_body bytea NOT NULL CHECK(octet_length(raw_body) BETWEEN 1 AND 262144),signature_base64 varchar(88) NOT NULL CHECK(signature_base64~'^[A-Za-z0-9+/]{86}==$'),
      key_snapshot jsonb NOT NULL CHECK(jsonb_typeof(key_snapshot)='object'),
      key_id uuid NOT NULL,key_hash varchar(64) NOT NULL CHECK(key_hash~'^[0-9a-f]{64}$'),preview_id uuid NOT NULL,
      UNIQUE(tenant_id,id),UNIQUE(tenant_id,producer_id,delivery_id),
      FOREIGN KEY(tenant_id,preview_id) REFERENCES finance_source_event_previews(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,producer_id,source_system,source_company_id,key_id) REFERENCES finance_event_producer_keys(tenant_id,producer_id,source_system,source_company_id,id) ON DELETE RESTRICT
    )`);
    await q.query(
      'CREATE INDEX "IDX_fin_source_preview_event" ON finance_source_event_preview_deliveries(tenant_id,producer_id,event_id)',
    );
    await q.query(`CREATE TABLE finance_source_event_preview_audits (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,delivery_record_id uuid NOT NULL,preview_id uuid NOT NULL,
      actor_subject_id uuid NOT NULL,event_hash varchar(64) NOT NULL CHECK(event_hash~'^[0-9a-f]{64}$'),
      action varchar(24) NOT NULL DEFAULT 'VALIDATED_INACTIVE' CHECK(action='VALIDATED_INACTIVE'),occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(delivery_record_id),FOREIGN KEY(tenant_id,delivery_record_id) REFERENCES finance_source_event_preview_deliveries(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,preview_id) REFERENCES finance_source_event_previews(tenant_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE FUNCTION fn_fin_source_preview_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='INSERT' AND TG_TABLE_NAME='finance_source_event_preview_targets' THEN
        IF EXISTS(SELECT 1 FROM finance_source_event_preview_deliveries WHERE preview_id=NEW.preview_id) THEN RAISE EXCEPTION 'Source preview destinations are frozen'; END IF; RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Source preview evidence is immutable';
    END $$`);
    for (const table of [
      'finance_source_event_previews',
      'finance_source_event_preview_targets',
      'finance_source_event_preview_deliveries',
      'finance_source_event_preview_audits',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fn_fin_source_preview_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_source_preview_immutable()`,
      );
    }
    await q.query(
      'CREATE TRIGGER frozen_targets BEFORE INSERT ON finance_source_event_preview_targets FOR EACH ROW EXECUTE FUNCTION fn_fin_source_preview_immutable()',
    );
    await q.query(`CREATE FUNCTION fn_fin_source_preview_commit() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE expected jsonb; BEGIN
      IF TG_TABLE_NAME='finance_source_event_previews' THEN
        IF NEW.previous_preview_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_source_event_previews p WHERE p.id=NEW.previous_preview_id AND p.tenant_id=NEW.tenant_id AND p.economic_root=NEW.economic_root AND p.source_revision=NEW.source_revision-1) THEN RAISE EXCEPTION 'Source preview predecessor differs'; END IF;
        SELECT jsonb_agg(jsonb_build_object('legalEntityId',t.legal_entity_id,'bookId',t.book_id,'routeId',t.route_id,'routeHash',t.route_hash,'contractId',t.contract_id,'contractHash',t.contract_hash,'associationId',t.association_id,'associationHash',t.association_hash,'sourceMapId',t.source_map_id,'sourceMapHash',t.source_map_hash) ORDER BY t.book_id) INTO expected FROM finance_source_event_preview_targets t WHERE t.preview_id=NEW.id;
        IF expected IS DISTINCT FROM NEW.target_manifest OR NOT EXISTS(SELECT 1 FROM finance_source_event_preview_audits a WHERE a.preview_id=NEW.id AND a.tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'Source preview requires exact destinations and atomic audit'; END IF;
      ELSE
        IF NOT EXISTS(SELECT 1 FROM finance_source_event_preview_audits a JOIN finance_event_producer_keys k ON k.id=NEW.key_id AND k.tenant_id=NEW.tenant_id JOIN finance_source_event_previews p ON p.id=NEW.preview_id AND p.tenant_id=NEW.tenant_id WHERE a.delivery_record_id=NEW.id AND a.tenant_id=NEW.tenant_id AND a.preview_id=NEW.preview_id AND a.event_hash=NEW.event_hash AND a.actor_subject_id=k.subject_id AND p.source_system=NEW.source_system AND p.source_company_id=NEW.source_company_id AND k.state='ENABLED' AND k.revoked_at IS NULL AND k.valid_from<=statement_timestamp() AND (k.valid_to IS NULL OR k.valid_to>statement_timestamp())) THEN RAISE EXCEPTION 'Source delivery requires current producer authority and atomic audit'; END IF;
      END IF; RETURN NULL;
    END $$`);
    for (const table of [
      'finance_source_event_previews',
      'finance_source_event_preview_deliveries',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER source_preview_commit AFTER INSERT ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_source_preview_commit()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'finance_source_event_preview_audits',
      'finance_source_event_preview_deliveries',
      'finance_source_event_preview_targets',
      'finance_source_event_previews',
      'finance_event_producer_keys',
    ]) {
      const [r] = await q.query(
        `SELECT EXISTS(SELECT 1 FROM ${table}) AS in_use`,
      );
      if (r.in_use)
        throw new Error('Event preview rollback requires empty registries.');
    }
    const [profiles] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM finance_configuration_releases WHERE kind IN ('EVENT_CONTRACTS','EVENT_ROUTES')) AS in_use",
    );
    if (profiles.in_use)
      throw new Error(
        'Event preview rollback requires no new contract/route versions.',
      );
    await q.query(
      'DROP TABLE finance_source_event_preview_audits,finance_source_event_preview_deliveries,finance_source_event_preview_targets,finance_source_event_previews,finance_event_producer_keys',
    );
    await q.query(
      'DROP FUNCTION fn_fin_source_preview_commit(),fn_fin_source_preview_immutable()',
    );
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK (kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES'))`,
    );
  }
}
