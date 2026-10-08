import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { PlatformIntelligenceService } from '../../src/modules/platform/intelligence/services/platform-intelligence.service';
import { AnalyticsService } from '../../src/modules/tenant/analytics/services/analytics.service';

jest.setTimeout(180_000);

/**
 * The analytics tables were missing for months while every query returned
 * empty data. These tests run the real SQL against the migrated schema so a
 * missing table, column or bad enum value fails loudly.
 */
describe('Platform intelligence (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let intelligence: PlatformIntelligenceService;
  let analytics: AnalyticsService;

  const metricCode = `e2e.intelligence.${randomUUID().slice(0, 8)}`;
  const companyIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    intelligence = app.get(PlatformIntelligenceService);
    analytics = app.get(AnalyticsService);

    // A cohort of three companies is the minimum that gets published.
    for (let index = 0; index < 3; index += 1) {
      const suffix = randomUUID().slice(0, 8);
      const [company] = await dataSource.query(
        `INSERT INTO companies (name, slug, company_type, status)
         VALUES ($1, $2, 'BROKER', 'active') RETURNING id`,
        [`Intelligence E2E ${suffix}`, `intelligence-e2e-${suffix}`],
      );
      companyIds.push(company.id);

      await dataSource.query(
        `INSERT INTO platform_usage_snapshots
           (company_id, metric_code, period_start, period_end, quantity)
         VALUES ($1, $2, '2026-01-01', '2026-01-31', $3)`,
        [company.id, metricCode, (index + 1) * 10],
      );
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('has every analytics table the services query', async () => {
    const tables = [
      'analytics_dirty_periods',
      'analytics_policy_facts',
      'analytics_premium_facts',
      'analytics_claim_facts',
      'analytics_reinsurance_facts',
      'analytics_tiramis_facts',
      'analytics_daily_metrics',
      'analytics_kpi_definitions',
      'analytics_scorecard_templates',
      'analytics_scorecard_template_items',
      'analytics_scorecard_snapshots',
      'analytics_scorecard_values',
      'analytics_anomaly_rules',
      'analytics_anomaly_findings',
      'analytics_forecast_definitions',
      'analytics_forecast_runs',
      'analytics_forecast_points',
      'platform_benchmark_snapshots',
    ];
    const rows = await dataSource.query(
      `SELECT t FROM unnest($1::text[]) t WHERE to_regclass(t) IS NULL`,
      [tables],
    );

    expect(rows).toEqual([]);
  });

  it('rebuilds benchmarks from usage and billing data and publishes the cohort', async () => {
    const result = await intelligence.rebuildBenchmarkSnapshots();

    expect(result.usageSnapshotCount).toBeGreaterThanOrEqual(1);

    const [snapshot] = await intelligence.listBenchmarkSnapshots({
      metricCode,
    });
    expect(snapshot).toMatchObject({
      metric_code: metricCode,
      cohort_key: 'saas_usage:default',
      company_count: 3,
      status: 'PUBLISHED',
    });
    expect(Number(snapshot.median_value)).toBe(20);
  });

  it('runs the rebuild again without duplicating snapshots', async () => {
    await intelligence.rebuildBenchmarkSnapshots();

    const rows = await intelligence.listBenchmarkSnapshots({ metricCode });
    expect(rows).toHaveLength(1);
  });

  it('serves every list endpoint against the real schema', async () => {
    await expect(intelligence.listCompanyHealth({ limit: 5 })).resolves.toEqual(
      expect.any(Array),
    );
    await expect(
      intelligence.listAnomalyFindings({ companyId: companyIds[0] }),
    ).resolves.toEqual([]);
    await expect(
      intelligence.listForecastRuns({ companyId: companyIds[0] }),
    ).resolves.toEqual([]);
  });

  it('lists tenant benchmarks without date filters', async () => {
    const rows = await analytics.listBenchmarkSnapshots({ metricCode });

    expect(rows).toHaveLength(1);
  });
});
