import { MigrationInterface, QueryRunner } from 'typeorm';
const priorKinds =
  "'POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES','EVENT_CONTRACTS','EVENT_ROUTES','INTEGRATION_RULES','EXCEPTION_RULES'";
export class FinanceQuotationMemoranda1796800000000 implements MigrationInterface {
  name = 'FinanceQuotationMemoranda1796800000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN (${priorKinds},'QUOTATION_BILLING_RULES'))`,
    );
    await q.query(`CREATE TABLE finance_billing_authorities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,
      permission varchar(24) NOT NULL CHECK(permission IN ('PREPARE_BILLING','REVIEW_BILLING','READ_BILLING')),state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),
      authority_reference varchar(200) NOT NULL CHECK(btrim(authority_reference)<>''),valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_quotation_memoranda (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,inbox_id uuid NOT NULL,preview_id uuid NOT NULL,delivery_id uuid NOT NULL,
      economic_root varchar(64) NOT NULL,source_system varchar(80) NOT NULL,source_company_id uuid NOT NULL,quotation_id uuid NOT NULL,source_revision integer NOT NULL CHECK(source_revision>0),previous_id uuid,
      profile_id uuid NOT NULL,profile_hash varchar(64) NOT NULL,source_snapshot jsonb NOT NULL,source_snapshot_hash varchar(64) NOT NULL,
      subject jsonb NOT NULL,subject_hash varchar(64) NOT NULL CHECK(subject_hash~'^[0-9a-f]{64}$'),maker_subject_id uuid NOT NULL,maker_natural_person_id uuid NOT NULL,maker_grant_id uuid NOT NULL,maker_grant_hash varchar(64) NOT NULL,
      currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),tax_presentation varchar(12) NOT NULL CHECK(tax_presentation IN ('EXCLUSIVE','INCLUSIVE','UNSPLIT')),
      gross numeric(38,12) NOT NULL CHECK(gross>=0),discount numeric(38,12) NOT NULL CHECK(discount>=0),tax numeric(38,12) CHECK(tax>=0),charges numeric(38,12) NOT NULL CHECK(charges>=0),total numeric(38,12) NOT NULL CHECK(total>=0),
      billing_authority varchar(24) NOT NULL CHECK(billing_authority='MEMORANDUM_ONLY'),recognition_owner varchar(24) NOT NULL CHECK(recognition_owner='UNASSIGNED_HELD'),accounting_state varchar(24) NOT NULL CHECK(accounting_state='HELD_INACTIVE'),financial_effects integer NOT NULL CHECK(financial_effects=0),
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK((tax_presentation='UNSPLIT')=(tax IS NULL)),CHECK(discount<=gross),CHECK(total=gross-discount+charges+CASE WHEN tax_presentation='EXCLUSIVE' THEN tax ELSE 0 END),CHECK(tax_presentation<>'INCLUSIVE' OR tax<=gross-discount),
      CHECK((source_revision=1 AND previous_id IS NULL) OR (source_revision>1 AND previous_id IS NOT NULL)),
      UNIQUE(tenant_id,legal_entity_id,book_id,id),UNIQUE(tenant_id,legal_entity_id,book_id,economic_root,source_revision),UNIQUE(tenant_id,legal_entity_id,book_id,source_system,source_company_id,quotation_id,source_revision),UNIQUE(inbox_id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,preview_id) REFERENCES finance_source_event_previews(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,delivery_id) REFERENCES finance_source_event_preview_deliveries(tenant_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,profile_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,previous_id) REFERENCES finance_quotation_memoranda(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(maker_grant_id) REFERENCES finance_billing_authorities(id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_quotation_memorandum_lines (
      memo_id uuid NOT NULL REFERENCES finance_quotation_memoranda(id) ON DELETE RESTRICT,line_key varchar(80) NOT NULL,description varchar(500) NOT NULL,
      gross numeric(38,12) NOT NULL CHECK(gross>=0),discount numeric(38,12) NOT NULL CHECK(discount>=0),tax numeric(38,12) CHECK(tax>=0),charges numeric(38,12) NOT NULL CHECK(charges>=0),total numeric(38,12) NOT NULL CHECK(total>=0),PRIMARY KEY(memo_id,line_key)
    )`);
    await q.query(`CREATE TABLE finance_quotation_billing_decisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,memo_id uuid NOT NULL UNIQUE,
      subject_hash varchar(64) NOT NULL,reviewer_subject_id uuid NOT NULL,reviewer_natural_person_id uuid NOT NULL,reviewer_grant_id uuid NOT NULL REFERENCES finance_billing_authorities(id) ON DELETE RESTRICT,
      reviewer_grant_hash varchar(64) NOT NULL,decision varchar(24) NOT NULL CHECK(decision IN ('REVIEWED_INACTIVE','REJECTED_INACTIVE')),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,memo_id) REFERENCES finance_quotation_memoranda(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE TABLE finance_quotation_billing_audits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,memo_id uuid NOT NULL,decision_id uuid UNIQUE REFERENCES finance_quotation_billing_decisions(id) ON DELETE RESTRICT,
      action varchar(24) NOT NULL CHECK(action IN ('PREPARED_INACTIVE','REVIEWED_INACTIVE','REJECTED_INACTIVE')),subject_hash varchar(64) NOT NULL,actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(memo_id,action),FOREIGN KEY(tenant_id,legal_entity_id,book_id,memo_id) REFERENCES finance_quotation_memoranda(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT
    )`);
    await q.query(`CREATE FUNCTION fn_fin_billing_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='INSERT' AND TG_TABLE_NAME='finance_quotation_memorandum_lines' THEN
        IF EXISTS(SELECT 1 FROM finance_quotation_billing_audits WHERE memo_id=NEW.memo_id) THEN RAISE EXCEPTION 'Memorandum lines are frozen';END IF;RETURN NEW;
      END IF;RAISE EXCEPTION 'Memorandum and billing audit evidence are immutable';END $$`);
    for (const table of [
      'finance_quotation_memoranda',
      'finance_quotation_memorandum_lines',
      'finance_quotation_billing_decisions',
      'finance_quotation_billing_audits',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fn_fin_billing_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_billing_immutable()`,
      );
    }
    await q.query(
      'CREATE TRIGGER frozen_lines BEFORE INSERT ON finance_quotation_memorandum_lines FOR EACH ROW EXECUTE FUNCTION fn_fin_billing_immutable()',
    );
    await q.query(`CREATE FUNCTION fn_fin_billing_commit() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE b record;g record;p record;d record;line_count integer;v jsonb;BEGIN
      IF TG_TABLE_NAME='finance_quotation_memoranda' THEN b:=NEW;ELSE SELECT * INTO b FROM finance_quotation_memoranda WHERE id=NEW.memo_id;END IF;
      IF TG_TABLE_NAME='finance_quotation_memoranda' OR TG_TABLE_NAME='finance_quotation_memorandum_lines' THEN
        SELECT count(*) INTO line_count FROM finance_quotation_memorandum_lines WHERE memo_id=b.id;
        IF line_count<>jsonb_array_length(b.subject->'snapshot'->'lines') OR line_count<1 OR
          EXISTS(SELECT 1 FROM (SELECT sum(gross) gross,sum(discount) discount,sum(coalesce(tax,0)) tax,sum(charges) charges,sum(total) total FROM finance_quotation_memorandum_lines WHERE memo_id=b.id) t WHERE t.gross<>b.gross OR t.discount<>b.discount OR t.tax<>coalesce(b.tax,0) OR t.charges<>b.charges OR t.total<>b.total) THEN RAISE EXCEPTION 'Memorandum requires complete exact component totals';END IF;
        FOR v IN SELECT * FROM jsonb_array_elements(b.subject->'snapshot'->'lines') LOOP
          IF NOT EXISTS(SELECT 1 FROM finance_quotation_memorandum_lines l WHERE l.memo_id=b.id AND l.line_key=v->>'key' AND l.description=v->>'description' AND l.gross=(v->>'gross')::numeric AND l.discount=(v->>'discount')::numeric AND l.tax IS NOT DISTINCT FROM (v->>'tax')::numeric AND l.charges=(v->>'charges')::numeric AND l.total=(v->>'total')::numeric) THEN RAISE EXCEPTION 'Stored memorandum line differs from frozen source';END IF;
        END LOOP;
        IF b.gross<>(b.subject->'snapshot'->'components'->>'gross')::numeric OR b.discount<>(b.subject->'snapshot'->'components'->>'discount')::numeric OR b.tax IS DISTINCT FROM (b.subject->'snapshot'->'components'->>'tax')::numeric OR b.charges<>(b.subject->'snapshot'->'components'->>'charges')::numeric OR b.total<>(b.subject->'snapshot'->'components'->>'total')::numeric OR b.currency<>b.subject->'snapshot'->>'currency' OR b.tax_presentation<>b.subject->'snapshot'->>'taxPresentation' THEN RAISE EXCEPTION 'Stored memorandum header differs from frozen source';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_integration_inboxes i JOIN finance_source_event_previews s ON s.id=i.preview_id JOIN finance_source_event_preview_deliveries x ON x.preview_id=s.id WHERE i.id=b.inbox_id AND i.tenant_id=b.tenant_id AND i.legal_entity_id=b.legal_entity_id AND i.book_id=b.book_id AND s.id=b.preview_id AND x.id=b.delivery_id AND s.economic_root=b.economic_root AND s.source_revision=b.source_revision) THEN RAISE EXCEPTION 'Memorandum requires exact accepted source ownership';END IF;
        IF b.previous_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_quotation_memoranda z WHERE z.id=b.previous_id AND z.economic_root=b.economic_root AND z.source_revision=b.source_revision-1) THEN RAISE EXCEPTION 'Memorandum requires its original revision lineage';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_quotation_billing_audits a WHERE a.memo_id=b.id AND a.tenant_id=b.tenant_id AND a.legal_entity_id=b.legal_entity_id AND a.book_id=b.book_id AND a.action='PREPARED_INACTIVE' AND a.subject_hash=b.subject_hash AND a.actor_subject_id=b.maker_subject_id AND a.actor_natural_person_id=b.maker_natural_person_id) THEN RAISE EXCEPTION 'Memorandum requires atomic maker audit';END IF;
      END IF;
      SELECT * INTO p FROM finance_configuration_releases WHERE id=b.profile_id AND tenant_id=b.tenant_id AND legal_entity_id=b.legal_entity_id AND book_id=b.book_id AND kind='QUOTATION_BILLING_RULES' AND state='REVIEWED_INACTIVE' AND release_hash=b.profile_hash AND effective_from<=(statement_timestamp() AT TIME ZONE 'UTC')::date AND (effective_to IS NULL OR effective_to>(statement_timestamp() AT TIME ZONE 'UTC')::date);
      IF p.id IS NULL THEN RAISE EXCEPTION 'Current inactive billing profile is required';END IF;
      SELECT * INTO g FROM finance_billing_authorities WHERE id=b.maker_grant_id AND tenant_id=b.tenant_id AND legal_entity_id=b.legal_entity_id AND book_id=b.book_id AND subject_id=b.maker_subject_id AND natural_person_id=b.maker_natural_person_id AND permission='PREPARE_BILLING' AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp());
      IF g.id IS NULL THEN RAISE EXCEPTION 'Current scoped billing maker is required';END IF;
      IF TG_TABLE_NAME='finance_quotation_billing_decisions' THEN
        d:=NEW;
        IF d.subject_hash<>b.subject_hash OR d.reviewer_subject_id=b.maker_subject_id OR d.reviewer_natural_person_id=b.maker_natural_person_id THEN RAISE EXCEPTION 'Independent exact billing review is required';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_billing_authorities a WHERE a.id=d.reviewer_grant_id AND a.tenant_id=b.tenant_id AND a.legal_entity_id=b.legal_entity_id AND a.book_id=b.book_id AND a.subject_id=d.reviewer_subject_id AND a.natural_person_id=d.reviewer_natural_person_id AND a.permission='REVIEW_BILLING' AND a.state='ENABLED' AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp())) THEN RAISE EXCEPTION 'Current scoped independent reviewer is required';END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_quotation_billing_audits a WHERE a.decision_id=d.id AND a.memo_id=b.id AND a.tenant_id=b.tenant_id AND a.legal_entity_id=b.legal_entity_id AND a.book_id=b.book_id AND a.subject_hash=b.subject_hash AND a.action=d.decision AND a.actor_subject_id=d.reviewer_subject_id AND a.actor_natural_person_id=d.reviewer_natural_person_id) THEN RAISE EXCEPTION 'Billing review requires atomic audit';END IF;
      END IF;RETURN NULL;END $$`);
    for (const table of [
      'finance_quotation_memoranda',
      'finance_quotation_billing_decisions',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER billing_commit AFTER INSERT ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_billing_commit()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'finance_quotation_billing_audits',
      'finance_quotation_billing_decisions',
      'finance_quotation_memorandum_lines',
      'finance_quotation_memoranda',
      'finance_billing_authorities',
    ]) {
      const [r] = await q.query(`SELECT EXISTS(SELECT 1 FROM ${t}) AS used`);
      if (r.used)
        throw new Error(
          'Quotation memorandum rollback requires empty registries.',
        );
    }
    const [r] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM finance_configuration_releases WHERE kind='QUOTATION_BILLING_RULES') AS used",
    );
    if (r.used)
      throw new Error(
        'Quotation memorandum rollback requires no new profiles.',
      );
    await q.query(
      'DROP TABLE finance_quotation_billing_audits,finance_quotation_billing_decisions,finance_quotation_memorandum_lines,finance_quotation_memoranda,finance_billing_authorities',
    );
    await q.query(
      'DROP FUNCTION fn_fin_billing_commit(),fn_fin_billing_immutable()',
    );
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN (${priorKinds}))`,
    );
  }
}
