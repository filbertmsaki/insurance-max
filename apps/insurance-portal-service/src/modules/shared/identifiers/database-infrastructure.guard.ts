import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Fails application startup loudly if raw-SQL-only database objects that
 * have no TypeORM entity — and are therefore invisible to
 * `migration:generate` — are ever missing. Without this, a dropped sequence
 * or table surfaces only when a user hits the code path that needs it (see
 * IdentifierGeneratorService), as an opaque 500.
 *
 * Add an entry here for any future raw sequence/function/trigger with no
 * entity representation. See CoreInfrastructureSequences migration for the
 * matching creation-side convention.
 */
@Injectable()
export class DatabaseInfrastructureGuard implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseInfrastructureGuard.name);

  private static readonly REQUIRED_RELATIONS = ['pricing_quote_identifier_seq'];

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const missing: string[] = [];

    for (const relation of DatabaseInfrastructureGuard.REQUIRED_RELATIONS) {
      const rows: Array<{ exists: boolean }> = await this.dataSource.query(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [relation],
      );

      if (!rows[0]?.exists) {
        missing.push(relation);
      }
    }

    if (missing.length > 0) {
      const message =
        `Required database objects are missing: ${missing.join(', ')}. ` +
        'These have no TypeORM entity and are only created by ' +
        'CoreInfrastructureSequences migration — run pending migrations, ' +
        'or check that migration was not dropped by a baseline regeneration.';

      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.log('Database infrastructure guard: all objects present.');
  }
}
