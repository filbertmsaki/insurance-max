import { MigrationInterface, QueryRunner } from 'typeorm';

const controlledTables = [
  'invoices',
  'receipts',
  'receipt_allocations',
  'payment_transactions',
  'finance_refunds',
  'commission_transactions',
  'commission_payments',
  'finance_reconciliation_batches',
  'finance_journal_entries',
  'payment_references',
  'financial_reversals',
  'claim_reserves',
  'claim_discharge_vouchers',
  'claim_payments',
  'claim_disbursements',
  'claim_recoveries',
  'reinsurance_settlements',
  'reinsurance_claim_recoveries',
  'reinsurance_recovery_receipts',
];

// PostgreSQL applies a numeric column's scale before BEFORE triggers. Keep the original
// integer capacity and let the reviewed currency scale validate the exact supplied value.
const monetaryColumns: Record<string, Record<string, string[]>> = {
  invoices: {
    '18,2': [
      'gross_amount',
      'discount_amount',
      'tax_amount',
      'charges_amount',
      'total_amount',
      'paid_amount',
      'balance_amount',
    ],
    '20,4': ['allocated_amount', 'refunded_amount', 'written_off_amount'],
  },
  invoice_items: { '18,2': ['unit_amount', 'total_amount'] },
  receipts: {
    '18,2': ['amount', 'unallocated_amount'],
    '20,4': ['allocated_amount'],
  },
  payment_transactions: { '18,2': ['amount'] },
  receipt_allocations: { '18,2': ['amount'] },
  finance_refunds: { '20,4': ['amount'] },
  commission_transactions: {
    '20,4': [
      'gross_premium',
      'net_premium',
      'commission_amount',
      'paid_amount',
      'balance_amount',
    ],
  },
  commission_payments: {
    '18,2': ['total_amount'],
    '20,4': ['allocated_amount', 'unallocated_amount'],
  },
  commission_payment_items: { '18,2': ['amount'] },
};
async function migrateCurrencyPrecision(q: QueryRunner, up: boolean) {
  for (const [table, groups] of Object.entries(monetaryColumns)) {
    const clauses: string[] = [];
    for (const [type, columns] of Object.entries(groups)) {
      const [precision, scale] = type.split(',').map(Number);
      for (const column of columns) {
        const constraint = 'fin01_precision_' + column;
        if (up) {
          clauses.push(
            `ALTER COLUMN ${column} TYPE numeric, ADD CONSTRAINT ${constraint} CHECK(abs(${column}) < power(10::numeric,${precision - scale}) AND ${column}=trunc(${column},12))`,
          );
        } else {
          // A rollback must never round amounts posted after the column was widened.
          if (
            (
              await q.query(
                `SELECT 1 FROM ${table} WHERE ${column}<>trunc(${column},${scale}) LIMIT 1`,
              )
            ).length
          )
            throw new Error(
              'Existing ' +
                table +
                '.' +
                column +
                ' amounts require the activated currency precision.',
            );
          clauses.push(
            `DROP CONSTRAINT ${constraint}, ALTER COLUMN ${column} TYPE numeric(${type})`,
          );
        }
      }
    }
    await q.query(`ALTER TABLE ${table} ${clauses.join(', ')}`);
  }
}

