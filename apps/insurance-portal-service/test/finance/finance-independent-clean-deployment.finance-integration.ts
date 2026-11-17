import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../finance-service/src/app.module';
import { financeDatabaseOptions } from '../../../finance-service/src/database/options';
import { withFinanceTestDatabase } from '../support/finance-test-database';

describe('isolated Finance deployment', () => {
  it('upgrades the previous independent migration set without granting authority', async () => {
    await withFinanceTestDatabase(
      async ({ dataSource: fixture, database }) => {
        const user = encodeURIComponent(process.env.FINANCE_TEST_PG_USER!);
        const password = encodeURIComponent(
          process.env.FINANCE_TEST_PG_PASSWORD!,
        );
        const url = `postgres://${user}:${password}@127.0.0.1:${process.env.FINANCE_TEST_PG_PORT}/${database}`;
        const options = financeDatabaseOptions({ FINANCE_DATABASE_URL: url });
        const previous = new Set([
          'FinanceScopeFoundations1796000000000',
          'FinanceConfigurationReviews1796100000000',
          'FinanceRecurringAllocationPreviews1797800000000',
          'FinanceAllocationPreviewReviews1797900000000',
          'FinanceSourceAttestations1798000000000',
          'FinanceSourceKeyChanges1798100000000',
        ]);
        const oldDb = new DataSource({
          ...options,
          migrations: (options.migrations as any[]).filter((migration) =>
            previous.has(migration.name),
          ),
        });
        await oldDb.initialize();
        try {
          await oldDb.runMigrations({ transaction: 'all' });
        } finally {
          await oldDb.destroy();
        }
        const upgraded = new DataSource(options);
        await upgraded.initialize();
        try {
          const installed = await upgraded.runMigrations({
            transaction: 'all',
          });
          expect(installed).toHaveLength(8);
          const [counts] = await upgraded.query(
            'SELECT (SELECT count(*)::integer FROM finance_foundation_authorities) AS authorities, (SELECT count(*)::integer FROM finance_foundation_journals) AS journals',
          );
          expect(counts).toEqual({ authorities: 0, journals: 0 });
          expect(
            await upgraded.runMigrations({ transaction: 'all' }),
          ).toHaveLength(0);
        } finally {
          await upgraded.destroy();
        }
      },
      process.env,
      'scope-foundations',
    );
  });
  it('applies the complete migration set to a clean independent database and keeps posting disabled', async () => {
    await withFinanceTestDatabase(async ({ dataSource: portal }) => {
      const database = `fin_clean_${randomUUID().replace(/-/g, '')}`;
      await portal.query(`CREATE DATABASE "${database}"`);
      const user = encodeURIComponent(process.env.FINANCE_TEST_PG_USER!);
      const password = encodeURIComponent(
        process.env.FINANCE_TEST_PG_PASSWORD!,
      );
      const url = `postgres://${user}:${password}@127.0.0.1:${process.env.FINANCE_TEST_PG_PORT}/${database}`;
      const finance = new DataSource(
        financeDatabaseOptions({ FINANCE_DATABASE_URL: url }),
      );
      const previous = process.env.FINANCE_DATABASE_URL;
      try {
        await finance.initialize();
        const migrations = await finance.runMigrations({ transaction: 'all' });
        expect(migrations.map((migration) => migration.name)).toEqual([
          'FinanceScopeFoundations1796000000000',
          'FinanceConfigurationReviews1796100000000',
          'FinanceChartSourceAuthorities1796200000000',
          'FinanceJournalCandidates1796300000000',
          'FinanceApprovalGovernance1796400000000',
          'FinanceEventContractPreviews1796500000000',
          'FinanceIntegrationReliability1796600000000',
          'FinanceOwnedExceptions1796700000000',
          'FinancePolicyGovernance1797100000000',
          'FinanceLedgerFoundation1797200000000',
          'FinanceRecurringAllocationPreviews1797800000000',
          'FinanceAllocationPreviewReviews1797900000000',
          'FinanceSourceAttestations1798000000000',
          'FinanceSourceKeyChanges1798100000000',
        ]);
        expect(
          await finance.runMigrations({ transaction: 'all' }),
        ).toHaveLength(0);
        process.env.FINANCE_DATABASE_URL = url;
        const app = await NestFactory.create(AppModule, { logger: false });
        try {
          await app.init();
          expect(
            (await request(app.getHttpServer()).get('/health').expect(200))
              .body,
          ).toMatchObject({
            postingEnabled: false,
            allocationExecutionEnabled: false,
          });
        } finally {
          await app.close();
        }
      } finally {
        if (previous === undefined) delete process.env.FINANCE_DATABASE_URL;
        else process.env.FINANCE_DATABASE_URL = previous;
        if (finance.isInitialized) await finance.destroy();
      }
    });
  });
});
