import { ensureFinanceUuidV4 } from '../../../insurance-portal-service/src/database/finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Empty source-key and append-only attestation registries; grants no authority. */
export class FinanceSourceAttestations1798000000000 implements MigrationInterface {
  name = 'FinanceSourceAttestations1798000000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(`CREATE TABLE finance_source_attestation_keys (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL, source_company_id uuid NOT NULL,
      producer_id text NOT NULL CHECK(btrim(producer_id)<>''), public_key_pem text NOT NULL,
      key_fingerprint varchar(64) NOT NULL CHECK(key_fingerprint ~ '^[0-9a-f]{64}$'),
      state varchar(10) NOT NULL CHECK(state IN ('DRAFT','ENABLED','REVOKED')),
      valid_from timestamptz NOT NULL, valid_to timestamptz NOT NULL, revoked_at timestamptz,
      CHECK(valid_to > valid_from), UNIQUE(tenant_id,source_company_id,id)
    )`);
    await q.query(`CREATE TABLE finance_source_attestations (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, source_company_id uuid NOT NULL,
      key_id uuid NOT NULL, revision integer NOT NULL CHECK(revision > 0),
      issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK(expires_at > issued_at),
      raw_body bytea NOT NULL, raw_hash varchar(64) NOT NULL CHECK(raw_hash ~ '^[0-9a-f]{64}$'),
      signature_base64 text NOT NULL, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
      received_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,source_company_id,revision),
      FOREIGN KEY(tenant_id,source_company_id,key_id) REFERENCES finance_source_attestation_keys(tenant_id,source_company_id,id)
    )`);
    await q.query(
      `CREATE FUNCTION fn_fin_source_attestation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Source attestations are append only'; END $$`,
    );
    await q.query(
      `CREATE TRIGGER fin_source_attestation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_source_attestations FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_source_attestation_immutable()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query(
      'SELECT (SELECT count(*) FROM finance_source_attestations)::integer AS snapshots,(SELECT count(*) FROM finance_source_attestation_keys)::integer AS keys',
    );
    if (row.snapshots || row.keys)
      throw new Error(
        'Source attestation rollback requires empty evidence and key registries.',
      );
    await q.query('DROP TABLE finance_source_attestations');
    await q.query('DROP TABLE finance_source_attestation_keys');
    await q.query('DROP FUNCTION fn_fin_source_attestation_immutable()');
  }
}
