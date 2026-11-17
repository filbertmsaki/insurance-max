import { MigrationInterface, QueryRunner } from 'typeorm';

/** Independent human review of inactive worker previews. */
export class FinanceAllocationPreviewReviews1797900000000 implements MigrationInterface {
  name = 'FinanceAllocationPreviewReviews1797900000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE UNIQUE INDEX "UQ_fin_config_authority_reviewer_scope" ON finance_configuration_authorities(tenant_id,legal_entity_id,book_id,id,subject_id,natural_person_id)',
    );
    await q.query(`CREATE TABLE finance_allocation_preview_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL,
      occurrence_id uuid NOT NULL, occurrence_hash varchar(64) NOT NULL CHECK(occurrence_hash ~ '^[0-9a-f]{64}$'),
      reviewer_subject_id uuid NOT NULL, reviewer_natural_person_id uuid NOT NULL, authority_id uuid NOT NULL,
      reason text NOT NULL CHECK(btrim(reason) <> ''), reviewed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(tenant_id,legal_entity_id,book_id,occurrence_id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,occurrence_id) REFERENCES finance_allocation_preview_occurrences(tenant_id,legal_entity_id,book_id,id),
      FOREIGN KEY(tenant_id,legal_entity_id,book_id,authority_id,reviewer_subject_id,reviewer_natural_person_id) REFERENCES finance_configuration_authorities(tenant_id,legal_entity_id,book_id,id,subject_id,natural_person_id)
    )`);
    await q.query(
      `CREATE TRIGGER fin_allocation_review_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_allocation_preview_reviews FOR EACH STATEMENT EXECUTE FUNCTION fn_fin_allocation_occurrence_immutable()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query(
      'SELECT count(*)::integer AS count FROM finance_allocation_preview_reviews',
    );
    if (row.count)
      throw new Error(
        'Allocation review rollback requires empty review evidence.',
      );
    await q.query('DROP TABLE finance_allocation_preview_reviews');
    await q.query('DROP INDEX "UQ_fin_config_authority_reviewer_scope"');
  }
}
