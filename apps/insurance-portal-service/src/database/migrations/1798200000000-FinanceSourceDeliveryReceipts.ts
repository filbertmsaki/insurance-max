import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Verified Finance receipts are append-only evidence; no source or posting state is activated. */
export class FinanceSourceDeliveryReceipts1798200000000 implements MigrationInterface {
  name = 'FinanceSourceDeliveryReceipts1798200000000';
  async up(q: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(q);
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_source_outbox_company_id" ON finance_source_attestation_outbox(tenant_id,source_company_id,id)',
    );
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_source_outbox_full_scope" ON finance_source_attestation_outbox(tenant_id,legal_entity_id,book_id,source_company_id,id)',
    );
    await q.query(`CREATE TABLE finance_source_delivery_authorities (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,source_company_id uuid NOT NULL,worker_subject_id uuid NOT NULL,
      state varchar(10) NOT NULL CHECK(state IN ('DRAFT','ENABLED','REVOKED')),authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),
      valid_from timestamptz NOT NULL,valid_to timestamptz NOT NULL,revoked_at timestamptz,CHECK(valid_to>valid_from),
      UNIQUE(tenant_id,legal_entity_id,book_id,source_company_id,id,worker_subject_id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id)
    )`);
    await q.query(
      `CREATE UNIQUE INDEX "UQ_fin_source_delivery_worker" ON finance_source_delivery_authorities(tenant_id,legal_entity_id,book_id,source_company_id,worker_subject_id) WHERE state='ENABLED' AND revoked_at IS NULL`,
    );
    await q.query(`CREATE TABLE finance_source_delivery_receipts (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(), outbox_id uuid NOT NULL UNIQUE REFERENCES finance_source_attestation_outbox(id),
      receipt_id uuid NOT NULL, tenant_id uuid NOT NULL, source_company_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
      source_hash varchar(64) NOT NULL CHECK(source_hash ~ '^[0-9a-f]{64}$'), receipt_body bytea NOT NULL,
      receipt_hash varchar(64) NOT NULL CHECK(receipt_hash ~ '^[0-9a-f]{64}$'), signature_base64 text NOT NULL,
      issuer_fingerprint varchar(64) NOT NULL CHECK(issuer_fingerprint ~ '^[0-9a-f]{64}$'), received_at timestamptz NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,source_company_id,outbox_id) REFERENCES finance_source_attestation_outbox(tenant_id,source_company_id,id)
    )`);
    await q.query(
      `CREATE TRIGGER fin_source_delivery_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_source_delivery_receipts FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_source_outbox_immutable()`,
    );
    await q.query(`CREATE TABLE finance_source_delivery_attempts (
      id uuid PRIMARY KEY DEFAULT public.finance_uuid_v4(),tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL,source_company_id uuid NOT NULL,outbox_id uuid NOT NULL,
      authority_id uuid NOT NULL,worker_subject_id uuid NOT NULL,action varchar(16) NOT NULL CHECK(action IN ('ACKNOWLEDGED','HELD')),
      reason_code varchar(40) NOT NULL,occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,source_company_id,authority_id,worker_subject_id) REFERENCES finance_source_delivery_authorities(tenant_id,legal_entity_id,book_id,source_company_id,id,worker_subject_id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,source_company_id,outbox_id) REFERENCES finance_source_attestation_outbox(tenant_id,legal_entity_id,book_id,source_company_id,id)
    )`);
    await q.query(
      `CREATE TRIGGER fin_source_delivery_attempt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_source_delivery_attempts FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_source_outbox_immutable()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query(
      'SELECT (SELECT count(*) FROM finance_source_delivery_receipts)::integer AS receipts,(SELECT count(*) FROM finance_source_delivery_attempts)::integer AS attempts,(SELECT count(*) FROM finance_source_delivery_authorities)::integer AS authorities',
    );
    if (row.receipts || row.attempts || row.authorities)
      throw new Error(
        'Source delivery rollback requires empty authority and receipt evidence.',
      );
    await q.query('DROP TABLE finance_source_delivery_attempts');
    await q.query('DROP TABLE finance_source_delivery_receipts');
    await q.query('DROP TABLE finance_source_delivery_authorities');
    await q.query('DROP INDEX "UQ_fin_source_outbox_full_scope"');
    await q.query('DROP INDEX "UQ_fin_source_outbox_company_id"');
  }
}
