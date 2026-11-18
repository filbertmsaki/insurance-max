import 'reflect-metadata';

import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { FinanceScopeFoundations1796000000000 } from '../../src/database/migrations/1796000000000-FinanceScopeFoundations';
import { FinanceConfigurationReviews1796100000000 } from '../../src/database/migrations/1796100000000-FinanceConfigurationReviews';
import { FinanceChartSourceAuthorities1796200000000 } from '../../src/database/migrations/1796200000000-FinanceChartSourceAuthorities';
import { FinanceJournalCandidates1796300000000 } from '../../src/database/migrations/1796300000000-FinanceJournalCandidates';
import { FinanceApprovalGovernance1796400000000 } from '../../src/database/migrations/1796400000000-FinanceApprovalGovernance';
import { FinanceEventContractPreviews1796500000000 } from '../../src/database/migrations/1796500000000-FinanceEventContractPreviews';
import { FinanceIntegrationReliability1796600000000 } from '../../src/database/migrations/1796600000000-FinanceIntegrationReliability';
import { FinanceOwnedExceptions1796700000000 } from '../../src/database/migrations/1796700000000-FinanceOwnedExceptions';
import { FinanceQuotationMemoranda1796800000000 } from '../../src/database/migrations/1796800000000-FinanceQuotationMemoranda';
import { FinanceChartSourceAuthority } from '../../src/modules/tenant/finance/foundation/entities/finance-chart-source-authority.entity';
import { FinanceConfigurationAuthority } from '../../src/modules/tenant/finance/foundation/entities/finance-configuration-authority.entity';
import { FinanceConfigurationRelease } from '../../src/modules/tenant/finance/foundation/entities/finance-configuration-release.entity';
import { FinanceConfigurationEvent } from '../../src/modules/tenant/finance/foundation/entities/finance-configuration-event.entity';
import { FinanceLegalEntity } from '../../src/modules/tenant/finance/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/finance/foundation/entities/finance-accounting-book.entity';
import { FinanceScopeMembership } from '../../src/modules/tenant/finance/foundation/entities/finance-scope-membership.entity';
import { FinanceLegalEntitySourceMap } from '../../src/modules/tenant/finance/foundation/entities/finance-legal-entity-source-map.entity';

import { FinanceAccount } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/entities/finance-account.entity';
import { FinanceJournalEntry } from '../../src/modules/tenant/finance/accounting/journal-entries/entities/finance-journal-entry.entity';
import { FinanceJournalLine } from '../../src/modules/tenant/finance/accounting/journal-entries/entities/finance-journal-line.entity';
import {
  assertSafeTestDatabase,
  createTestDatabase,
  dropTestDatabase,
  newTestRunId,
  templateDatabaseName,
} from './test-database';

export interface FinanceTestServer {
  host: string;
  port: number;
  user: string;
  password: string;
}

/** No .env loading, shared DB_* fallback, app bootstrap or remote destinations. */
export function readFinanceTestServer(
  env: NodeJS.ProcessEnv = process.env,
): FinanceTestServer {
  const missing = [
    'FINANCE_TEST_PG_HOST',
    'FINANCE_TEST_PG_PORT',
    'FINANCE_TEST_PG_USER',
    'FINANCE_TEST_PG_PASSWORD',
  ].filter((key) => !env[key]?.trim());
  if (
    env.FINANCE_TEST_PG_ENABLED !== '1' ||
    env.NODE_ENV !== 'test' ||
    env.APP_ENV !== 'test' ||
    missing.length
  ) {
    throw new Error(
      'Finance integration tests require explicit test mode, ' +
        'FINANCE_TEST_PG_ENABLED=1 and all FINANCE_TEST_PG connection fields. ' +
        'Use the isolated PostgreSQL runner. No DB_* or PG* fallback is used.',
    );
  }
  const host = env.FINANCE_TEST_PG_HOST!;
  const portText = env.FINANCE_TEST_PG_PORT!;
  const port = Number(portText);
  if (
    !['127.0.0.1', '::1'].includes(host) ||
    !/^\d+$/.test(portText) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'Finance tests require a literal loopback address and a valid explicit port.',
    );
  }
  return {
    host,
    port,
    user: env.FINANCE_TEST_PG_USER!,
    password: env.FINANCE_TEST_PG_PASSWORD!,
  };
}

export interface FinanceTestDatabase {
  dataSource: DataSource;
  database: string;
}

/**
 * Owns exactly one fresh database. The default synchronizes the three legacy
 * journal entities. Scope-foundation mode instead runs only its explicit new
 * migration. Neither mode runs full application migrations or seeders.
 */
