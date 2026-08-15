import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ============================================================================
 * DO NOT DELETE OR FOLD THIS FILE INTO A REGENERATED BASELINE MIGRATION.
 * ============================================================================
 *
 * This migration hand-maintains raw Postgres objects that have NO TypeORM
 * entity representation (bare sequences aren't modeled by TypeORM). Because
 * `typeorm migration:generate` diffs the database against registered
 * `@Entity` classes only, anything created here is INVISIBLE to it — running
 * `migration:generate` to produce a fresh consolidated baseline will not
 * recreate this file's contents, and a squash that discards this file
 * silently loses the objects it creates.
 *
 * If you ever regenerate/squash migrations into a new baseline:
 *   1. Keep this file as its own separate migration, untouched.
 *   2. Give it a timestamp greater than the new baseline's, so it still
 *      runs after the tables it may reference (currently none, but keep
 *      this convention for anything added below).
 *   3. Add a boot-time guard entry (see DatabaseInfrastructureGuard in
 *      modules/shared/identifiers/) for any new object added here, so a
 *      future accidental drop fails loudly at startup instead of
 *      surfacing as a customer-facing 500.
 *
 * Currently backs: IdentifierGeneratorService.generatePricingQuoteId()
 * (modules/shared/identifiers/identifier-generator.service.ts).
 */
export class CoreInfrastructureSequences1786736437723
  implements MigrationInterface
{
  name = 'CoreInfrastructureSequences1786736437723';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS "pricing_quote_identifier_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`
      DROP SEQUENCE IF EXISTS "pricing_quote_identifier_seq"
    `);
  }
}
