import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Signed inactive source evidence only; no outbound delivery or posting. */
export class FinanceSourceAttestationOutbox1798100000000 implements MigrationInterface {
  name = 'FinanceSourceAttestationOutbox1798100000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(`CREATE TABLE finance_source_attestation_outbox (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      source_company_id uuid NOT NULL, revision integer NOT NULL CHECK(revision > 0), key_id uuid NOT NULL, producer_id text NOT NULL,
      master_release_id uuid NOT NULL, master_release_hash varchar(64) NOT NULL CHECK(master_release_hash ~ '^[0-9a-f]{64}$'),
      actor_subject_id uuid NOT NULL, actor_natural_person_id uuid NOT NULL, authority_id uuid NOT NULL,
      issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK(expires_at > issued_at), raw_body bytea NOT NULL,
      raw_hash varchar(64) NOT NULL CHECK(raw_hash ~ '^[0-9a-f]{64}$'), signature_base64 text NOT NULL, reason text NOT NULL CHECK(btrim(reason) <> ''),
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(), UNIQUE(tenant_id,source_company_id,revision),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,master_release_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id,actor_subject_id,actor_natural_person_id) REFERENCES finance_configuration_authorities(tenant_id,legal_entity_id,book_id,id,subject_id,natural_person_id)
    )`);
    await q.query(
      `CREATE FUNCTION fn_fin_source_outbox_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Source attestation outbox is append only'; END $$`,
    );
    await q.query(
      `CREATE TRIGGER fin_source_outbox_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_source_attestation_outbox FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_source_outbox_immutable()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query(
      'SELECT count(*)::integer AS count FROM finance_source_attestation_outbox',
    );
    if (row.count)
      throw new Error(
        'Source attestation rollback requires empty outbox evidence.',
      );
    await q.query('DROP TABLE finance_source_attestation_outbox');
    await q.query('DROP FUNCTION fn_fin_source_outbox_immutable()');
  }
}
