import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive cutover. Issuance must be paused while high-water marks are established. */
export class LifetimePolicyNumbering1794500000000 implements MigrationInterface {
  name = 'LifetimePolicyNumbering1794500000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE policies, companies, business_document_sequences IN SHARE ROW EXCLUSIVE MODE;
      ALTER TABLE business_document_sequences ALTER COLUMN current_value TYPE bigint;
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM policies GROUP BY insurer_company_id, policy_no HAVING count(*) > 1) THEN
          RAISE EXCEPTION 'Policy numbering preflight: duplicate insurer policy numbers (including deleted rows); resolve before cutover';
        END IF;
      END $$;
      ALTER TABLE policies ADD COLUMN IF NOT EXISTS policy_sequence bigint;
      ALTER TABLE policies ALTER COLUMN policy_no TYPE varchar(150);
      ALTER TABLE analytics_policy_facts ALTER COLUMN policy_no TYPE varchar(150);
      -- An intermediary can own policies from several independent insurer sequences.
      DROP INDEX IF EXISTS "IDX_policies_company_policy_no";
      CREATE INDEX "IDX_policies_company_policy_no" ON policies(company_id, policy_no)
        WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_policies_insurer_number_all
        ON policies(insurer_company_id, policy_no);
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_policies_insurer_sequence
        ON policies(insurer_company_id, policy_sequence);

      CREATE OR REPLACE FUNCTION provision_policy_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I AS bigint NO CYCLE',
          'policy_lifetime_' || replace(NEW.id::text, '-', ''));
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS provision_policy_sequence ON companies;
      CREATE TRIGGER provision_policy_sequence AFTER INSERT ON companies
        FOR EACH ROW EXECUTE FUNCTION provision_policy_sequence();

      DO $$ DECLARE company record; sequence_name text; historical bigint; current_max bigint; called boolean;
      BEGIN
        FOR company IN SELECT id FROM companies LOOP
          sequence_name := 'policy_lifetime_' || replace(company.id::text, '-', '');
          EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I AS bigint NO CYCLE', sequence_name);
          SELECT GREATEST(
            COALESCE((SELECT max((regexp_match(policy_no, '(?:^POL-[A-Z]{3}-[0-9]{4}-|^[A-Z0-9]+/[0-9]{4}/[0-9]+/[0-9]+/[0-9]+/)([0-9]+)$'))[1]::bigint)
              FROM policies WHERE insurer_company_id = company.id), 0),
            COALESCE((SELECT max(current_value) FROM business_document_sequences s
              WHERE s.document_type ~ '^POLICY_[A-Z]{3}$' AND
                (s.company_id = company.id OR s.company_id IN
                  (SELECT company_id FROM policies WHERE insurer_company_id = company.id))), 0),
            COALESCE((SELECT max(policy_sequence) FROM policies WHERE insurer_company_id = company.id), 0)
          ) INTO historical;
          EXECUTE format('SELECT last_value, is_called FROM public.%I', sequence_name) INTO current_max, called;
          IF historical >= current_max THEN
            PERFORM setval(('public.' || sequence_name)::regclass, GREATEST(historical, 1), historical > 0 OR called);
          END IF;
        END LOOP;
      END $$;

      CREATE OR REPLACE FUNCTION assign_policy_numbering_code() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE original_code text; start_key text; initial bigint; counter bigint; candidate text; occupied boolean; used boolean;
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.policy_numbering_code IS NOT NULL AND NEW.policy_numbering_code IS NOT DISTINCT FROM OLD.policy_numbering_code THEN
          RETURN NEW;
        END IF;
        -- Serialize code allocation/configuration per company and entity kind.
        PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME || ':' || NEW.company_id::text, 0));
        IF TG_OP = 'UPDATE' AND OLD.policy_numbering_code IS NOT NULL THEN
          IF TG_TABLE_NAME = 'branches' THEN
            SELECT EXISTS(SELECT 1 FROM policies WHERE branch_id = OLD.id AND policy_sequence IS NOT NULL) INTO used;
          ELSIF TG_TABLE_NAME = 'insurance_products' THEN
            SELECT EXISTS(SELECT 1 FROM policies WHERE product_id = OLD.id AND policy_sequence IS NOT NULL) INTO used;
          ELSE
            SELECT EXISTS(SELECT 1 FROM policies WHERE category_id = OLD.id AND policy_sequence IS NOT NULL) INTO used;
          END IF;
          IF used THEN RAISE EXCEPTION 'Policy numbering code is locked by issued policies' USING ERRCODE = '23514'; END IF;
        END IF;
        IF NEW.policy_numbering_code IS NOT NULL THEN RETURN NEW; END IF;
        original_code := CASE WHEN TG_TABLE_NAME = 'insurance_products' THEN to_jsonb(NEW)->>'product_code' ELSE to_jsonb(NEW)->>'code' END;
        IF original_code ~ '^[0-9]{1,12}$' THEN
          EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE company_id = $1 AND policy_numbering_code = $2)', TG_TABLE_NAME)
            INTO occupied USING NEW.company_id, original_code;
          IF NOT occupied THEN NEW.policy_numbering_code := original_code; RETURN NEW; END IF;
        END IF;
        start_key := CASE TG_TABLE_NAME WHEN 'branches' THEN 'branch_start' WHEN 'insurance_products' THEN 'product_start' ELSE 'category_start' END;
        SELECT (config_value::jsonb ->> start_key)::bigint INTO initial FROM company_configs
          WHERE company_id = NEW.company_id AND config_key = 'policy_numbering' AND is_active;
        initial := COALESCE(initial, CASE TG_TABLE_NAME WHEN 'branches' THEN 100 WHEN 'insurance_products' THEN 1001 ELSE 10 END);
        LOOP
          INSERT INTO business_document_sequences(company_id, document_type, period_key, current_value, created_at, updated_at)
            VALUES(NEW.company_id::uuid, 'POLICY_CODE_' || TG_TABLE_NAME, 'LIFETIME', initial, now(), now())
            ON CONFLICT(company_id, document_type, period_key) DO UPDATE
              SET current_value = GREATEST(business_document_sequences.current_value + 1, initial), updated_at = now()
            RETURNING current_value INTO counter;
          candidate := counter::text;
          IF length(candidate) > 12 THEN RAISE EXCEPTION 'Policy numbering code range exhausted'; END IF;
          EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE company_id = $1 AND policy_numbering_code = $2)', TG_TABLE_NAME)
            INTO occupied USING NEW.company_id, candidate;
          EXIT WHEN NOT occupied;
        END LOOP;
        NEW.policy_numbering_code := candidate;
        RETURN NEW;
      END $$;
    `);
    for (const table of [
      'branches',
      'insurance_products',
      'insurance_categories',
    ]) {
      await runner.query(`
        ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS policy_numbering_code varchar(12);
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_${table}_policy_numbering_code
          ON ${table}(company_id, policy_numbering_code);
        DROP TRIGGER IF EXISTS assign_policy_numbering_code ON ${table};
        CREATE TRIGGER assign_policy_numbering_code BEFORE INSERT OR UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION assign_policy_numbering_code();
        -- Process numeric identities first, so automatic allocation does not consume reusable codes.
        DO $$ DECLARE item record; BEGIN
          FOR item IN SELECT id FROM ${table} WHERE policy_numbering_code IS NULL
            ORDER BY CASE WHEN ${table === 'insurance_products' ? 'product_code' : 'code'} ~ '^[0-9]{1,12}$' THEN 0 ELSE 1 END, created_at, id
          LOOP UPDATE ${table} SET policy_numbering_code = NULL WHERE id = item.id; END LOOP;
        END $$;
        ALTER TABLE ${table} ALTER COLUMN policy_numbering_code SET NOT NULL;
      `);
      // Existing CHECKs are retained on a rerun.
      await runner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_${table}_policy_numbering_code') THEN
          ALTER TABLE ${table} ADD CONSTRAINT "CK_${table}_policy_numbering_code"
            CHECK (policy_numbering_code ~ '^[0-9]{1,12}$');
        END IF;
      END $$;`);
    }
    await runner.query(`
      CREATE OR REPLACE FUNCTION protect_issued_policy_number() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.policy_no IS DISTINCT FROM OLD.policy_no OR NEW.policy_sequence IS DISTINCT FROM OLD.policy_sequence
          OR NEW.insurer_company_id IS DISTINCT FROM OLD.insurer_company_id
          OR (OLD.policy_sequence IS NOT NULL AND (NEW.issue_date IS DISTINCT FROM OLD.issue_date
            OR NEW.metadata->'policyNumbering' IS DISTINCT FROM OLD.metadata->'policyNumbering')) THEN
          RAISE EXCEPTION 'Issued policy numbering is immutable' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS protect_issued_policy_number ON policies;
      CREATE TRIGGER protect_issued_policy_number BEFORE UPDATE ON policies
        FOR EACH ROW EXECUTE FUNCTION protect_issued_policy_number();
    `);
  }

  async down(): Promise<void> {
    // Deliberately retain identifiers, constraints and sequence high-water marks.
    // Recovery rolls application code forward; reverting must never enable number reuse.
  }
}