export class FinanceOperatingSetup1798900000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await migrateCurrencyPrecision(q, true);
    await q.query(`ALTER TABLE companies ADD COLUMN finance_profile_tz jsonb
      CHECK (finance_profile_tz IS NULL OR jsonb_typeof(finance_profile_tz)='object');
      ALTER TABLE invoices ADD COLUMN payment_term_code varchar(30), ADD COLUMN issue_command_key varchar(180), ADD COLUMN issue_command_hash varchar(64), ADD COLUMN finance_dimensions jsonb;
      ALTER TABLE finance_journal_lines ADD COLUMN dimensions jsonb;
      ALTER TABLE receipts ADD COLUMN post_command_key varchar(180), ADD COLUMN post_command_hash varchar(64), ADD COLUMN finance_dimensions jsonb;
      CREATE UNIQUE INDEX fin01_invoice_command ON invoices(company_id,issue_command_key) WHERE issue_command_key IS NOT NULL;
      CREATE UNIQUE INDEX fin01_receipt_command ON receipts(company_id,post_command_key) WHERE post_command_key IS NOT NULL;
      ALTER TABLE commission_payments ADD COLUMN payment_term_code varchar(30), ADD COLUMN due_date date;
      ALTER TABLE receipts ADD COLUMN settlement_account_code varchar(50);
      ALTER TABLE finance_refunds ADD COLUMN settlement_account_code varchar(50);
      ALTER TABLE commission_payments ADD COLUMN settlement_account_code varchar(50);
      ALTER TABLE claim_disbursements ADD COLUMN settlement_account_code varchar(50);
      ALTER TABLE reinsurance_settlements ADD COLUMN settlement_account_code varchar(50);
      ALTER TABLE finance_foundation_journals ADD COLUMN journal_no varchar(100);
      ALTER TABLE finance_foundation_periods ADD COLUMN period_kind text NOT NULL DEFAULT 'REGULAR' CHECK(period_kind IN ('REGULAR','ADJUSTMENT'));
      CREATE TABLE finance_operating_setups (
        id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL,
        book_id uuid NOT NULL, company_id uuid NOT NULL REFERENCES companies(id),
        book_role text NOT NULL CHECK(book_role IN ('PRIMARY','SECONDARY')),
        setup_id uuid NOT NULL, release_id uuid NOT NULL, legal_step_id uuid NOT NULL,
        starts_on date NOT NULL, ends_before date NOT NULL CHECK(ends_before>starts_on),
        controls jsonb NOT NULL, timezone text NOT NULL, actor_id uuid NOT NULL,
        authority_id uuid NOT NULL REFERENCES finance_foundation_authorities(id), reason text NOT NULL,
        activated_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz, withdrawn_by uuid, withdrawal_reason text,
        FOREIGN KEY(tenant_id,legal_entity_id,book_id,setup_id) REFERENCES finance_setup_versions(tenant_id,legal_entity_id,book_id,id),
        FOREIGN KEY(tenant_id,legal_entity_id,book_id,legal_step_id) REFERENCES finance_setup_versions(tenant_id,legal_entity_id,book_id,id),
        FOREIGN KEY(tenant_id,legal_entity_id,book_id,release_id) REFERENCES finance_foundation_documents(tenant_id,legal_entity_id,book_id,id));
      CREATE TABLE finance_operating_postings (
        candidate_id uuid PRIMARY KEY, tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
        company_id uuid NOT NULL REFERENCES companies(id), source_type text NOT NULL CHECK(source_type IN ('INVOICE','RECEIPT')),
        source_id uuid NOT NULL, source_event_id text NOT NULL, context_id uuid NOT NULL, context_hash text NOT NULL,
        snapshot jsonb NOT NULL, snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
        request_id uuid NOT NULL REFERENCES finance_approval_requests(id),
        UNIQUE(company_id,source_type,source_id), UNIQUE(company_id,source_type,source_event_id),
        FOREIGN KEY(tenant_id,legal_entity_id,book_id,candidate_id) REFERENCES finance_journal_candidates(tenant_id,legal_entity_id,book_id,id),
        FOREIGN KEY(tenant_id,legal_entity_id,book_id,context_id) REFERENCES finance_foundation_documents(tenant_id,legal_entity_id,book_id,id));
      CREATE TRIGGER fin01_source_immutable BEFORE UPDATE OR DELETE ON finance_operating_postings FOR EACH ROW EXECUTE FUNCTION finance_foundation_immutable();
      CREATE TRIGGER fin01_source_truncate BEFORE TRUNCATE ON finance_operating_postings FOR EACH STATEMENT EXECUTE FUNCTION finance_foundation_immutable();
      ALTER TABLE finance_approval_requests DROP CONSTRAINT finance_approval_requests_candidate_id_key;
      CREATE INDEX fin01_request_history ON finance_approval_requests(candidate_id,expires_at DESC);
      CREATE FUNCTION finance_fin01_request_history() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE previous finance_approval_requests;
      BEGIN
        PERFORM id FROM finance_journal_candidates WHERE id=NEW.candidate_id FOR UPDATE;
        SELECT * INTO previous FROM finance_approval_requests WHERE candidate_id=NEW.candidate_id ORDER BY expires_at DESC,id DESC LIMIT 1;
        IF FOUND AND (previous.state<>'OPEN_INACTIVE' OR previous.expires_at>statement_timestamp()
          OR previous.expires_at>=NEW.expires_at OR previous.candidate_hash<>NEW.candidate_hash OR previous.profile_id<>NEW.profile_id
          OR previous.profile_hash<>NEW.profile_hash OR previous.beneficiary_hash<>NEW.beneficiary_hash
          OR previous.maker_subject_id<>NEW.maker_subject_id OR previous.maker_natural_person_id<>NEW.maker_natural_person_id
          OR NOT EXISTS(SELECT 1 FROM finance_operating_postings p WHERE p.candidate_id=NEW.candidate_id)) THEN
          RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='This candidate already has a binding approval request.';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin01_request_history BEFORE INSERT ON finance_approval_requests FOR EACH ROW EXECUTE FUNCTION finance_fin01_request_history();
      CREATE UNIQUE INDEX uq_fin01_primary ON finance_operating_setups(company_id) WHERE book_role='PRIMARY' AND withdrawn_at IS NULL;
      CREATE UNIQUE INDEX uq_fin01_book ON finance_operating_setups(tenant_id,legal_entity_id,book_id) WHERE withdrawn_at IS NULL;
      ALTER TABLE companies ADD COLUMN finance_primary_setup_id uuid REFERENCES finance_operating_setups(id);
      CREATE VIEW finance_company_setup_sources AS SELECT c.id,
        jsonb_build_object('id',c.id,'name',c.name,'company_type',c.company_type,'status',c.status,'verification_status',c.verification_status,
        'tira_license_number',c.tira_license_number,'tira_license_status',c.tira_license_status,'license_issued_at',c.license_issued_at::text,
        'license_expires_at',c.license_expires_at::text,'tin',c.tin,'brela_registration_number',c.brela_registration_number,
        'operating_timezone',c.operating_timezone,'default_currency',c.default_currency,'finance_legal_evidence',c.regulatory_metadata->'finance_legal_evidence') AS company,
        jsonb_build_object('profile',c.finance_profile_tz,'address',c.address,'mainlandVrn',c.settings#>>'{payment_details,vrn}') AS tz
        FROM companies c WHERE c.deleted_at IS NULL;`);
    await q.query(`CREATE FUNCTION finance_fin01_activation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE final_input jsonb; release_data jsonb; answers jsonb; currency_answers jsonb; calendar_answers jsonb; chart_answers jsonb;
      BEGIN
        IF TG_OP='UPDATE' AND OLD.withdrawn_at IS NULL AND NEW.withdrawn_at IS NOT NULL AND NEW.withdrawn_by IS NOT NULL AND length(trim(NEW.withdrawal_reason))>0
          AND (to_jsonb(OLD)-ARRAY['withdrawn_at','withdrawn_by','withdrawal_reason'])=(to_jsonb(NEW)-ARRAY['withdrawn_at','withdrawn_by','withdrawal_reason']) THEN RETURN NEW; END IF;
        IF TG_OP<>'INSERT' OR NEW.withdrawn_at IS NOT NULL OR NEW.reason IS NULL OR btrim(NEW.reason)='' THEN RAISE EXCEPTION 'Operating decisions retain their original evidence'; END IF;
        SELECT v.subject->'input' INTO final_input FROM finance_setup_versions v JOIN LATERAL
          (SELECT to_state FROM finance_setup_events WHERE version_id=v.id ORDER BY sequence DESC LIMIT 1)e ON e.to_state='REVIEWED_INACTIVE'
          WHERE v.id=NEW.setup_id AND v.step='G04-10' AND v.maker_subject_id<>NEW.actor_id;
        IF final_input IS NULL OR final_input->>'purpose' IS DISTINCT FROM 'COMPANY_SETUP' OR jsonb_array_length(final_input->'dependencies') IS DISTINCT FROM 9
          OR (SELECT count(DISTINCT v.step) FROM jsonb_array_elements(final_input->'dependencies') pin JOIN finance_setup_versions v
            ON v.id::text=pin->>'id' AND v.subject_hash=pin->>'hash' AND v.tenant_id=NEW.tenant_id AND v.legal_entity_id=NEW.legal_entity_id AND v.book_id=NEW.book_id
            JOIN LATERAL (SELECT to_state FROM finance_setup_events WHERE version_id=v.id ORDER BY sequence DESC LIMIT 1)e ON e.to_state='REVIEWED_INACTIVE'
            WHERE v.step<>'G04-10' AND v.subject#>>'{input,purpose}'='COMPANY_SETUP' AND (v.step<>'G04-01' OR v.id=NEW.legal_step_id))<>9
          THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='A complete, independently reviewed company setup is required.'; END IF;
        SELECT v.subject#>'{input,answers}' INTO answers FROM finance_setup_versions v WHERE v.step='G04-07' AND final_input->'dependencies' @> jsonb_build_array(jsonb_build_object('id',v.id::text));
        SELECT v.subject#>'{input,answers}' INTO currency_answers FROM finance_setup_versions v WHERE v.step='G04-03' AND final_input->'dependencies' @> jsonb_build_array(jsonb_build_object('id',v.id::text));
        SELECT v.subject#>'{input,answers}' INTO calendar_answers FROM finance_setup_versions v WHERE v.step='G04-04' AND final_input->'dependencies' @> jsonb_build_array(jsonb_build_object('id',v.id::text));
        SELECT v.subject#>'{input,answers}' INTO chart_answers FROM finance_setup_versions v WHERE v.step='G04-06' AND final_input->'dependencies' @> jsonb_build_array(jsonb_build_object('id',v.id::text));
        IF NEW.book_role IS DISTINCT FROM currency_answers->>'bookRole' OR NEW.timezone IS DISTINCT FROM calendar_answers->>'timezone' OR
          NEW.controls IS DISTINCT FROM jsonb_build_object('numbering',answers->'numbering','paymentTerms',answers->'paymentTerms','termAssignments',coalesce(answers->'termAssignments','[]'),
            'paymentMethods',answers->'paymentMethods','approvalLimits',answers->'approvalLimits','currencies',currency_answers->'transactionCurrencies','functionalCurrency',currency_answers->'functionalCurrency',
            'currencyScales',currency_answers->'currencyScales','configurationPins',answers->'configurationPins',
            'calendar',calendar_answers->'periods','departmentIds',coalesce(chart_answers->'departmentIds','[]'),'costCentres',coalesce(chart_answers->'costCentres','[]'),
            'dimensionReleaseId',chart_answers->'dimensionReleaseId','dimensionReleaseHash',chart_answers->'dimensionReleaseHash')
          THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Operating controls differ from the exact reviewed configuration.'; END IF;
        SELECT d.payload INTO release_data FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id AND e.subject_hash=d.subject_hash
          WHERE d.id=NEW.release_id AND d.kind='RELEASE' AND d.mode='LIVE' AND e.state='APPROVED' AND d.payload->>'sourceCompanyId'=NEW.company_id::text
          AND EXISTS(SELECT 1 FROM finance_foundation_authorities a WHERE a.id=NEW.authority_id AND a.tenant_id=NEW.tenant_id AND a.legal_entity_id=NEW.legal_entity_id
          AND a.book_id=NEW.book_id AND a.subject_id=NEW.actor_id AND a.natural_person_id<>d.maker_natural_person_id AND a.company_role='COMPANY_ADMIN' AND a.capability='RELEASE'
          AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp()));
        IF release_data IS NULL OR NOT EXISTS(SELECT 1 FROM finance_foundation_documents d JOIN finance_foundation_decisions e
          ON e.document_id=d.id AND e.state='REVIEWED' AND e.subject_hash=d.subject_hash WHERE d.id::text=release_data->>'openingId' AND d.kind='OPENING'
          AND d.mode='LIVE' AND d.book_id=NEW.book_id AND d.subject_hash=release_data->>'openingHash' AND d.payload->>'contextHash'=release_data->>'contextHash'
          AND d.payload->>'date'=release_data->>'activeFrom' AND d.payload->>'sourceEvidenceHash'=release_data->>'sourceReconciliationHash')
          THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='An independently approved book release and reconciled live opening are required.'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER operating_setup_audit BEFORE INSERT OR UPDATE OR DELETE ON finance_operating_setups FOR EACH ROW EXECUTE FUNCTION finance_fin01_activation_guard();
      CREATE TRIGGER operating_setup_no_truncate BEFORE TRUNCATE ON finance_operating_setups FOR EACH STATEMENT EXECUTE FUNCTION finance_foundation_immutable();`);
    await q.query(`CREATE FUNCTION finance_fin01_blocker(activation uuid, accounting_date date DEFAULT NULL)
      RETURNS text LANGUAGE plpgsql AS $$
      DECLARE a finance_operating_setups; snap jsonb; final_input jsonb; today date; company_source record;
      BEGIN
        SELECT * INTO a FROM finance_operating_setups WHERE id=activation AND withdrawn_at IS NULL FOR SHARE;
        IF NOT FOUND THEN RETURN 'FIN-01.03|Select an active operating book.'; END IF;
        today := (statement_timestamp() AT TIME ZONE a.timezone)::date;
        IF today<a.starts_on OR today>=a.ends_before OR COALESCE(accounting_date,today)<a.starts_on OR COALESCE(accounting_date,today)>=a.ends_before THEN RETURN 'FIN-01.06|Renew the approved calendar and release interval.'; END IF;
        PERFORM id FROM companies WHERE id=a.company_id AND status='active' AND deleted_at IS NULL FOR SHARE;
        IF NOT FOUND THEN RETURN 'FIN-01.01|Restore or review the company registration status.'; END IF;
        SELECT * INTO company_source FROM finance_company_setup_sources WHERE id=a.company_id;
        SELECT subject->'sourceSnapshot' INTO snap FROM finance_setup_versions WHERE id=a.legal_step_id;
        IF snap->'company' IS DISTINCT FROM company_source.company OR
          (snap ? 'tanzaniaSource' AND snap->'tanzaniaSource' IS DISTINCT FROM company_source.tz) THEN RETURN 'FIN-01.01|Review the changed company financial profile and its evidence.'; END IF;
        SELECT subject->'input' INTO final_input FROM finance_setup_versions WHERE id=a.setup_id;
        IF EXISTS(SELECT 1 FROM jsonb_array_elements(final_input->'dependencies') dep JOIN finance_setup_versions v ON v.id::text=dep->>'id'
          CROSS JOIN LATERAL jsonb_array_elements(v.subject#>'{input,answers,configurationPins}') pin WHERE v.step='G04-07' AND NOT EXISTS
          (SELECT 1 FROM finance_configuration_releases r WHERE r.id::text=pin->>'id' AND r.release_hash=pin->>'hash' AND r.book_id=a.book_id AND r.state='REVIEWED_INACTIVE'
            AND r.effective_from<=today AND (r.effective_to IS NULL OR r.effective_to>today))) THEN RETURN 'FIN-01.16|Renew the configuration releases selected in G04-07.'; END IF;
        IF EXISTS(SELECT 1 FROM jsonb_array_elements(final_input->'dependencies') dep JOIN finance_setup_versions v ON v.id::text=dep->>'id'
          CROSS JOIN LATERAL jsonb_array_elements(v.subject#>'{input,answers,configurationPins}') pin
          JOIN finance_configuration_releases r ON r.id::text=pin->>'id' WHERE v.step='G04-07' AND r.kind='TAX_RULES' AND r.payload->>'sourceTaxCatalogue'='NO_SOURCE_TAX_RULES')
          AND (EXISTS(SELECT 1 FROM taxes WHERE company_id::text=a.company_id::text AND deleted_at IS NULL AND is_active)
            OR EXISTS(SELECT 1 FROM product_tax_rules WHERE company_id::text=a.company_id::text AND deleted_at IS NULL AND status='ACTIVE'))
          THEN RETURN 'FIN-01.02|Reassess the new source tax rules in G04-07.'; END IF;
        IF EXISTS(SELECT 1 FROM jsonb_array_elements(final_input->'dependencies') dep JOIN finance_setup_versions v ON v.id::text=dep->>'id'
          CROSS JOIN LATERAL jsonb_array_elements(v.subject#>'{input,answers,policyDecisions}') pin WHERE v.step='G04-08' AND pin->>'disposition' IN ('PROPOSED_TREATMENT','NOT_APPLICABLE') AND NOT EXISTS
          (SELECT 1 FROM finance_policy_versions p JOIN LATERAL (SELECT to_state FROM finance_policy_events WHERE policy_id=p.id ORDER BY sequence DESC LIMIT 1)e ON true
            WHERE p.id::text=pin->>'policyVersionId' AND p.definition_hash=pin->>'policyVersionHash' AND p.book_id=a.book_id AND
            ((pin->>'disposition'='PROPOSED_TREATMENT' AND e.to_state IN ('APPROVED','ACTIVE')) OR (pin->>'disposition'='NOT_APPLICABLE' AND e.to_state='NOT_APPLICABLE')))) THEN RETURN 'FIN-01.02|Review the accounting policy decisions retained in G04-08.'; END IF;
        IF EXISTS(SELECT 1 FROM finance_setup_versions v CROSS JOIN LATERAL jsonb_array_elements(v.subject#>'{input,evidence}') pin
          WHERE (v.id=a.setup_id OR EXISTS(SELECT 1 FROM jsonb_array_elements(final_input->'dependencies') dep WHERE dep->>'id'=v.id::text))
          AND NOT EXISTS(SELECT 1 FROM document_versions dv JOIN documents d ON d.id=dv.document_id AND d.company_id=dv.company_id
            WHERE dv.id::text=pin->>'id' AND d.id::text=pin->>'documentId' AND dv.sha256_hash=pin->>'hash' AND dv.company_id=a.company_id
            AND dv.status='AVAILABLE' AND d.status='AVAILABLE' AND ((d.owner_type='COMPANY' AND d.owner_id=a.company_id) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=a.book_id)))) THEN RETURN 'FIN-01.16|Replace unavailable or changed document evidence in its setup step.'; END IF;
        IF EXISTS(SELECT 1 FROM finance_setup_versions v CROSS JOIN LATERAL jsonb_array_elements_text(v.subject#>'{input,answers,productIds}') pid
          WHERE v.id=a.legal_step_id AND NOT EXISTS(SELECT 1 FROM insurance_products p JOIN insurance_product_versions pv ON pv.id=p.current_version_id AND pv.company_id=p.company_id
            CROSS JOIN LATERAL jsonb_array_elements(snap->'products') s WHERE p.company_id::text=a.company_id::text AND p.id::text=pid AND s->>'id'=pid
              AND p.current_version_id::text=s->>'current_version_id' AND pv.product_id=p.id AND p.is_active AND p.lifecycle_status='ACTIVE'
              AND pv.status IN ('ACTIVE','PUBLISHED') AND p.deleted_at IS NULL AND (pv.effective_from IS NULL OR pv.effective_from<=COALESCE(accounting_date,today))
              AND (pv.effective_to IS NULL OR pv.effective_to>COALESCE(accounting_date,today)))) THEN RETURN 'FIN-01.01|Review the current company products and their effective dates.'; END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_accounting_books b JOIN finance_legal_entities e ON e.id=b.legal_entity_id AND e.tenant_id=b.tenant_id
          WHERE b.id=a.book_id AND b.tenant_id=a.tenant_id AND e.id=a.legal_entity_id AND b.state<>'DISABLED' AND e.state<>'DISABLED'
          AND (e.jurisdiction_code<>'TZ' OR upper(btrim(e.legal_name))=upper(btrim(company_source.company->>'name')))
          AND e.jurisdiction_code=(SELECT subject#>>'{input,answers,jurisdictionCode}' FROM finance_setup_versions WHERE id=a.legal_step_id)) THEN RETURN 'FIN-01.03|Review the legal entity name, jurisdiction and book status.'; END IF;
        RETURN NULL;
      END $$;
      CREATE FUNCTION finance_fin01_current(activation uuid,accounting_date date DEFAULT NULL) RETURNS boolean LANGUAGE sql AS $$ SELECT finance_fin01_blocker(activation,accounting_date) IS NULL $$`);
    await q.query(`CREATE FUNCTION finance_fin01_primary(company uuid) RETURNS finance_operating_setups LANGUAGE plpgsql AS $$
      DECLARE a finance_operating_setups;
      BEGIN
        SELECT * INTO a FROM finance_operating_setups WHERE company_id=company AND book_role='PRIMARY' AND withdrawn_at IS NULL FOR SHARE;
        IF a.id IS NULL OR NOT finance_fin01_current(a.id) THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='FIN-01 requires a current approved primary book and company profile.'; END IF;
        RETURN a;
      END $$`);
    await q.query(`CREATE FUNCTION finance_fin01_number(activation uuid, doc_kind text) RETURNS text LANGUAGE plpgsql AS $$
      DECLARE a finance_operating_setups; rule jsonb; bucket text; seq bigint; digits text; company_prefix text; candidate text;
      BEGIN
        SELECT * INTO STRICT a FROM finance_operating_setups WHERE id=activation AND withdrawn_at IS NULL FOR SHARE;
        SELECT r INTO STRICT rule FROM jsonb_array_elements(a.controls->'numbering') r WHERE r->>'documentType'=doc_kind;
        bucket:=CASE rule->>'reset' WHEN 'YEAR' THEN to_char(statement_timestamp() AT TIME ZONE a.timezone,'YYYY')
          WHEN 'MONTH' THEN to_char(statement_timestamp() AT TIME ZONE a.timezone,'YYYYMM') ELSE 'ALL' END;
        SELECT coalesce(identifier_prefix,left(replace(id::text,'-',''),12)) INTO company_prefix FROM companies WHERE id=a.company_id;
        LOOP
          INSERT INTO business_document_sequences(company_id,document_type,period_key,current_value)
            VALUES(a.company_id,'FIN01_'||(rule->>'prefix'),bucket,1) ON CONFLICT(company_id,document_type,period_key)
            DO UPDATE SET current_value=business_document_sequences.current_value+1,updated_at=statement_timestamp() RETURNING current_value INTO seq;
          digits:=seq::text;
          candidate:=concat_ws('-',company_prefix,concat(rule->>'prefix',nullif(bucket,'ALL')),lpad(digits,greatest(length(digits),(rule->>'width')::int),'0'));
          -- Earlier manual imports could assign numbers without using the shared identifier registry.
          IF (CASE doc_kind
            WHEN 'INVOICE' THEN EXISTS(SELECT 1 FROM invoices WHERE company_id=a.company_id AND invoice_no=candidate)
            WHEN 'RECEIPT' THEN EXISTS(SELECT 1 FROM receipts WHERE company_id=a.company_id AND receipt_no=candidate)
            WHEN 'PAYMENT_TRANSACTION' THEN EXISTS(SELECT 1 FROM payment_transactions WHERE company_id=a.company_id AND transaction_no=candidate)
            WHEN 'REFUND' THEN EXISTS(SELECT 1 FROM finance_refunds WHERE company_id=a.company_id AND refund_no=candidate)
            WHEN 'COMMISSION_ACCRUAL' THEN EXISTS(SELECT 1 FROM commission_transactions WHERE company_id=a.company_id AND accrual_no=candidate)
            WHEN 'COMMISSION_PAYMENT' THEN EXISTS(SELECT 1 FROM commission_payments WHERE company_id=a.company_id AND payment_no=candidate)
            WHEN 'JOURNAL' THEN EXISTS(SELECT 1 FROM finance_journal_entries WHERE company_id=a.company_id AND journal_no=candidate)
            WHEN 'RECONCILIATION' THEN EXISTS(SELECT 1 FROM finance_reconciliation_batches WHERE company_id=a.company_id AND batch_no=candidate)
            WHEN 'FINANCIAL_REVERSAL' THEN EXISTS(SELECT 1 FROM financial_reversals WHERE company_id=a.company_id AND reversal_no=candidate)
            ELSE false END) THEN CONTINUE; END IF;
          INSERT INTO generated_identifiers(identifier_type,identifier_value,company_id) VALUES(doc_kind,candidate,a.company_id)
            ON CONFLICT(identifier_value) DO NOTHING;
          IF FOUND THEN RETURN candidate; END IF;
        END LOOP;
      END $$`);
    await q.query(`CREATE FUNCTION finance_fin01_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE a finance_operating_setups; row_data jsonb:=to_jsonb(NEW); method_rule jsonb; approval_action text;
        direction text; currency_code text; amount numeric; reference text; party text; party_id text; terms jsonb; term_code text;
        maker text; approval_user text; system_accrual boolean; operating_date date; booked_date date; effective_time timestamptz;
      BEGIN
        -- Authenticated provider observations are retained independently of their accounting attempt.
        IF TG_TABLE_NAME='payment_transactions' AND EXISTS(SELECT 1 FROM finance_provider_events e WHERE e.provider_code=row_data->>'provider_code'
          AND e.provider_event_id=row_data->>'provider_event_id' AND e.signature_valid AND e.status='RECEIVED'
          AND e.payload_hash=row_data->>'provider_payload_hash' AND (e.company_id IS NULL OR e.company_id::text=row_data->>'company_id')) THEN RETURN NEW; END IF;
        a := finance_fin01_primary((row_data->>'company_id')::uuid);
        operating_date:=(statement_timestamp() AT TIME ZONE a.timezone)::date;
        IF TG_OP='INSERT' OR (row_data->>'status' IS DISTINCT FROM to_jsonb(OLD)->>'status') THEN
          effective_time:=CASE WHEN TG_TABLE_NAME='invoices' AND row_data->>'status'='ISSUED' THEN (row_data->>'issued_at')::timestamptz
            WHEN TG_TABLE_NAME='receipts' AND TG_OP='INSERT' THEN (row_data->>'received_at')::timestamptz
            WHEN TG_TABLE_NAME IN ('finance_refunds','commission_payments') AND row_data->>'status'='PAID' THEN (row_data->>'paid_at')::timestamptz
            WHEN TG_TABLE_NAME='claim_disbursements' AND row_data->>'status'='PAID' THEN (row_data->>'confirmed_at')::timestamptz
            WHEN TG_TABLE_NAME='reinsurance_settlements' AND row_data->>'status'='PAID' THEN (row_data->>'settled_at')::timestamptz END;
        END IF;
        booked_date:=coalesce((row_data->>'journal_date')::date,(effective_time AT TIME ZONE a.timezone)::date,operating_date);
        IF booked_date<a.starts_on OR booked_date>=a.ends_before THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Transaction date is outside the approved finance setup.'; END IF;
        IF NOT EXISTS(SELECT 1 FROM finance_foundation_periods WHERE book_id=a.book_id AND tenant_id=a.tenant_id AND legal_entity_id=a.legal_entity_id
          AND mode='LIVE' AND state='OPEN' AND period_kind='REGULAR' AND starts_on<=booked_date AND ends_before>booked_date FOR SHARE)
          THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='An open regular accounting period is required.'; END IF;
        currency_code:=coalesce(row_data->>'currency_code',row_data->>'currency',row_data#>>'{commission_snapshot,currencyCode}');
        IF TG_TABLE_NAME='commission_transactions' AND currency_code IS NULL THEN
          SELECT i.currency INTO currency_code FROM invoices i WHERE i.id=(row_data->>'invoice_id')::uuid AND i.company_id=a.company_id;
          currency_code:=coalesce(currency_code,a.controls->>'functionalCurrency');
        END IF;
        IF currency_code IS NOT NULL AND NOT ((a.controls->'currencies') ? currency_code) THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Currency is outside the approved book configuration.'; END IF;
        IF TG_TABLE_NAME='receipt_allocations' AND currency_code IS NULL THEN SELECT currency INTO currency_code FROM receipts WHERE id=(row_data->>'receipt_id')::uuid; END IF;
        IF currency_code IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_each_text(row_data) n WHERE
          n.key IN ('amount','gross_amount','tax_amount','discount_amount','total_amount','charges_amount','paid_amount','net_amount','balance_amount','allocated_amount','unallocated_amount','refunded_amount','written_off_amount','reversal_amount','original_amount','commission_amount','statement_total')
          AND (TG_OP='INSERT' OR to_jsonb(OLD)->>n.key IS DISTINCT FROM n.value)
          AND n.value::numeric <> trunc(n.value::numeric,(a.controls->'currencyScales'->>currency_code)::int)) THEN
          RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Amount exceeds the approved currency precision.'; END IF;
        IF TG_TABLE_NAME IN ('invoices','commission_payments') AND (TG_OP='INSERT' OR row_data->>'payment_term_code' IS DISTINCT FROM to_jsonb(OLD)->>'payment_term_code'
          OR (TG_TABLE_NAME='invoices' AND row_data->>'status'='ISSUED' AND to_jsonb(OLD)->>'status' IS DISTINCT FROM 'ISSUED')) THEN
          party:=CASE TG_TABLE_NAME WHEN 'invoices' THEN 'CUSTOMER' ELSE 'SUPPLIER' END;
          party_id:=COALESCE(row_data->>'customer_id',row_data->>'intermediary_company_id');
          term_code:=row_data->>'payment_term_code';
          IF term_code IS NULL THEN SELECT r->>'termCode' INTO term_code FROM jsonb_array_elements(a.controls->'termAssignments') r WHERE r->>'party'=party AND r->>'partyId'=party_id; END IF;
          SELECT r INTO terms FROM jsonb_array_elements(a.controls->'paymentTerms') r WHERE r->>'party'=party AND
          (CASE WHEN term_code IS NULL THEN (r->>'isDefault')::boolean ELSE r->>'code'=term_code END);
          IF terms IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Select an approved payment term for this party.'; END IF;
          NEW.payment_term_code:=terms->>'code';
          NEW.due_date:=coalesce(((row_data->>'issued_at')::timestamptz AT TIME ZONE a.timezone)::date,operating_date)+(terms->>'days')::int;
        ELSIF TG_TABLE_NAME IN ('invoices','commission_payments') AND TG_OP='UPDATE' AND row_data->>'due_date' IS DISTINCT FROM to_jsonb(OLD)->>'due_date' THEN
          RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Change the approved payment term to change the due date.';
        END IF;
        IF (TG_TABLE_NAME IN ('receipts','payment_transactions','finance_refunds','commission_payments') AND
            (TG_OP='INSERT' OR row_data->>'payment_method' IS DISTINCT FROM to_jsonb(OLD)->>'payment_method' OR
              (TG_TABLE_NAME IN ('finance_refunds','commission_payments') AND row_data->>'status'='PAID' AND to_jsonb(OLD)->>'status' IS DISTINCT FROM 'PAID')))
          OR (TG_TABLE_NAME IN ('claim_disbursements','reinsurance_settlements') AND row_data->>'status'='PAID' AND
            (TG_OP='INSERT' OR to_jsonb(OLD)->>'status' IS DISTINCT FROM 'PAID')) THEN
          direction:=CASE WHEN TG_TABLE_NAME IN ('receipts','payment_transactions') OR (TG_TABLE_NAME='reinsurance_settlements' AND row_data->>'settlement_type'='CLAIM_RECOVERY') THEN 'INCOMING' ELSE 'OUTGOING' END;
          SELECT r INTO method_rule FROM jsonb_array_elements(a.controls->'paymentMethods') r WHERE r->>'method'=row_data->>'payment_method' AND r->>'direction' IN (direction,'BOTH');
          reference:=coalesce(nullif(row_data->>'payment_reference',''),nullif(row_data->>'provider_reference',''),nullif(row_data->>'provider_refund_id',''),
            nullif(row_data->>'receipt_id',''),nullif(row_data->>'payment_transaction_id',''));
          IF method_rule IS NULL OR ((method_rule->>'referenceRequired')::boolean AND NULLIF(btrim(reference),'') IS NULL)
            THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Payment method or reference is outside the approved FIN-01 settings.'; END IF;
          IF TG_TABLE_NAME<>'payment_transactions' THEN NEW.settlement_account_code:=method_rule->>'accountCode'; END IF;
        END IF;
        IF row_data->>'status'='APPROVED' AND (TG_OP='INSERT' OR to_jsonb(OLD)->>'status' IS DISTINCT FROM 'APPROVED') THEN
          approval_action:=CASE TG_TABLE_NAME WHEN 'finance_refunds' THEN 'REFUND' WHEN 'commission_payments' THEN 'COMMISSION_PAYMENT'
            WHEN 'commission_transactions' THEN 'COMMISSION_ACCRUAL' WHEN 'finance_reconciliation_batches' THEN 'RECONCILIATION'
            WHEN 'claim_payments' THEN 'CLAIM_PAYMENT' WHEN 'reinsurance_settlements' THEN 'REINSURANCE_SETTLEMENT' END;
          IF approval_action IN ('CLAIM_PAYMENT','REINSURANCE_SETTLEMENT') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.controls->'approvalLimits') lim WHERE lim->>'action'=approval_action) THEN approval_action:=NULL; END IF;
          IF approval_action IS NOT NULL THEN
            maker:=coalesce(row_data->>'requested_by',row_data->>'submitted_by',row_data->>'accrued_by',row_data->>'imported_by');
            approval_user:=row_data->>'approved_by';
            amount:=abs(coalesce(row_data->>'amount',row_data->>'total_amount',row_data->>'commission_amount',row_data->>'statement_total',row_data->>'net_amount',row_data->>'paid_amount')::numeric);
            system_accrual:=coalesce(TG_TABLE_NAME='commission_transactions' AND row_data->>'commission_snapshot_hash' ~ '^[a-f0-9]{64}$'
              AND nullif(row_data#>>'{commission_snapshot,sourceEventId}','') IS NOT NULL AND row_data#>>'{commission_snapshot,quotationId}'=row_data->>'quotation_id',false);
            IF approval_user IS NULL OR (maker IS NULL AND NOT system_accrual) OR maker=approval_user OR NOT EXISTS(
              SELECT 1 FROM jsonb_array_elements(a.controls->'approvalLimits') lim JOIN roles r ON r.name=lim->>'role'
              JOIN company_user_roles cr ON cr.role_id::text=r.id::text JOIN company_users cu ON cu.id::text=cr.company_user_id::text
              JOIN users u ON u.id::text=cu.user_id::text WHERE cu.company_id::text=a.company_id::text AND cu.user_id::text=approval_user AND cu.status='active' AND u.status='active'
              AND (r.company_id::text=a.company_id::text OR (r.company_id IS NULL AND r.scope='tenant_template')) AND lim->>'action'=approval_action
              AND lim->>'currency'=currency_code AND (lim->>'maximum')::numeric>=amount)
              THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='This approval exceeds the independent approver’s configured authority.'; END IF;
          END IF;
        END IF;
        RETURN NEW;
      END $$`);
    await q.query(`CREATE FUNCTION finance_fin01_item_precision() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE a finance_operating_setups; source_company uuid; ccy text; digits int;
      BEGIN
        IF TG_TABLE_NAME='invoice_items' THEN SELECT company_id,currency INTO source_company,ccy FROM invoices WHERE id=NEW.invoice_id FOR SHARE;
        ELSE SELECT company_id,currency INTO source_company,ccy FROM commission_payments WHERE id=NEW.commission_payment_id FOR SHARE; END IF;
        a:=finance_fin01_primary(source_company); digits:=(a.controls->'currencyScales'->>ccy)::int;
        IF digits IS NULL OR EXISTS(SELECT 1 FROM jsonb_each_text(to_jsonb(NEW)) n WHERE n.key IN ('amount','unit_amount','total_amount') AND n.value::numeric<>trunc(n.value::numeric,digits))
        THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Line amount exceeds the approved currency precision.'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin01_item_precision BEFORE INSERT OR UPDATE OF unit_amount,total_amount ON invoice_items FOR EACH ROW EXECUTE FUNCTION finance_fin01_item_precision();
      CREATE TRIGGER fin01_item_precision BEFORE INSERT OR UPDATE OF amount ON commission_payment_items FOR EACH ROW EXECUTE FUNCTION finance_fin01_item_precision()`);
    for (const table of controlledTables)
      await q.query(
        `CREATE TRIGGER fin01_operating_guard BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION finance_fin01_guard()`,
      );
    await q.query(`CREATE FUNCTION finance_fin01_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE a finance_operating_setups; r record;
      BEGIN
        IF TG_TABLE_NAME='finance_foundation_deployments' THEN
          IF NEW.action='DISABLE' THEN RETURN NEW; END IF;
        ELSIF NEW.mode<>'LIVE' THEN RETURN NEW; END IF;
        SELECT * INTO a FROM finance_operating_setups WHERE tenant_id=NEW.tenant_id AND legal_entity_id=NEW.legal_entity_id AND book_id=NEW.book_id AND withdrawn_at IS NULL;
        IF a.id IS NULL OR NOT finance_fin01_current(a.id,(to_jsonb(NEW)->>'accounting_date')::date)
          THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Complete and activate FIN-01 for this book.'; END IF;
        IF TG_TABLE_NAME='finance_foundation_deployments' THEN
          IF a.release_id<>NEW.release_id THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Ledger release differs from the approved FIN-01 release.'; END IF;
        ELSE
          SELECT period_kind INTO r FROM finance_foundation_periods WHERE id=NEW.period_id;
          IF NOT ((a.controls->'currencies') ? NEW.transaction_currency) THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='The transaction currency is outside the activated book.'; END IF;
          NEW.journal_no:=finance_fin01_number(a.id,'JOURNAL');
          IF EXISTS(SELECT 1 FROM finance_journal_candidate_lines l WHERE l.candidate_id=NEW.candidate_id AND (
            EXISTS(SELECT 1 FROM finance_configuration_releases d CROSS JOIN LATERAL jsonb_array_elements(d.payload->'definitions') def
              WHERE d.id::text=a.controls->>'dimensionReleaseId' AND d.release_hash=a.controls->>'dimensionReleaseHash' AND (def->>'required')::boolean AND NULLIF(btrim(l.dimensions->>(def->>'code')),'') IS NULL) OR
            (l.dimensions ? 'DEPARTMENT' AND (NOT ((a.controls->'departmentIds') ? (l.dimensions->>'DEPARTMENT')) OR NOT EXISTS
              (SELECT 1 FROM departments d WHERE d.id::text=l.dimensions->>'DEPARTMENT' AND d.company_id::text=a.company_id::text AND d.status='active' AND d.deleted_at IS NULL))) OR
            (l.dimensions ? 'COST_CENTRE' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.controls->'costCentres') cc WHERE cc->>'code'=l.dimensions->>'COST_CENTRE')) OR
            (l.dimensions ? 'DIMENSION_RELEASE' AND (l.dimensions->>'DIMENSION_RELEASE' IS DISTINCT FROM a.controls->>'dimensionReleaseId' OR l.dimensions->>'DIMENSION_HASH' IS DISTINCT FROM a.controls->>'dimensionReleaseHash'))))
            THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Journal dimensions differ from the approved company and book values.'; END IF;
          IF r.period_kind='ADJUSTMENT' AND NEW.kind<>'REVERSAL' AND NOT EXISTS(
            SELECT 1 FROM finance_journal_candidates c WHERE c.id=NEW.candidate_id AND c.payload->>'economicOrigin'='ADJUSTMENT')
            THEN RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='Only adjustment journals or reversals may use this period.'; END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin01_ledger_setup BEFORE INSERT ON finance_foundation_journals FOR EACH ROW EXECUTE FUNCTION finance_fin01_ledger_guard();
      CREATE TRIGGER fin01_deployment_setup BEFORE INSERT ON finance_foundation_deployments FOR EACH ROW EXECUTE FUNCTION finance_fin01_ledger_guard()`);
    await q.query(`CREATE FUNCTION finance_fin01_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.mode='LIVE' AND NOT EXISTS(SELECT 1 FROM finance_operating_setups a CROSS JOIN LATERAL jsonb_array_elements(a.controls->'calendar') p
          WHERE a.tenant_id=NEW.tenant_id AND a.legal_entity_id=NEW.legal_entity_id AND a.book_id=NEW.book_id AND a.withdrawn_at IS NULL
          AND p->>'code'=NEW.period_code AND (p->>'from')::date=NEW.starts_on AND (p->>'to')::date=NEW.ends_before AND coalesce(p->>'kind','REGULAR')=NEW.period_kind)
          THEN RAISE EXCEPTION USING ERRCODE='P0101',MESSAGE='Select periods from the approved FIN-01 calendar.'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fin01_period_setup BEFORE INSERT ON finance_foundation_periods FOR EACH ROW EXECUTE FUNCTION finance_fin01_period_guard()`);
  }
  async down(q: QueryRunner) {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_operating_setups) OR EXISTS(SELECT 1 FROM companies WHERE finance_profile_tz IS NOT NULL)
      THEN RAISE EXCEPTION 'FIN-01 profile and activation records must be retained'; END IF; END $$`);
    await q.query(
      'DROP TRIGGER fin01_item_precision ON invoice_items; DROP TRIGGER fin01_item_precision ON commission_payment_items; DROP FUNCTION finance_fin01_item_precision()',
    );
    await migrateCurrencyPrecision(q, false);
    await q.query(
      'DROP TRIGGER fin01_request_history ON finance_approval_requests; DROP FUNCTION finance_fin01_request_history(); DROP INDEX fin01_request_history; ALTER TABLE finance_approval_requests ADD UNIQUE(candidate_id)',
    );
    for (const table of controlledTables)
      await q.query(`DROP TRIGGER fin01_operating_guard ON ${table}`);
    await q.query(`DROP TRIGGER fin01_ledger_setup ON finance_foundation_journals; DROP TRIGGER fin01_deployment_setup ON finance_foundation_deployments;
      DROP TRIGGER fin01_period_setup ON finance_foundation_periods; DROP FUNCTION finance_fin01_period_guard();
      DROP FUNCTION finance_fin01_ledger_guard(); DROP FUNCTION finance_fin01_guard(); DROP FUNCTION finance_fin01_primary(uuid);
      DROP FUNCTION finance_fin01_current(uuid,date); DROP FUNCTION finance_fin01_blocker(uuid,date); DROP FUNCTION finance_fin01_number(uuid,text); ALTER TABLE companies DROP COLUMN finance_primary_setup_id;
      DROP TABLE finance_operating_postings; DROP TABLE finance_operating_setups; DROP FUNCTION finance_fin01_activation_guard(); DROP VIEW finance_company_setup_sources;
      ALTER TABLE receipts DROP COLUMN settlement_account_code; ALTER TABLE finance_refunds DROP COLUMN settlement_account_code;
      ALTER TABLE claim_disbursements DROP COLUMN settlement_account_code; ALTER TABLE reinsurance_settlements DROP COLUMN settlement_account_code;
      ALTER TABLE commission_payments DROP COLUMN settlement_account_code; ALTER TABLE finance_foundation_journals DROP COLUMN journal_no;
      ALTER TABLE companies DROP COLUMN finance_profile_tz; ALTER TABLE invoices DROP COLUMN payment_term_code,DROP COLUMN issue_command_key,DROP COLUMN issue_command_hash,DROP COLUMN finance_dimensions;
      ALTER TABLE finance_journal_lines DROP COLUMN dimensions;
      ALTER TABLE receipts DROP COLUMN post_command_key,DROP COLUMN post_command_hash,DROP COLUMN finance_dimensions;
      ALTER TABLE commission_payments DROP COLUMN payment_term_code,DROP COLUMN due_date; ALTER TABLE finance_foundation_periods DROP COLUMN period_kind;`);
  }
}
