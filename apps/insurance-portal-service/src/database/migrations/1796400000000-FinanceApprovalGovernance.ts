import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Inactive candidate governance only. No mandates, profiles or grants seeded. */
export class FinanceApprovalGovernance1796400000000 implements MigrationInterface {
  name = 'FinanceApprovalGovernance1796400000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK (kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES'))`,
    );
    await q.query(
      'ALTER TABLE finance_journal_candidate_authorities DROP CONSTRAINT finance_journal_candidate_authorities_permission_check',
    );
    await q.query(
      `ALTER TABLE finance_journal_candidate_authorities ADD CONSTRAINT finance_journal_candidate_authorities_permission_check CHECK (permission IN ('MANAGE_DRAFT_PERIOD','PREPARE_CANDIDATE','VALIDATE_CANDIDATE','READ_CANDIDATE_AUDIT'))`,
    );
    await q.query(`CREATE TABLE finance_approval_mandates (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      subject_id uuid NOT NULL, natural_person_id uuid NOT NULL, role_code varchar(80) NOT NULL CHECK (btrim(role_code) <> ''),
      currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'), max_amount numeric(38,12) NOT NULL CHECK (max_amount > 0 AND max_amount::text NOT IN ('NaN','Infinity','-Infinity')),
      delegated_from_id uuid, version integer NOT NULL CHECK (version>0), authority_reference varchar(200) NOT NULL CHECK (btrim(authority_reference) <> ''),
      state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','ENABLED','REVOKED')),
      valid_from timestamptz NOT NULL, valid_to timestamptz, revoked_at timestamptz,
      CHECK (valid_to IS NULL OR valid_to > valid_from), CHECK (delegated_from_id IS NULL OR delegated_from_id <> id),
      UNIQUE (tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY (tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books (tenant_id,legal_entity_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id,legal_entity_id,book_id,delegated_from_id) REFERENCES finance_approval_mandates (tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_approval_requests (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      candidate_id uuid NOT NULL UNIQUE, candidate_hash varchar(64) NOT NULL CHECK (candidate_hash ~ '^[0-9a-f]{64}$'),
      profile_id uuid NOT NULL, profile_hash varchar(64) NOT NULL CHECK (profile_hash ~ '^[0-9a-f]{64}$'),
      beneficiary jsonb NOT NULL CHECK (jsonb_typeof(beneficiary)='object'), beneficiary_hash varchar(64) NOT NULL CHECK (beneficiary_hash ~ '^[0-9a-f]{64}$'),
      amount numeric(38,12) NOT NULL CHECK (amount>0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')), currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
      subject jsonb NOT NULL CHECK (jsonb_typeof(subject)='object'), request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
      maker_subject_id uuid NOT NULL, maker_natural_person_id uuid NOT NULL, expires_at timestamptz NOT NULL,
      state varchar(24) NOT NULL DEFAULT 'OPEN_INACTIVE' CHECK (state IN ('OPEN_INACTIVE','REJECTED_INACTIVE','CONSUMED_INACTIVE')),
      consumed_subject_id uuid, consumed_natural_person_id uuid,
      CHECK ((state <> 'CONSUMED_INACTIVE' AND consumed_subject_id IS NULL AND consumed_natural_person_id IS NULL) OR (state='CONSUMED_INACTIVE' AND consumed_subject_id IS NOT NULL AND consumed_natural_person_id IS NOT NULL)),
      UNIQUE (tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY (tenant_id,legal_entity_id,book_id,candidate_id) REFERENCES finance_journal_candidates (tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id,legal_entity_id,book_id,profile_id) REFERENCES finance_configuration_releases (tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_approval_decisions (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      request_id uuid NOT NULL, mandate_id uuid NOT NULL, mandate_hash varchar(64) NOT NULL CHECK (mandate_hash ~ '^[0-9a-f]{64}$'),
      represented_natural_person_id uuid NOT NULL, actor_subject_id uuid NOT NULL, actor_natural_person_id uuid NOT NULL,
      action varchar(24) NOT NULL CHECK (action IN ('APPROVED_INACTIVE','REJECTED_INACTIVE')), decision_hash varchar(64) NOT NULL CHECK (decision_hash ~ '^[0-9a-f]{64}$'),
      UNIQUE(request_id,actor_natural_person_id), UNIQUE(request_id,represented_natural_person_id),
      UNIQUE(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY (tenant_id,legal_entity_id,book_id,request_id) REFERENCES finance_approval_requests (tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id,legal_entity_id,book_id,mandate_id) REFERENCES finance_approval_mandates (tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_approval_events (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      request_id uuid NOT NULL, decision_id uuid, action varchar(24) NOT NULL CHECK (action IN ('REQUESTED_INACTIVE','APPROVED_INACTIVE','REJECTED_INACTIVE','CONSUMED_INACTIVE')),
      request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'), actor_subject_id uuid NOT NULL, actor_natural_person_id uuid NOT NULL,
      reason text NOT NULL CHECK (btrim(reason) <> ''), occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK ((decision_id IS NULL AND action IN ('REQUESTED_INACTIVE','CONSUMED_INACTIVE')) OR (decision_id IS NOT NULL AND action IN ('APPROVED_INACTIVE','REJECTED_INACTIVE'))),
      UNIQUE(request_id,decision_id),
      FOREIGN KEY (tenant_id,legal_entity_id,book_id,request_id) REFERENCES finance_approval_requests (tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (tenant_id,legal_entity_id,book_id,decision_id) REFERENCES finance_approval_decisions (tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_approval_lifecycle_event" ON finance_approval_events(request_id,action) WHERE decision_id IS NULL',
    );
    await q.query(`CREATE FUNCTION fn_fin_approval_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='UPDATE' AND TG_TABLE_NAME='finance_approval_requests' AND OLD.state='OPEN_INACTIVE' AND NEW.state IN ('REJECTED_INACTIVE','CONSUMED_INACTIVE') AND
        (to_jsonb(OLD)-ARRAY['state','consumed_subject_id','consumed_natural_person_id']) IS NOT DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','consumed_subject_id','consumed_natural_person_id']) THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Approval subject and evidence are immutable';
    END $$`);
    for (const table of [
      'finance_approval_requests',
      'finance_approval_decisions',
      'finance_approval_events',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fn_fin_approval_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_approval_immutable()`,
      );
    }
    await q.query(`CREATE FUNCTION fn_fin_approval_commit() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE action_name text; BEGIN
      IF TG_TABLE_NAME='finance_approval_requests' THEN
        action_name=CASE WHEN TG_OP='INSERT' THEN 'REQUESTED_INACTIVE' ELSE NEW.state END;
        IF NOT EXISTS (SELECT 1 FROM finance_approval_events e WHERE e.request_id=NEW.id AND e.request_hash=NEW.request_hash AND e.action=action_name AND e.actor_subject_id=CASE WHEN action_name='CONSUMED_INACTIVE' THEN NEW.consumed_subject_id WHEN action_name='REQUESTED_INACTIVE' THEN NEW.maker_subject_id ELSE e.actor_subject_id END) THEN RAISE EXCEPTION 'Approval request requires atomic audit'; END IF;
        IF NEW.state='CONSUMED_INACTIVE' AND NOT EXISTS(SELECT 1 FROM finance_journal_candidates c WHERE c.id=NEW.candidate_id AND c.subject_hash=NEW.candidate_hash AND c.state='VALIDATED_INACTIVE' AND c.checker_subject_id=NEW.consumed_subject_id AND c.checker_natural_person_id=NEW.consumed_natural_person_id) THEN RAISE EXCEPTION 'Approval consumption requires matching inactive validation'; END IF;
        IF NEW.state='CONSUMED_INACTIVE' THEN
          IF NEW.expires_at<=statement_timestamp() OR COALESCE((NEW.subject->'profile'->>'requiredCheckers')::integer,0) NOT BETWEEN 1 AND 10 OR
            (SELECT count(*) FROM finance_approval_decisions d WHERE d.request_id=NEW.id) <> (NEW.subject->'profile'->>'requiredCheckers')::integer OR
            EXISTS(SELECT 1 FROM finance_approval_decisions d WHERE d.request_id=NEW.id AND (d.action<>'APPROVED_INACTIVE' OR d.actor_natural_person_id=NEW.maker_natural_person_id OR d.represented_natural_person_id=NEW.maker_natural_person_id OR d.actor_subject_id=NEW.maker_subject_id OR
              (NEW.beneficiary->>'mode'='REFERENCED' AND (NEW.beneficiary->'naturalPersonIds' ? d.actor_natural_person_id::text OR NEW.beneficiary->'naturalPersonIds' ? d.represented_natural_person_id::text)))) OR
            NOT EXISTS(SELECT 1 FROM finance_approval_decisions d WHERE d.request_id=NEW.id AND d.actor_subject_id=NEW.consumed_subject_id AND d.actor_natural_person_id=NEW.consumed_natural_person_id) OR
            EXISTS(SELECT 1 FROM finance_approval_decisions a JOIN finance_approval_decisions b ON a.request_id=b.request_id AND a.id<>b.id WHERE a.request_id=NEW.id AND (a.actor_natural_person_id IN (b.actor_natural_person_id,b.represented_natural_person_id) OR a.represented_natural_person_id IN (b.actor_natural_person_id,b.represented_natural_person_id)))
          THEN RAISE EXCEPTION 'Inactive approval quorum, expiry or segregation fails'; END IF;
          IF EXISTS(SELECT 1 FROM finance_approval_decisions d JOIN finance_approval_mandates m ON m.id=d.mandate_id LEFT JOIN finance_approval_mandates p ON p.id=m.delegated_from_id WHERE d.request_id=NEW.id AND
            (m.state<>'ENABLED' OR m.revoked_at IS NOT NULL OR m.valid_from>statement_timestamp() OR (m.valid_to IS NOT NULL AND m.valid_to<=statement_timestamp()) OR m.subject_id<>d.actor_subject_id OR m.natural_person_id<>d.actor_natural_person_id OR m.role_code<>NEW.subject->'profile'->>'roleCode' OR m.currency<>NEW.currency OR m.max_amount<NEW.amount OR
             (m.delegated_from_id IS NULL AND d.represented_natural_person_id<>m.natural_person_id) OR
             (m.delegated_from_id IS NOT NULL AND (p.id IS NULL OR p.delegated_from_id IS NOT NULL OR p.state<>'ENABLED' OR p.revoked_at IS NOT NULL OR p.valid_from>statement_timestamp() OR (p.valid_to IS NOT NULL AND p.valid_to<=statement_timestamp()) OR p.role_code<>m.role_code OR p.currency<>m.currency OR p.max_amount<m.max_amount OR p.valid_from>m.valid_from OR (p.valid_to IS NOT NULL AND (m.valid_to IS NULL OR p.valid_to<m.valid_to)) OR p.natural_person_id=m.natural_person_id OR p.natural_person_id<>d.represented_natural_person_id))))
          THEN RAISE EXCEPTION 'Inactive approval mandate expired or exceeds its authority'; END IF;
        END IF;
      ELSIF TG_TABLE_NAME='finance_approval_decisions' THEN
        IF NOT EXISTS (SELECT 1 FROM finance_approval_events e JOIN finance_approval_requests r ON r.id=e.request_id WHERE e.decision_id=NEW.id AND e.request_id=NEW.request_id AND e.request_hash=r.request_hash AND e.action=NEW.action AND e.actor_subject_id=NEW.actor_subject_id AND e.actor_natural_person_id=NEW.actor_natural_person_id) THEN RAISE EXCEPTION 'Approval decision requires atomic audit'; END IF;
      ELSE
        IF NEW.state='VALIDATED_INACTIVE' AND NOT EXISTS(SELECT 1 FROM finance_approval_requests r WHERE r.candidate_id=NEW.id AND r.candidate_hash=NEW.subject_hash AND r.state='CONSUMED_INACTIVE' AND r.consumed_subject_id=NEW.checker_subject_id AND r.consumed_natural_person_id=NEW.checker_natural_person_id) THEN RAISE EXCEPTION 'Inactive validation requires consumed approval'; END IF;
      END IF;
      RETURN NULL;
    END $$`);
    for (const table of [
      'finance_approval_requests',
      'finance_approval_decisions',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER approval_commit AFTER INSERT OR UPDATE ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_approval_commit()`,
      );
    await q.query(
      'CREATE CONSTRAINT TRIGGER approval_candidate_commit AFTER UPDATE ON finance_journal_candidates DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_approval_commit()',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'finance_approval_events',
      'finance_approval_decisions',
      'finance_approval_requests',
      'finance_approval_mandates',
    ]) {
      const [row] = await q.query(
        `SELECT EXISTS(SELECT 1 FROM ${table}) AS in_use`,
      );
      if (row.in_use)
        throw new Error(
          'Approval governance rollback requires empty registries.',
        );
    }
    const [used] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM finance_configuration_releases WHERE kind='APPROVAL_RULES') OR EXISTS(SELECT 1 FROM finance_journal_candidate_authorities WHERE permission='READ_CANDIDATE_AUDIT') AS in_use",
    );
    if (used.in_use)
      throw new Error(
        'Approval governance rollback requires empty new configuration and read grants.',
      );
    await q.query(
      'DROP TRIGGER approval_candidate_commit ON finance_journal_candidates',
    );
    await q.query(
      'DROP TABLE finance_approval_events,finance_approval_decisions,finance_approval_requests,finance_approval_mandates',
    );
    await q.query(
      'DROP FUNCTION fn_fin_approval_commit(),fn_fin_approval_immutable()',
    );
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK (kind IN ('POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS'))`,
    );
    await q.query(
      'ALTER TABLE finance_journal_candidate_authorities DROP CONSTRAINT finance_journal_candidate_authorities_permission_check',
    );
    await q.query(
      `ALTER TABLE finance_journal_candidate_authorities ADD CONSTRAINT finance_journal_candidate_authorities_permission_check CHECK (permission IN ('MANAGE_DRAFT_PERIOD','PREPARE_CANDIDATE','VALIDATE_CANDIDATE'))`,
    );
  }
}
