import { MigrationInterface, QueryRunner } from 'typeorm';
/** One catalogue metadata column; invoice headers/items already have all required storage. */
export class TaxCalculationEvidence1796900000000 implements MigrationInterface {
  name = 'TaxCalculationEvidence1796900000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE taxes ADD COLUMN calculation_options jsonb NULL CHECK(calculation_options IS NULL OR jsonb_typeof(calculation_options)='object')",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const [r] = await q.query(
      'SELECT EXISTS(SELECT 1 FROM taxes WHERE calculation_options IS NOT NULL) AS used',
    );
    if (r.used)
      throw new Error(
        'Tax calculation evidence rollback requires unused metadata.',
      );
    await q.query('ALTER TABLE taxes DROP COLUMN calculation_options');
  }
}
