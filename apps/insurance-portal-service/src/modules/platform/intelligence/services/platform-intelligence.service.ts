import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PlatformIntelligenceService {
  constructor(private readonly dataSource: DataSource) {}

  async listCompanyHealth() {
    return this.dataSource.query(
      `
      SELECT
        company.id,
        company.name,
        company.tira_company_code AS "companyCode",
        COUNT(DISTINCT scorecard.id) AS "publishedScorecards",
        COUNT(DISTINCT finding.id) AS "openAnomalies",
        COUNT(DISTINCT forecastRun.id) AS "forecastRuns"
      FROM company
      LEFT JOIN analytics_scorecard_snapshots scorecard
        ON scorecard.company_id = company.id
        AND scorecard.status = 'PUBLISHED'
      LEFT JOIN analytics_anomaly_findings finding
        ON finding.company_id = company.id
        AND finding.status = 'OPEN'
      LEFT JOIN analytics_forecast_runs forecastRun
        ON forecastRun.company_id = company.id
      GROUP BY company.id
      ORDER BY company.name ASC
      `,
    );
  }

  async listBenchmarkSnapshots(query: {
    metricCode?: string;
    cohortKey?: string;
    from?: string;
    to?: string;
  }) {
    const params: Array<string | null> = [query.metricCode ?? null, query.cohortKey ?? null, query.from ?? null, query.to ?? null];

    return this.dataSource.query(
      `
      SELECT *
      FROM platform_benchmark_snapshots
      WHERE ($1::varchar IS NULL OR metric_code = $1)
        AND ($2::varchar IS NULL OR cohort_key = $2)
        AND ($3::date IS NULL OR period_start >= $3)
        AND ($4::date IS NULL OR period_end <= $4)
      ORDER BY period_start DESC
      `,
      params,
    );
  }

  async listAnomalyFindings(query: {
    companyId?: string;
    branchId?: string;
    from?: string;
    to?: string;
  }) {
    const params: Array<string | null> = [query.companyId ?? null, query.branchId ?? null, query.from ?? null, query.to ?? null];

    return this.dataSource.query(
      `
      SELECT
        finding.*,
        company.name AS "companyName"
      FROM analytics_anomaly_findings finding
      LEFT JOIN company ON company.id = finding.company_id
      WHERE ($1::uuid IS NULL OR finding.company_id = $1)
        AND ($2::uuid IS NULL OR finding.branch_id = $2)
        AND ($3::date IS NULL OR finding.metric_date >= $3)
        AND ($4::date IS NULL OR finding.metric_date <= $4)
      ORDER BY finding.metric_date DESC, finding.severity DESC
      `,
      params,
    );
  }

  async listForecastRuns(query: {
    companyId?: string;
    branchId?: string;
    status?: string;
  }) {
    const params: Array<string | null> = [query.companyId ?? null, query.branchId ?? null, query.status ?? null];

    return this.dataSource.query(
      `
      SELECT
        run.*,
        defs.name AS "definitionName"
      FROM analytics_forecast_runs run
      LEFT JOIN analytics_forecast_definitions defs
        ON defs.id = run.definition_id
      WHERE ($1::uuid IS NULL OR run.company_id = $1)
        AND ($2::uuid IS NULL OR run.branch_id = $2)
        AND ($3::varchar IS NULL OR run.status = $3)
      ORDER BY run.created_at DESC
      `,
      params,
    );
  }

  async rebuildBenchmarkSnapshots() {
    return {
      message:
        'Benchmark rebuild is not implemented. Implement platform benchmark aggregation logic before using this route.',
    };
  }
}
