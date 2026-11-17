import { MigrationInterface, QueryRunner } from 'typeorm';

/** Inactive setup evidence only. No company configuration, grants or policy decisions are seeded. */
export class FinanceSetupReviews1797400000000 implements MigrationInterface {
  name = 'FinanceSetupReviews1797400000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE finance_setup_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      step text NOT NULL CHECK(step IN ('G04-01','G04-02','G04-03','G04-04','G04-05','G04-06','G04-07','G04-08','G04-09','G04-10')),
      version integer NOT NULL CHECK(version>0),maker_subject_id uuid NOT NULL,maker_natural_person_id uuid NOT NULL,
      subject jsonb NOT NULL,canonical_subject text NOT NULL,subject_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK(octet_length(canonical_subject)<=262144),CHECK(jsonb_typeof(subject)='object'),
      CHECK(canonical_subject::jsonb=subject),CHECK(subject_hash=encode(sha256(convert_to(canonical_subject,'UTF8')),'hex')),
      CHECK((subject ?& ARRAY['schema','step','version','scope','makerSubjectId','makerNaturalPersonId','input','sourceSnapshot','sourceHash']) IS TRUE),
      CHECK((subject->>'schema'='FINANCE_SETUP_V1' AND subject->>'step'=step AND (subject->>'version')::integer=version) IS TRUE),
      CHECK((subject->'scope'->>'tenantId'=tenant_id::text AND subject->'scope'->>'legalEntityId'=legal_entity_id::text AND subject->'scope'->>'bookId'=book_id::text) IS TRUE),
      CHECK((subject->>'makerSubjectId'=maker_subject_id::text AND subject->>'makerNaturalPersonId'=maker_natural_person_id::text) IS TRUE),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id),
      UNIQUE(tenant_id,legal_entity_id,book_id,step,version),UNIQUE(tenant_id,legal_entity_id,book_id,id))`);
    await q.query(`CREATE TABLE finance_setup_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
      version_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>0),
      action text NOT NULL CHECK(action IN ('CREATE','SUBMIT','REVIEW_INACTIVE','REJECT')),
      from_state text,to_state text NOT NULL CHECK(to_state IN ('DRAFT','SUBMITTED','REVIEWED_INACTIVE','REJECTED')),
      actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,identity_binding_id uuid NOT NULL,authority_id uuid NOT NULL,
      reason text NOT NULL CHECK(btrim(reason)<>'' AND length(reason)<=4000),
      previous_hash text,event_subject jsonb NOT NULL,canonical_event text NOT NULL,event_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK(octet_length(canonical_event)<=65536),CHECK(canonical_event::jsonb=event_subject),CHECK(event_hash=encode(sha256(convert_to(canonical_event,'UTF8')),'hex')),
      CHECK((event_subject ?& ARRAY['versionId','sequence','action','fromState','toState','actorSubjectId','actorNaturalPersonId','identityBindingId','authorityId','reason','previousHash']) IS TRUE),
      CHECK((event_subject->>'versionId'=version_id::text AND (event_subject->>'sequence')::integer=sequence AND event_subject->>'action'=action AND event_subject->>'toState'=to_state) IS TRUE),
      CHECK((event_subject->>'actorSubjectId'=actor_subject_id::text AND event_subject->>'actorNaturalPersonId'=actor_natural_person_id::text) IS TRUE),
      CHECK((event_subject->>'identityBindingId'=identity_binding_id::text AND event_subject->>'authorityId'=authority_id::text AND event_subject->>'reason'=reason) IS TRUE),
      CHECK((event_subject->>'previousHash') IS NOT DISTINCT FROM previous_hash AND (event_subject->>'fromState') IS NOT DISTINCT FROM from_state),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,version_id) REFERENCES finance_setup_versions(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(identity_binding_id) REFERENCES finance_foundation_identity_bindings(id),
      FOREIGN KEY(authority_id) REFERENCES finance_configuration_authorities(id),UNIQUE(version_id,sequence))`);
    await q.query(`CREATE FUNCTION finance_setup_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Finance setup evidence is immutable; create a new version'; END $$`);
    for (const t of ['finance_setup_versions', 'finance_setup_events'])
      await q.query(
        `CREATE TRIGGER ${t}_immutable BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION finance_setup_immutable()`,
      );
    await q.query(`CREATE FUNCTION finance_setup_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE v finance_setup_versions;prior finance_setup_events;required text;
      BEGIN
        SELECT * INTO v FROM finance_setup_versions WHERE id=NEW.version_id AND tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Setup version scope is unavailable'; END IF;
        SELECT * INTO prior FROM finance_setup_events WHERE version_id=v.id ORDER BY sequence DESC LIMIT 1;
        IF NEW.sequence<>COALESCE(prior.sequence,0)+1 OR NEW.previous_hash IS DISTINCT FROM prior.event_hash OR NEW.from_state IS DISTINCT FROM prior.to_state THEN RAISE EXCEPTION 'Setup event chain differs'; END IF;
        IF (NEW.action='CREATE' AND (prior.id IS NOT NULL OR NEW.to_state<>'DRAFT')) OR
           (NEW.action='SUBMIT' AND (prior.to_state IS DISTINCT FROM 'DRAFT' OR NEW.to_state<>'SUBMITTED')) OR
           (NEW.action='REVIEW_INACTIVE' AND (prior.to_state IS DISTINCT FROM 'SUBMITTED' OR NEW.to_state<>'REVIEWED_INACTIVE')) OR
           (NEW.action='REJECT' AND (prior.to_state IS DISTINCT FROM 'SUBMITTED' OR NEW.to_state<>'REJECTED')) THEN RAISE EXCEPTION 'Unsupported setup transition'; END IF;
        IF NEW.action IN ('CREATE','SUBMIT') AND (v.maker_subject_id<>NEW.actor_subject_id OR v.maker_natural_person_id<>NEW.actor_natural_person_id) THEN RAISE EXCEPTION 'Only the exact maker may create and submit'; END IF;
        IF NEW.action IN ('REVIEW_INACTIVE','REJECT') AND (v.maker_subject_id=NEW.actor_subject_id OR v.maker_natural_person_id=NEW.actor_natural_person_id) THEN RAISE EXCEPTION 'Independent natural-person review is required'; END IF;
        required:=CASE WHEN NEW.action IN ('CREATE','SUBMIT') THEN 'PREPARE_CONFIG' ELSE 'REVIEW_CONFIG' END;
        IF NOT EXISTS(SELECT 1 FROM finance_configuration_authorities a JOIN finance_accounting_books b ON b.tenant_id=a.tenant_id AND b.legal_entity_id=a.legal_entity_id AND b.id=a.book_id JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id
          WHERE a.id=NEW.authority_id AND a.tenant_id=NEW.tenant_id AND a.legal_entity_id=NEW.legal_entity_id AND a.book_id=NEW.book_id AND a.subject_id=NEW.actor_subject_id AND a.natural_person_id=NEW.actor_natural_person_id AND a.permission=required AND a.state='ENABLED' AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp()) AND b.state<>'DISABLED' AND l.state<>'DISABLED') THEN RAISE EXCEPTION 'Current scoped setup authority is required'; END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_foundation_identity_bindings i WHERE i.id=NEW.identity_binding_id AND i.tenant_id=NEW.tenant_id AND i.legal_entity_id=NEW.legal_entity_id AND i.book_id=NEW.book_id AND i.subject_id=NEW.actor_subject_id AND i.natural_person_id=NEW.actor_natural_person_id AND i.revoked_at IS NULL AND i.valid_from<=statement_timestamp() AND (i.valid_to IS NULL OR i.valid_to>statement_timestamp())) THEN RAISE EXCEPTION 'Current trusted setup identity is required'; END IF;
        RETURN NEW;
      END $$`);
    await q.query(
      `CREATE TRIGGER finance_setup_event_guard BEFORE INSERT ON finance_setup_events FOR EACH ROW EXECUTE FUNCTION finance_setup_event_guard()`,
    );
    await q.query(`CREATE FUNCTION finance_setup_creation_required() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM finance_setup_events WHERE version_id=NEW.id AND sequence=1 AND action='CREATE') THEN RAISE EXCEPTION 'Setup creation audit is required in the same transaction'; END IF; RETURN NULL; END $$`);
    await q.query(
      `CREATE CONSTRAINT TRIGGER finance_setup_creation_required AFTER INSERT ON finance_setup_versions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_setup_creation_required()`,
    );
    await q.query(
      `CREATE INDEX finance_setup_latest ON finance_setup_versions(tenant_id,legal_entity_id,book_id,step,version DESC)`,
    );
    for (const [name, label] of [
      ['finance-setup:prepare', 'Prepare inactive Finance setup'],
      ['finance-setup:review', 'Independently review inactive Finance setup'],
      ['finance-config:prepare', 'Prepare inactive Finance configuration'],
      ['finance-config:review', 'Review inactive Finance configuration'],
      ['finance-policy:prepare', 'Prepare Finance policy versions'],
      ['finance-policy:decide', 'Review Finance policies without activation'],
    ])
      await q.query(
        `INSERT INTO permissions(id,name,display_name,description,is_system_generated,assignment_scope,assignable_to_company_role,assignable_to_platform_role,is_deprecated)
      SELECT gen_random_uuid(),$1::varchar,$2::varchar,'Exact scoped authority is also required. This permission does not permit posting, activation or release.',true,'tenant',true,false,false WHERE NOT EXISTS(SELECT 1 FROM permissions WHERE name=$1::varchar)`,
        [name, label],
      );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_setup_versions) OR EXISTS(SELECT 1 FROM finance_setup_events) THEN RAISE EXCEPTION 'Reviewed setup evidence must be retained; rollback is refused'; END IF; END $$`,
    );
    await q.query('DROP TABLE finance_setup_events');
    await q.query('DROP TABLE finance_setup_versions');
    await q.query('DROP FUNCTION finance_setup_event_guard()');
    await q.query('DROP FUNCTION finance_setup_creation_required()');
    await q.query('DROP FUNCTION finance_setup_immutable()');
    // Permission catalogue entries are retained: rollback must not revoke user access.
  }
}
