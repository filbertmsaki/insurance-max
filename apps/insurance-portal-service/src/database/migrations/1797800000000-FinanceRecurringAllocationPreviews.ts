import { MigrationInterface, QueryRunner } from 'typeorm';

/** Worker-owned inactive previews only; this migration grants no authority and enables no posting. */
export class FinanceRecurringAllocationPreviews1797800000000 implements MigrationInterface {
  name = 'FinanceRecurringAllocationPreviews1797800000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE finance_allocation_worker_authorities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      worker_subject_id uuid NOT NULL, schedule_release_id uuid NOT NULL, schedule_release_hash varchar(64) NOT NULL CHECK(schedule_release_hash ~ '^[0-9a-f]{64}$'),
      state varchar(10) NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')), authority_reference text NOT NULL CHECK(btrim(authority_reference) <> ''),
      valid_from timestamptz NOT NULL, valid_to timestamptz, revoked_at timestamptz,
      CHECK(valid_to IS NULL OR valid_to > valid_from), UNIQUE(tenant_id,legal_entity_id,book_id,id), UNIQUE(tenant_id,legal_entity_id,book_id,id,worker_subject_id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,schedule_release_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id)
    )`);
    await q.query(
      `CREATE UNIQUE INDEX "UQ_fin_allocation_worker_grant" ON finance_allocation_worker_authorities(tenant_id,legal_entity_id,book_id,worker_subject_id,schedule_release_id) WHERE state='ENABLED' AND revoked_at IS NULL`,
    );
    await q.query(`CREATE TABLE finance_allocation_preview_occurrences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      schedule_release_id uuid NOT NULL, schedule_release_hash varchar(64) NOT NULL, rule_release_id uuid NOT NULL, rule_release_hash varchar(64) NOT NULL,
      occurrence_date date NOT NULL, worker_subject_id uuid NOT NULL, authority_id uuid NOT NULL,
      payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), subject_hash varchar(64) NOT NULL CHECK(subject_hash ~ '^[0-9a-f]{64}$'),
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,legal_entity_id,book_id,schedule_release_id,occurrence_date), UNIQUE(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id,worker_subject_id) REFERENCES finance_allocation_worker_authorities(tenant_id,legal_entity_id,book_id,id,worker_subject_id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,schedule_release_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,rule_release_id) REFERENCES finance_configuration_releases(tenant_id,legal_entity_id,book_id,id)
    )`);
    await q.query(
      `CREATE FUNCTION fn_fin_allocation_occurrence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Allocation occurrence evidence is append only'; END $$`,
    );
    await q.query(
      `CREATE TRIGGER fin_allocation_occurrence_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_allocation_preview_occurrences FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_allocation_occurrence_immutable()`,
    );
    await q.query(`CREATE TABLE finance_allocation_worker_audits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      authority_id uuid NOT NULL, worker_subject_id uuid NOT NULL, occurrence_id uuid,
      action varchar(10) NOT NULL CHECK(action IN ('CREATED','HELD')), reason_code varchar(40) NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      CHECK((action='CREATED' AND occurrence_id IS NOT NULL) OR (action='HELD' AND occurrence_id IS NULL)),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id,worker_subject_id) REFERENCES finance_allocation_worker_authorities(tenant_id,legal_entity_id,book_id,id,worker_subject_id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,occurrence_id) REFERENCES finance_allocation_preview_occurrences(tenant_id,legal_entity_id,book_id,id)
    )`);
    await q.query(
      `CREATE TRIGGER fin_allocation_worker_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_allocation_worker_audits FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_allocation_occurrence_immutable()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query(
      'SELECT (SELECT count(*) FROM finance_allocation_worker_audits)::integer AS audits, (SELECT count(*) FROM finance_allocation_preview_occurrences)::integer AS occurrences, (SELECT count(*) FROM finance_allocation_worker_authorities)::integer AS authorities',
    );
    if (row.audits || row.occurrences || row.authorities)
      throw new Error(
        'Recurring allocation rollback requires empty authority and occurrence tables.',
      );
    await q.query('DROP TABLE finance_allocation_worker_audits');
    await q.query('DROP TABLE finance_allocation_preview_occurrences');
    await q.query('DROP TABLE finance_allocation_worker_authorities');
    await q.query('DROP FUNCTION fn_fin_allocation_occurrence_immutable()');
  }
}
