import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';
const priorKinds =
  "'POSTING_RULES','ACCOUNT_ROLES','DIMENSIONS','TAX_RULES','CURRENCY_RULES','SOURCE_ASSOCIATIONS','APPROVAL_RULES','EVENT_CONTRACTS','EVENT_ROUTES','INTEGRATION_RULES','EXCEPTION_RULES','QUOTATION_BILLING_RULES'";
export class FinanceReceivableControls1797000000000 implements MigrationInterface {
  name = 'FinanceReceivableControls1797000000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN (${priorKinds},'RECEIVABLE_CONTROLS'))`,
    );
    await q.query(`CREATE TABLE finance_receivable_authorities(
   id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,
   permission varchar(32) NOT NULL CHECK(permission IN ('OBSERVE_RECEIPT','PREPARE_ASSIGNMENT','REVIEW_ASSIGNMENT','RECONCILE_RECEIPT','READ_RECEIVABLES')),
   state varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),authority_reference varchar(200) NOT NULL CHECK(btrim(authority_reference)<>''),
   valid_from timestamptz NOT NULL,valid_to timestamptz,revoked_at timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),
   FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT)`);
    await q.query(`CREATE TABLE finance_confirmed_receipts(
   id uuid PRIMARY KEY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
   bank_identity_hash varchar(64) NOT NULL CHECK(bank_identity_hash~'^[0-9a-f]{64}$'),vector_hash varchar(64) NOT NULL,subject jsonb NOT NULL,subject_hash varchar(64) NOT NULL,
   source_company_id uuid NOT NULL,source_account_id uuid NOT NULL,customer_id uuid NOT NULL,currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),
   received numeric(38,12) NOT NULL CHECK(received>0),bank_settled numeric(38,12) NOT NULL CHECK(bank_settled>=0),bank_fee numeric(38,12) NOT NULL CHECK(bank_fee>=0),value_date date NOT NULL,
   legacy_allocated numeric(38,12) NOT NULL CHECK(legacy_allocated>=0),legacy_refunded numeric(38,12) NOT NULL CHECK(legacy_refunded>=0),legacy_reserved numeric(38,12) NOT NULL CHECK(legacy_reserved>=0),
   accounting_state varchar(24) NOT NULL DEFAULT 'HELD_INACTIVE' CHECK(accounting_state='HELD_INACTIVE'),financial_effects integer NOT NULL DEFAULT 0 CHECK(financial_effects=0),
   created_at timestamptz NOT NULL DEFAULT statement_timestamp(),CHECK(received=bank_settled+bank_fee),
   UNIQUE(tenant_id,legal_entity_id,bank_identity_hash),UNIQUE(tenant_id,legal_entity_id,book_id,id),
   FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT)`);
    await q.query(`CREATE TABLE finance_receipt_sources(
   id uuid PRIMARY KEY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,receipt_id uuid,
   inbox_id uuid NOT NULL,delivery_id uuid NOT NULL,source_system varchar(80) NOT NULL,source_id uuid NOT NULL,subject jsonb NOT NULL,subject_hash varchar(64) NOT NULL,
   state varchar(24) NOT NULL CHECK(state IN ('RECORDED','ALIASED','CONFLICT_HELD')),maker_subject_id uuid NOT NULL,maker_natural_person_id uuid NOT NULL,maker_grant_id uuid NOT NULL REFERENCES finance_receivable_authorities(id) ON DELETE RESTRICT,
   created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(tenant_id,legal_entity_id,book_id,id),UNIQUE(tenant_id,legal_entity_id,book_id,inbox_id),
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,receipt_id) REFERENCES finance_confirmed_receipts(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,inbox_id) REFERENCES finance_integration_inboxes(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
   FOREIGN KEY(tenant_id,delivery_id) REFERENCES finance_source_event_preview_deliveries(tenant_id,id) ON DELETE RESTRICT)`);
    await q.query(`CREATE TABLE finance_receivable_requests(
   id uuid PRIMARY KEY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,command_key varchar(150) NOT NULL CHECK(btrim(command_key)<>''),
   kind varchar(16) NOT NULL CHECK(kind IN ('TERMS','ALLOCATE','REVERSE')),receipt_id uuid,memo_id uuid NOT NULL,original_id uuid,
   amount numeric(38,12) NOT NULL CHECK(amount>=0),currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),due_date date,
   profile_id uuid NOT NULL,profile_hash varchar(64) NOT NULL,subject jsonb NOT NULL,subject_hash varchar(64) NOT NULL CHECK(subject_hash~'^[0-9a-f]{64}$'),
   maker_subject_id uuid NOT NULL,maker_natural_person_id uuid NOT NULL,maker_grant_id uuid NOT NULL REFERENCES finance_receivable_authorities(id) ON DELETE RESTRICT,maker_grant_hash varchar(64) NOT NULL,
   accounting_state varchar(24) NOT NULL DEFAULT 'HELD_INACTIVE' CHECK(accounting_state='HELD_INACTIVE'),discharge_state varchar(24) NOT NULL DEFAULT 'LEGAL_DISCHARGE_HELD' CHECK(discharge_state='LEGAL_DISCHARGE_HELD'),financial_effects integer NOT NULL DEFAULT 0 CHECK(financial_effects=0),
   created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(tenant_id,legal_entity_id,book_id,id),UNIQUE(tenant_id,legal_entity_id,book_id,command_key),
   CHECK((kind='TERMS' AND receipt_id IS NULL AND original_id IS NULL AND amount=0 AND due_date IS NOT NULL) OR (kind='ALLOCATE' AND receipt_id IS NOT NULL AND original_id IS NULL AND amount>0 AND due_date IS NULL) OR (kind='REVERSE' AND receipt_id IS NOT NULL AND original_id IS NOT NULL AND amount>0 AND due_date IS NULL)),
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,receipt_id) REFERENCES finance_confirmed_receipts(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,memo_id) REFERENCES finance_quotation_memoranda(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,original_id) REFERENCES finance_receivable_requests(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT,
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,profile_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT)`);
    await q.query(
      "CREATE UNIQUE INDEX UQ_fin_receivable_terms ON finance_receivable_requests(memo_id) WHERE kind='TERMS'",
    );
    await q.query(
      'CREATE INDEX IDX_fin_receivable_receipt ON finance_receivable_requests(receipt_id)',
    );
    await q.query(
      'CREATE INDEX IDX_fin_receivable_memo ON finance_receivable_requests(memo_id)',
    );
    await q.query(`CREATE TABLE finance_receivable_decisions(
   id uuid PRIMARY KEY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,request_id uuid NOT NULL UNIQUE,
   decision varchar(24) NOT NULL CHECK(decision IN ('REVIEWED_INACTIVE','REJECTED_INACTIVE')),subject jsonb NOT NULL,subject_hash varchar(64) NOT NULL,
   reviewer_subject_id uuid NOT NULL,reviewer_natural_person_id uuid NOT NULL,reviewer_grant_id uuid NOT NULL REFERENCES finance_receivable_authorities(id) ON DELETE RESTRICT,
   created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,request_id) REFERENCES finance_receivable_requests(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT)`);
    await q.query(`CREATE TABLE finance_receivable_reconciliations(
   id uuid PRIMARY KEY,tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,receipt_id uuid NOT NULL,command_key varchar(150) NOT NULL,
   position_hash varchar(64) NOT NULL,state varchar(24) NOT NULL CHECK(state IN ('MATCHED_HELD','EXCEPTION_HELD')),subject jsonb NOT NULL,subject_hash varchar(64) NOT NULL,
   reviewer_subject_id uuid NOT NULL,reviewer_natural_person_id uuid NOT NULL,reviewer_grant_id uuid NOT NULL REFERENCES finance_receivable_authorities(id) ON DELETE RESTRICT,
   created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(tenant_id,legal_entity_id,book_id,command_key),
   FOREIGN KEY(tenant_id,legal_entity_id,book_id,receipt_id) REFERENCES finance_confirmed_receipts(tenant_id,legal_entity_id,book_id,id) ON DELETE RESTRICT)`);
    await q.query(`CREATE TABLE finance_receivable_audits(
   id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,
   object_kind varchar(24) NOT NULL CHECK(object_kind IN ('RECEIPT','SOURCE','REQUEST','DECISION','RECONCILIATION')),object_id uuid NOT NULL,action varchar(32) NOT NULL,
   subject_hash varchar(64) NOT NULL,actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),
   created_at timestamptz NOT NULL DEFAULT statement_timestamp(),UNIQUE(tenant_id,legal_entity_id,book_id,object_kind,object_id,action),
   FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id) ON DELETE RESTRICT)`);
    await q.query(
      `CREATE FUNCTION fn_fin_receivable_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Receipt, assignment and reconciliation evidence are append-only';END $$`,
    );
    for (const t of [
      'finance_confirmed_receipts',
      'finance_receipt_sources',
      'finance_receivable_requests',
      'finance_receivable_decisions',
      'finance_receivable_reconciliations',
      'finance_receivable_audits',
    ]) {
      await q.query(
        `CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION fn_fin_receivable_immutable()`,
      );
      await q.query(
        `CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON ${t} FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_receivable_immutable()`,
      );
    }
    await q.query(`CREATE FUNCTION fn_fin_receivable_commit() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE typ text; a record; r record; d record; c record; b record; grant_id uuid; used numeric;released numeric;rev numeric;BEGIN
   PERFORM pg_advisory_xact_lock(hashtextextended('finance-inactive-config:'||NEW.tenant_id::text,0));
   typ:=CASE TG_TABLE_NAME WHEN 'finance_confirmed_receipts' THEN 'RECEIPT' WHEN 'finance_receipt_sources' THEN 'SOURCE' WHEN 'finance_receivable_requests' THEN 'REQUEST' WHEN 'finance_receivable_decisions' THEN 'DECISION' ELSE 'RECONCILIATION' END;
   IF NOT EXISTS(SELECT 1 FROM finance_receivable_audits x WHERE x.tenant_id=NEW.tenant_id AND x.legal_entity_id=NEW.legal_entity_id AND x.book_id=NEW.book_id AND x.object_kind=typ AND x.object_id=NEW.id AND x.subject_hash=NEW.subject_hash) THEN RAISE EXCEPTION 'Atomic scoped receivable audit is required';END IF;
   IF TG_TABLE_NAME='finance_confirmed_receipts' THEN
    IF NEW.received<>(NEW.subject->'snapshot'->>'received')::numeric OR NEW.bank_settled<>(NEW.subject->'snapshot'->>'bankSettled')::numeric OR NEW.bank_fee<>(NEW.subject->'snapshot'->>'bankFee')::numeric OR NEW.legacy_allocated<>(NEW.subject->'snapshot'->>'legacyAllocated')::numeric OR NEW.legacy_refunded<>(NEW.subject->'snapshot'->>'legacyRefunded')::numeric OR NEW.legacy_reserved<>(NEW.subject->'snapshot'->>'legacyReserved')::numeric OR NEW.currency<>NEW.subject->'snapshot'->>'currency' OR NEW.customer_id::text<>NEW.subject->'snapshot'->>'customerId' THEN RAISE EXCEPTION 'Receipt vector differs from frozen confirmation';END IF;
   END IF;
   IF TG_TABLE_NAME='finance_receivable_requests' THEN
    r:=NEW;SELECT * INTO b FROM finance_quotation_memoranda WHERE id=r.memo_id;
    IF b.currency<>r.currency OR b.decimal_scale<>r.decimal_scale OR NOT EXISTS(SELECT 1 FROM finance_quotation_billing_decisions x WHERE x.memo_id=b.id AND x.decision='REVIEWED_INACTIVE' AND x.subject_hash=b.subject_hash) THEN RAISE EXCEPTION 'Reviewed billing amount/currency/scale required';END IF;
    IF r.amount<>(r.subject->>'amount')::numeric OR r.kind<>r.subject->>'kind' OR r.memo_id::text<>r.subject->>'memoId' OR r.currency<>r.subject->>'currency' THEN RAISE EXCEPTION 'Request vector differs from frozen subject';END IF;
    IF r.kind<>'TERMS' THEN
     SELECT * INTO c FROM finance_confirmed_receipts WHERE id=r.receipt_id FOR UPDATE;
     IF c.currency<>r.currency OR c.decimal_scale<>r.decimal_scale OR c.customer_id::text<>b.subject->'snapshot'->>'customerId' OR c.source_company_id<>b.source_company_id THEN RAISE EXCEPTION 'Receipt ownership and exact currency must match billing';END IF;
     IF r.kind='REVERSE' THEN
      SELECT * INTO a FROM finance_receivable_requests WHERE id=r.original_id;
      IF a.kind<>'ALLOCATE' OR a.receipt_id<>r.receipt_id OR a.memo_id<>r.memo_id OR NOT EXISTS(SELECT 1 FROM finance_receivable_decisions x WHERE x.request_id=a.id AND x.decision='REVIEWED_INACTIVE') THEN RAISE EXCEPTION 'An original reviewed assignment is required';END IF;
      SELECT coalesce(sum(x.amount),0) INTO rev FROM finance_receivable_requests x LEFT JOIN finance_receivable_decisions z ON z.request_id=x.id WHERE x.original_id=a.id AND (z.id IS NULL OR z.decision='REVIEWED_INACTIVE');IF rev>a.amount THEN RAISE EXCEPTION 'Reversal exceeds original assignment';END IF;
     END IF;
    END IF;
   ELSIF TG_TABLE_NAME='finance_receivable_decisions' THEN
    d:=NEW;SELECT * INTO r FROM finance_receivable_requests WHERE id=d.request_id;
    IF d.reviewer_subject_id=r.maker_subject_id OR d.reviewer_natural_person_id=r.maker_natural_person_id THEN RAISE EXCEPTION 'Independent assignment reviewer required';END IF;
    IF d.subject->>'requestHash'<>r.subject_hash OR d.subject->>'decision'<>d.decision THEN RAISE EXCEPTION 'Decision differs from its frozen request';END IF;
   END IF;
   IF TG_TABLE_NAME IN ('finance_receivable_requests','finance_receivable_decisions') THEN
    IF TG_TABLE_NAME='finance_receivable_requests' THEN grant_id:=r.maker_grant_id;ELSE grant_id:=d.reviewer_grant_id;END IF;
    SELECT * INTO a FROM finance_receivable_authorities WHERE id=grant_id;
    IF a.tenant_id<>NEW.tenant_id OR a.legal_entity_id<>NEW.legal_entity_id OR a.book_id<>NEW.book_id OR a.state<>'ENABLED' OR a.revoked_at IS NOT NULL OR a.valid_from>statement_timestamp() OR (a.valid_to IS NOT NULL AND a.valid_to<=statement_timestamp()) OR a.permission<>(CASE WHEN TG_TABLE_NAME='finance_receivable_requests' THEN 'PREPARE_ASSIGNMENT' ELSE 'REVIEW_ASSIGNMENT' END) THEN RAISE EXCEPTION 'Current scoped assignment authority required';END IF;
    IF TG_TABLE_NAME='finance_receivable_requests' THEN
     IF a.subject_id<>r.maker_subject_id OR a.natural_person_id<>r.maker_natural_person_id THEN RAISE EXCEPTION 'Maker authority identity differs';END IF;
    ELSE
     IF a.subject_id<>d.reviewer_subject_id OR a.natural_person_id<>d.reviewer_natural_person_id THEN RAISE EXCEPTION 'Reviewer authority identity differs';END IF;
    END IF;
    IF r.receipt_id IS NOT NULL THEN
     SELECT * INTO c FROM finance_confirmed_receipts WHERE id=r.receipt_id FOR UPDATE;
     SELECT coalesce(sum(x.amount) FILTER(WHERE x.kind='ALLOCATE' AND (z.id IS NULL OR z.decision='REVIEWED_INACTIVE')),0),coalesce(sum(x.amount) FILTER(WHERE x.kind='REVERSE' AND z.decision='REVIEWED_INACTIVE'),0) INTO used,released FROM finance_receivable_requests x LEFT JOIN finance_receivable_decisions z ON z.request_id=x.id WHERE x.receipt_id=c.id;
     IF used-released<0 OR used-released>c.received-c.legacy_allocated-c.legacy_refunded-c.legacy_reserved THEN RAISE EXCEPTION 'Receipt assignment capacity exceeded';END IF;
    END IF;
    IF r.kind='ALLOCATE' THEN
     SELECT * INTO b FROM finance_quotation_memoranda WHERE id=r.memo_id;
     SELECT coalesce(sum(CASE WHEN x.kind='ALLOCATE' AND (z.id IS NULL OR z.decision='REVIEWED_INACTIVE') THEN x.amount WHEN x.kind='REVERSE' AND z.decision='REVIEWED_INACTIVE' THEN -x.amount ELSE 0 END),0) INTO used FROM finance_receivable_requests x JOIN finance_quotation_memoranda m ON m.id=x.memo_id LEFT JOIN finance_receivable_decisions z ON z.request_id=x.id WHERE m.tenant_id=b.tenant_id AND m.legal_entity_id=b.legal_entity_id AND m.book_id=b.book_id AND m.economic_root=b.economic_root;
     IF used>b.total THEN RAISE EXCEPTION 'Billing assignment capacity exceeded';END IF;
    END IF;
   END IF;RETURN NULL;END $$`);
    for (const t of [
      'finance_confirmed_receipts',
      'finance_receipt_sources',
      'finance_receivable_requests',
      'finance_receivable_decisions',
      'finance_receivable_reconciliations',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER receivable_commit AFTER INSERT ON ${t} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_receivable_commit()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    const tables = [
      'finance_receivable_audits',
      'finance_receivable_reconciliations',
      'finance_receivable_decisions',
      'finance_receivable_requests',
      'finance_receipt_sources',
      'finance_confirmed_receipts',
      'finance_receivable_authorities',
    ];
    for (const t of tables) {
      const [r] = await q.query(`SELECT EXISTS(SELECT 1 FROM ${t}) AS used`);
      if (r.used)
        throw new Error(
          'Receivable controls rollback requires empty registries.',
        );
    }
    const [r] = await q.query(
      "SELECT EXISTS(SELECT 1 FROM finance_configuration_releases WHERE kind='RECEIVABLE_CONTROLS') AS used",
    );
    if (r.used)
      throw new Error('Receivable controls rollback requires no new profiles.');
    await q.query('DROP TABLE ' + tables.join(','));
    await q.query(
      'DROP FUNCTION fn_fin_receivable_commit(),fn_fin_receivable_immutable()',
    );
    await q.query(
      'ALTER TABLE finance_configuration_releases DROP CONSTRAINT "CK_fin_config_kind"',
    );
    await q.query(
      `ALTER TABLE finance_configuration_releases ADD CONSTRAINT "CK_fin_config_kind" CHECK(kind IN (${priorKinds}))`,
    );
  }
}
