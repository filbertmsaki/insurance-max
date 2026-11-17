import { MigrationInterface, QueryRunner } from 'typeorm';

/** Block new contradictory scope dimensions while preserving historical rows for audit. */
export class FinanceDimensionScopeFences1797700000000 implements MigrationInterface {
  name = 'FinanceDimensionScopeFences1797700000000';

  async up(q: QueryRunner): Promise<void> {
    for (const [table, constraint] of [
      ['finance_journal_candidate_lines', 'CK_fin_candidate_dimension_scope'],
      ['finance_foundation_lines', 'CK_fin_ledger_dimension_scope'],
    ]) {
      await q.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" CHECK (
        (NOT (dimensions ? 'TENANT') OR COALESCE(lower(dimensions->>'TENANT'),'') = tenant_id::text) AND
        (NOT (dimensions ? 'LEGAL_ENTITY') OR COALESCE(lower(dimensions->>'LEGAL_ENTITY'),'') = legal_entity_id::text) AND
        (NOT (dimensions ? 'BOOK') OR COALESCE(lower(dimensions->>'BOOK'),'') = book_id::text)
      ) NOT VALID`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE "finance_foundation_lines" DROP CONSTRAINT "CK_fin_ledger_dimension_scope"',
    );
    await q.query(
      'ALTER TABLE "finance_journal_candidate_lines" DROP CONSTRAINT "CK_fin_candidate_dimension_scope"',
    );
  }
}