export async function withFinanceTestDatabase<T>(
  work: (fixture: FinanceTestDatabase) => Promise<T>,
  env: NodeJS.ProcessEnv = process.env,
  schema:
    | 'legacy-journal'
    | 'scope-foundations'
    | 'configuration-reviews'
    | 'journal-candidates'
    | 'event-contracts'
    | 'integration-reliability'
    | 'quotation-billing'
    | 'chart-governance' = 'legacy-journal',
): Promise<T> {
  const server = readFinanceTestServer(env);
  const database = templateDatabaseName(newTestRunId());
  assertSafeTestDatabase({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DB_TYPE: 'postgres',
    DB_HOST: server.host,
    DB_DATABASE: database,
    DB_NAME: database,
  });
  const admin = new Client({
    ...server,
    database: 'postgres',
    ssl: false,
    connectionTimeoutMillis: 5000,
    application_name: 'insurance-finance-test-provisioner',
  });
  let created = false;
  let dataSource: DataSource | undefined;
  let result!: T;
  const failures: unknown[] = [];
  try {
    await admin.connect();
    await createTestDatabase(admin, database);
    created = true;
    dataSource = new DataSource({
      type: 'postgres',
      host: server.host,
      port: server.port,
      username: server.user,
      password: server.password,
      database,
      ssl: false,
      entities:
        schema !== 'legacy-journal'
          ? [
              FinanceLegalEntity,
              FinanceAccountingBook,
              FinanceScopeMembership,
              FinanceLegalEntitySourceMap,
              ...(schema === 'configuration-reviews' ||
              schema === 'event-contracts' ||
              schema === 'integration-reliability' ||
              schema === 'quotation-billing' ||
              schema === 'journal-candidates' ||
              schema === 'chart-governance'
                ? [
                    FinanceConfigurationAuthority,
                    FinanceConfigurationRelease,
                    FinanceConfigurationEvent,
                  ]
                : []),
              ...(schema === 'chart-governance'
                ? [FinanceAccount, FinanceChartSourceAuthority]
                : []),
              ...(schema === 'event-contracts' ||
              schema === 'integration-reliability' ||
              schema === 'quotation-billing'
                ? [FinanceChartSourceAuthority]
                : []),
            ]
          : [FinanceAccount, FinanceJournalEntry, FinanceJournalLine],
      migrations:
        schema !== 'legacy-journal'
          ? [
              FinanceScopeFoundations1796000000000,
              ...(schema === 'configuration-reviews' ||
              schema === 'event-contracts' ||
              schema === 'integration-reliability' ||
              schema === 'quotation-billing' ||
              schema === 'journal-candidates' ||
              schema === 'chart-governance'
                ? [FinanceConfigurationReviews1796100000000]
                : []),
              ...(schema === 'chart-governance' ||
              schema === 'event-contracts' ||
              schema === 'integration-reliability' ||
              schema === 'quotation-billing'
                ? [FinanceChartSourceAuthorities1796200000000]
                : []),
              ...(schema === 'journal-candidates' ||
              schema === 'event-contracts' ||
              schema === 'integration-reliability' ||
              schema === 'quotation-billing'
                ? [
                    FinanceJournalCandidates1796300000000,
                    FinanceApprovalGovernance1796400000000,
                  ]
                : []),
              ...(schema === 'event-contracts' ||
              schema === 'integration-reliability' ||
              schema === 'quotation-billing'
                ? [FinanceEventContractPreviews1796500000000]
                : []),
              ...(schema === 'integration-reliability' ||
              schema === 'quotation-billing'
                ? [
                    FinanceIntegrationReliability1796600000000,
                    FinanceOwnedExceptions1796700000000,
                    ...(schema === 'quotation-billing'
                      ? [FinanceQuotationMemoranda1796800000000]
                      : []),
                  ]
                : []),
            ]
          : [],
      synchronize: false,
      migrationsRun: false,
      logging: false,
      installExtensions: false,
      uuidExtension: 'pgcrypto',
      connectTimeoutMS: 5000,
      extra: { max: 4, application_name: 'insurance-finance-integration-test' },
    });
    await dataSource.initialize();
    const [identity] = await dataSource.query(
      'SELECT current_database() AS database, current_user AS username',
    );
    if (identity.database !== database || identity.username !== server.user) {
      throw new Error(
        'Finance fixture connection identity differs from the owned test database.',
      );
    }
    if (schema !== 'legacy-journal') {
      await dataSource.runMigrations({ transaction: 'all' });
    } else {
      await dataSource.synchronize();
    }
    result = await work({ dataSource, database });
  } catch (error) {
    failures.push(error);
  } finally {
    if (dataSource?.isInitialized) {
      try {
        await dataSource.destroy();
      } catch (error) {
        failures.push(error);
      }
    }
    // Never drop a name after failed CREATE (including a name collision).
    if (created) {
      try {
        await dropTestDatabase(admin, database);
        const remaining = await admin.query(
          'SELECT datname FROM pg_database WHERE datname = $1',
          [database],
        );
        if (remaining.rows.length)
          failures.push(
            new Error('Finance test database cleanup did not complete.'),
          );
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      await admin.end();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      'Finance fixture operation or cleanup failed.',
    );
  return result;
}
