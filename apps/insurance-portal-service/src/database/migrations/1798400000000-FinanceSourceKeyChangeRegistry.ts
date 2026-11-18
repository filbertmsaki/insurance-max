import { MigrationInterface, QueryRunner } from 'typeorm';

/** Consolidated from the standalone Finance database (was FinanceSourceKeyChanges1798100000000, which collided with FinanceSourceAttestationOutbox1798100000000). Append-only signed provisioning decisions; no bootstrap key or grants are seeded. */
export class FinanceSourceKeyChangeRegistry1798400000000 implements MigrationInterface {
  name = 'FinanceSourceKeyChangeRegistry1798400000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE finance_source_key_changes (
      change_id uuid PRIMARY KEY, tenant_id uuid NOT NULL, source_company_id uuid NOT NULL, source_key_id uuid NOT NULL,
      action varchar(8) NOT NULL CHECK(action IN ('GRANT','REVOKE')), issuer_fingerprint varchar(64) NOT NULL CHECK(issuer_fingerprint ~ '^[0-9a-f]{64}$'),
      raw_body bytea NOT NULL, raw_hash varchar(64) NOT NULL CHECK(raw_hash ~ '^[0-9a-f]{64}$'), signature_base64 text NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,source_company_id,source_key_id) REFERENCES finance_source_attestation_keys(tenant_id,source_company_id,id)
    )`);
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_source_key_action" ON finance_source_key_changes(source_key_id,action)',
    );
    await q.query(
      `CREATE TRIGGER fin_source_key_changes_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_source_key_changes FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_source_attestation_immutable()`,
    );
    await q.query(`CREATE FUNCTION fn_fin_source_key_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='DELETE' OR TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'Source keys cannot be deleted'; END IF;
      IF TG_OP='INSERT' THEN IF NEW.state<>'ENABLED' OR NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Source keys must be granted enabled'; END IF; RETURN NEW; END IF;
      IF OLD.state<>'ENABLED' OR NEW.state<>'REVOKED' OR NEW.revoked_at IS NULL OR (to_jsonb(OLD)-ARRAY['state','revoked_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','revoked_at']) THEN RAISE EXCEPTION 'Source key changes require an exact revocation'; END IF;
      RETURN NEW;
    END $$`);
    await q.query(
      `CREATE TRIGGER fin_source_key_guard BEFORE INSERT OR UPDATE OR DELETE ON finance_source_attestation_keys FOR EACH ROW EXECUTE FUNCTION fn_fin_source_key_guard()`,
    );
    await q.query(
      `CREATE TRIGGER fin_source_key_no_truncate BEFORE TRUNCATE ON finance_source_attestation_keys FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_source_key_guard()`,
    );
    await q.query(`CREATE FUNCTION fn_fin_source_key_audit_required() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE expected_action text; BEGIN
      expected_action := CASE WHEN TG_OP='INSERT' THEN 'GRANT' ELSE 'REVOKE' END;
      IF NOT EXISTS(SELECT 1 FROM finance_source_key_changes e WHERE e.tenant_id=NEW.tenant_id AND e.source_company_id=NEW.source_company_id AND e.source_key_id=NEW.id AND e.action=expected_action) THEN RAISE EXCEPTION 'Source key change requires signed audit evidence'; END IF;
      RETURN NULL;
    END $$`);
    await q.query(
      `CREATE CONSTRAINT TRIGGER fin_source_key_audit_required AFTER INSERT OR UPDATE ON finance_source_attestation_keys DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_fin_source_key_audit_required()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query(
      'SELECT count(*)::integer AS count FROM finance_source_key_changes',
    );
    if (row.count)
      throw new Error('Source-key rollback requires empty change history.');
    await q.query(
      'DROP TRIGGER fin_source_key_audit_required ON finance_source_attestation_keys',
    );
    await q.query(
      'DROP TRIGGER fin_source_key_no_truncate ON finance_source_attestation_keys',
    );
    await q.query(
      'DROP TRIGGER fin_source_key_guard ON finance_source_attestation_keys',
    );
    await q.query('DROP FUNCTION fn_fin_source_key_audit_required()');
    await q.query('DROP FUNCTION fn_fin_source_key_guard()');
    await q.query('DROP TABLE finance_source_key_changes');
  }
}
