import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Empty, inactive governance structures. No permissions or policies seeded. */
export class FinanceConfigurationReviews1796100000000 implements MigrationInterface {
  name = 'FinanceConfigurationReviews1796100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(queryRunner);
    await queryRunner.query(`CREATE TABLE finance_configuration_authorities (
      id uuid NOT NULL DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL,
      legal_entity_id uuid NOT NULL, book_id uuid NOT NULL, subject_id uuid NOT NULL,
      natural_person_id uuid NOT NULL, permission varchar(20) NOT NULL,
      state varchar(12) NOT NULL DEFAULT 'DRAFT', authority_reference varchar(200) NOT NULL,
      valid_from timestamptz NOT NULL, valid_to timestamptz, revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fin_config_authority" PRIMARY KEY (id),
      CONSTRAINT "CK_fin_config_authority_state" CHECK (state IN ('DRAFT','ENABLED','REVOKED')),
      CONSTRAINT "CK_fin_config_authority_permission" CHECK (permission IN ('PREPARE_CONFIG','REVIEW_CONFIG')),
      CONSTRAINT "CK_fin_config_authority_interval" CHECK (valid_to IS NULL OR valid_to > valid_from),
      CONSTRAINT "CK_fin_config_authority_ref" CHECK (btrim(authority_reference) <> ''),
      CONSTRAINT "FK_fin_config_authority_book" FOREIGN KEY (tenant_id, legal_entity_id, book_id)
        REFERENCES finance_accounting_books (tenant_id, legal_entity_id, id) ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_fin_config_actor" ON finance_configuration_authorities (tenant_id, legal_entity_id, book_id, subject_id, natural_person_id, permission)',
    );
    await queryRunner.query(`CREATE TABLE finance_configuration_releases (
      id uuid NOT NULL DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL,
      legal_entity_id uuid NOT NULL, book_id uuid NOT NULL, kind varchar(24) NOT NULL,
      configuration_key varchar(100) NOT NULL, version integer NOT NULL,
      effective_from date NOT NULL, effective_to date, payload jsonb NOT NULL,
      dependency_refs jsonb NOT NULL, maker_subject_id uuid NOT NULL,
      maker_natural_person_id uuid NOT NULL, release_hash varchar(64) NOT NULL,
      state varchar(24) NOT NULL DEFAULT 'DRAFT', supersedes_id uuid, supersedes_hash varchar(64),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fin_config_release" PRIMARY KEY (id),
      CONSTRAINT "CK_fin_config_state" CHECK (state IN ('DRAFT','SUBMITTED','REVIEWED_INACTIVE','REJECTED','SUPERSEDED_INACTIVE')),
      CONSTRAINT "CK_fin_config_kind" CHECK (kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS')),
      CONSTRAINT "CK_fin_config_version" CHECK (version > 0),
      CONSTRAINT "CK_fin_config_interval" CHECK (effective_to IS NULL OR effective_to > effective_from),
      CONSTRAINT "CK_fin_config_hash" CHECK (release_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT "CK_fin_config_key" CHECK (btrim(configuration_key) <> '' AND configuration_key = btrim(configuration_key)),
      CONSTRAINT "CK_fin_config_json" CHECK (jsonb_typeof(payload) = 'object' AND jsonb_typeof(dependency_refs) = 'array'),
      CONSTRAINT "CK_fin_config_predecessor" CHECK ((supersedes_id IS NULL) = (supersedes_hash IS NULL)),
      CONSTRAINT "FK_fin_config_release_book" FOREIGN KEY (tenant_id, legal_entity_id, book_id)
        REFERENCES finance_accounting_books (tenant_id, legal_entity_id, id) ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_config_scope" ON finance_configuration_releases (tenant_id, legal_entity_id, book_id, id)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_config_version" ON finance_configuration_releases (tenant_id, legal_entity_id, book_id, kind, configuration_key, version)',
    );
    await queryRunner.query(`ALTER TABLE finance_configuration_releases ADD CONSTRAINT "FK_fin_config_predecessor"
      FOREIGN KEY (tenant_id, legal_entity_id, book_id, supersedes_id)
      REFERENCES finance_configuration_releases (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE TABLE finance_configuration_events (
      id uuid NOT NULL DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL,
      legal_entity_id uuid NOT NULL, book_id uuid NOT NULL, release_id uuid NOT NULL,
      action varchar(24) NOT NULL, actor_subject_id uuid NOT NULL,
      actor_natural_person_id uuid NOT NULL, release_hash varchar(64) NOT NULL,
      reason text NOT NULL, details jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CONSTRAINT "PK_fin_config_event" PRIMARY KEY (id),
      CONSTRAINT "CK_fin_config_event_action" CHECK (action IN ('CREATED','SUBMITTED','REVIEWED_INACTIVE','REJECTED','SUPERSEDED_INACTIVE')),
      CONSTRAINT "CK_fin_config_event_reason" CHECK (btrim(reason) <> ''),
      CONSTRAINT "FK_fin_config_event_release" FOREIGN KEY (tenant_id, legal_entity_id, book_id, release_id)
        REFERENCES finance_configuration_releases (tenant_id, legal_entity_id, book_id, id) ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_config_event" ON finance_configuration_events (release_id, action)',
    );
    await queryRunner.query(`CREATE FUNCTION fn_fin_config_release_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
          RAISE EXCEPTION 'Configuration history cannot be removed' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'INSERT' THEN
          IF NEW.state <> 'DRAFT' THEN RAISE EXCEPTION 'Configuration must start as draft' USING ERRCODE = '23514'; END IF;
          RETURN NEW;
        END IF;
        IF (to_jsonb(NEW) - ARRAY['state','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state','updated_at']) THEN
          RAISE EXCEPTION 'Configuration subject is immutable; create a new version' USING ERRCODE = '23514';
        END IF;
        IF NOT ((OLD.state = 'DRAFT' AND NEW.state = 'SUBMITTED') OR
          (OLD.state = 'SUBMITTED' AND NEW.state IN ('REVIEWED_INACTIVE','REJECTED')) OR
          (OLD.state = 'REVIEWED_INACTIVE' AND NEW.state = 'SUPERSEDED_INACTIVE')) THEN
          RAISE EXCEPTION 'Invalid inactive configuration transition' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$`);
    await queryRunner.query(
      'CREATE TRIGGER fin_config_release_guard BEFORE INSERT OR UPDATE OR DELETE ON finance_configuration_releases FOR EACH ROW EXECUTE FUNCTION fn_fin_config_release_guard()',
    );
    await queryRunner.query(
      'CREATE TRIGGER fin_config_release_no_truncate BEFORE TRUNCATE ON finance_configuration_releases FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_config_release_guard()',
    );
    await queryRunner.query(`CREATE FUNCTION fn_fin_config_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE subject finance_configuration_releases%ROWTYPE;
      BEGIN
        IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Configuration audit is append-only' USING ERRCODE = '23514'; END IF;
        SELECT * INTO subject FROM finance_configuration_releases WHERE id = NEW.release_id;
        IF NOT FOUND OR subject.release_hash <> NEW.release_hash THEN
          RAISE EXCEPTION 'Configuration audit subject hash differs' USING ERRCODE = '23514';
        END IF;
        IF NEW.action IN ('CREATED','SUBMITTED') THEN
          IF NEW.actor_subject_id <> subject.maker_subject_id OR NEW.actor_natural_person_id <> subject.maker_natural_person_id THEN
            RAISE EXCEPTION 'Configuration audit requires the exact preparer' USING ERRCODE = '23514';
          END IF;
        ELSIF NEW.actor_subject_id = subject.maker_subject_id OR NEW.actor_natural_person_id = subject.maker_natural_person_id THEN
          RAISE EXCEPTION 'Configuration audit requires an independent human reviewer' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$`);
    await queryRunner.query(
      'CREATE TRIGGER fin_config_event_guard BEFORE INSERT OR UPDATE OR DELETE ON finance_configuration_events FOR EACH ROW EXECUTE FUNCTION fn_fin_config_event_guard()',
    );
    await queryRunner.query(
      'CREATE TRIGGER fin_config_event_no_truncate BEFORE TRUNCATE ON finance_configuration_events FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_config_event_guard()',
    );
    await queryRunner.query(`CREATE FUNCTION fn_fin_config_audit_required() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE required_action text;
      BEGIN
        required_action := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' ELSE NEW.state END;
        IF NOT EXISTS (SELECT 1 FROM finance_configuration_events e WHERE e.release_id = NEW.id
          AND e.tenant_id = NEW.tenant_id AND e.legal_entity_id = NEW.legal_entity_id AND e.book_id = NEW.book_id
          AND e.release_hash = NEW.release_hash AND e.action = required_action) THEN
          RAISE EXCEPTION 'Configuration transition requires its atomic audit event' USING ERRCODE = '23514';
        END IF;
        RETURN NULL;
      END $$`);
    await queryRunner.query(
      'CREATE CONSTRAINT TRIGGER fin_config_atomic_audit AFTER INSERT OR UPDATE ON finance_configuration_releases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_config_audit_required()',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [usage] = await queryRunner.query(`SELECT EXISTS (
      SELECT 1 FROM finance_configuration_releases UNION ALL
      SELECT 1 FROM finance_configuration_events UNION ALL
      SELECT 1 FROM finance_configuration_authorities
    ) AS in_use`);
    if (usage.in_use)
      throw new Error(
        'Configuration rollback requires empty governance structures; preserve existing evidence.',
      );
    await queryRunner.query('DROP TABLE finance_configuration_events');
    await queryRunner.query('DROP TABLE finance_configuration_releases');
    await queryRunner.query('DROP TABLE finance_configuration_authorities');
    await queryRunner.query('DROP FUNCTION fn_fin_config_audit_required()');
    await queryRunner.query('DROP FUNCTION fn_fin_config_event_guard()');
    await queryRunner.query('DROP FUNCTION fn_fin_config_release_guard()');
  }
}
