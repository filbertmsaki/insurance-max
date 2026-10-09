import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 500;

export interface ListPage {
  limit?: number;
  offset?: number;
}

@Injectable()
export class PlatformIntelligenceService {
  constructor(private readonly dataSource: DataSource) {}

  async listCompanyHealth(page: ListPage = {}) {
    const { limit, offset } = this.page(page);

    // Each count is a separate subquery: joining three child tables and
    // counting DISTINCT would multiply rows per company first.
    return this.dataSource.query(
      `
      SELECT
        company.id,
        company.name,
        company.tira_company_code AS "companyCode",
        (
          SELECT COUNT(*) FROM analytics_scorecard_snapshots scorecard
          WHERE scorecard.company_id = company.id
            AND scorecard.status = 'PUBLISHED'
        ) AS "publishedScorecards",
        (
          SELECT COUNT(*) FROM analytics_anomaly_findings finding
          WHERE finding.company_id = company.id
            AND finding.status = 'OPEN'
        ) AS "openAnomalies",
        (
          SELECT COUNT(*) FROM analytics_forecast_runs forecast_run
          WHERE forecast_run.company_id = company.id
        ) AS "forecastRuns"
      FROM companies company
      ORDER BY company.name ASC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );
  }

  async listBenchmarkSnapshots(
    query: {
      metricCode?: string;
      cohortKey?: string;
      from?: string;
      to?: string;
    } & ListPage,
  ) {
    const { limit, offset } = this.page(query);

    return this.dataSource.query(
      `
      SELECT *
      FROM platform_benchmark_snapshots
      WHERE ($1::varchar IS NULL OR metric_code = $1)
        AND ($2::varchar IS NULL OR cohort_key = $2)
        AND ($3::date IS NULL OR period_start >= $3)
        AND ($4::date IS NULL OR period_end <= $4)
      ORDER BY period_start DESC, metric_code ASC
      LIMIT $5 OFFSET $6
      `,
      [
        query.metricCode ?? null,
        query.cohortKey ?? null,
        query.from ?? null,
        query.to ?? null,
        limit,
        offset,
      ],
    );
  }

  async listAnomalyFindings(
    query: {
      companyId?: string;
      branchId?: string;
      from?: string;
      to?: string;
    } & ListPage,
  ) {
    const { limit, offset } = this.page(query);

    return this.dataSource.query(
      `
      SELECT
        finding.*,
        company.name AS "companyName"
      FROM analytics_anomaly_findings finding
      LEFT JOIN companies company ON company.id = finding.company_id
      WHERE ($1::uuid IS NULL OR finding.company_id = $1)
        AND ($2::uuid IS NULL OR finding.branch_id = $2)
        AND ($3::date IS NULL OR finding.metric_date >= $3)
        AND ($4::date IS NULL OR finding.metric_date <= $4)
      ORDER BY finding.metric_date DESC, finding.severity DESC
      LIMIT $5 OFFSET $6
      `,
      [
        query.companyId ?? null,
        query.branchId ?? null,
        query.from ?? null,
        query.to ?? null,
        limit,
        offset,
      ],
    );
  }

  async listForecastRuns(
    query: {
      companyId?: string;
      branchId?: string;
      status?: string;
    } & ListPage,
  ) {
    const { limit, offset } = this.page(query);

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
      LIMIT $4 OFFSET $5
      `,
      [
        query.companyId ?? null,
        query.branchId ?? null,
        query.status ?? null,
        limit,
        offset,
      ],
    );
  }

  /**
   * Recomputes every benchmark in one transaction, so a failure part-way
   * leaves the previous snapshots in place instead of a half-deleted set.
   */
  rebuildBenchmarkSnapshots() {
    return this.dataSource.transaction((manager) =>
      this.rebuildWithin(manager),
    );
  }

  private async rebuildWithin(manager: EntityManager) {
    const minimumCohortSize = 3;
    const rebuiltBy = 'platform-intelligence.rebuildBenchmarkSnapshots';

    // One rebuild at a time across app instances (nightly job + manual).
    const [lock] = await manager.query(
      `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
      [rebuiltBy],
    );
    if (!lock?.acquired) {
      throw new ConflictException('A benchmark rebuild is already running');
    }

    await manager.query(
      `
      DELETE FROM platform_benchmark_snapshots
      WHERE metadata ->> 'rebuiltBy' = $1
      `,
      [rebuiltBy],
    );

    const usageRows = await manager.query(
      `
      WITH source_values AS (
        SELECT
          snapshot.metric_code,
          CONCAT(
            'saas_usage:',
            COALESCE(NULLIF(snapshot.dimension_key, ''), 'default')
          ) AS cohort_key,
          jsonb_build_object(
            'source',
            'platform_usage_snapshots',
            'dimensionKey',
            COALESCE(NULLIF(snapshot.dimension_key, ''), 'default')
          ) AS cohort_dimensions,
          snapshot.period_start::date AS period_start,
          snapshot.period_end::date AS period_end,
          snapshot.company_id,
          SUM(snapshot.quantity)::numeric AS metric_value
        FROM platform_usage_snapshots snapshot
        GROUP BY
          snapshot.metric_code,
          snapshot.dimension_key,
          snapshot.period_start::date,
          snapshot.period_end::date,
          snapshot.company_id
      ),
      aggregated AS (
        SELECT
          metric_code,
          cohort_key,
          cohort_dimensions,
          period_start,
          period_end,
          COUNT(DISTINCT company_id)::integer AS company_count,
          AVG(metric_value)::numeric AS mean_value,
          MIN(metric_value)::numeric AS minimum_value,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY metric_value)::numeric
            AS percentile_25,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value)::numeric
            AS median_value,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY metric_value)::numeric
            AS percentile_75,
          MAX(metric_value)::numeric AS maximum_value
        FROM source_values
        GROUP BY metric_code, cohort_key, cohort_dimensions, period_start, period_end
      ),
      inserted AS (
        INSERT INTO platform_benchmark_snapshots (
          metric_code,
          cohort_key,
          cohort_dimensions,
          period_start,
          period_end,
          company_count,
          mean_value,
          minimum_value,
          percentile_25,
          median_value,
          percentile_75,
          maximum_value,
          status,
          minimum_cohort_size,
          published_at,
          metadata
        )
        SELECT
          metric_code,
          cohort_key,
          cohort_dimensions,
          period_start,
          period_end,
          company_count,
          CASE WHEN company_count >= $2::integer THEN mean_value END,
          CASE WHEN company_count >= $2::integer THEN minimum_value END,
          CASE WHEN company_count >= $2::integer THEN percentile_25 END,
          CASE WHEN company_count >= $2::integer THEN median_value END,
          CASE WHEN company_count >= $2::integer THEN percentile_75 END,
          CASE WHEN company_count >= $2::integer THEN maximum_value END,
          CASE
            WHEN company_count >= $2::integer THEN 'PUBLISHED'
            ELSE 'INSUFFICIENT_COHORT'
          END,
          $2,
          CASE WHEN company_count >= $2::integer THEN NOW() END,
          jsonb_build_object(
            'rebuiltBy',
            $1::text,
            'source',
            'platform_usage_snapshots'
          )
        FROM aggregated
        ON CONFLICT (metric_code, cohort_key, period_start, period_end)
        DO UPDATE SET
          cohort_dimensions = EXCLUDED.cohort_dimensions,
          company_count = EXCLUDED.company_count,
          mean_value = EXCLUDED.mean_value,
          minimum_value = EXCLUDED.minimum_value,
          percentile_25 = EXCLUDED.percentile_25,
          median_value = EXCLUDED.median_value,
          percentile_75 = EXCLUDED.percentile_75,
          maximum_value = EXCLUDED.maximum_value,
          status = EXCLUDED.status,
          minimum_cohort_size = EXCLUDED.minimum_cohort_size,
          calculated_at = NOW(),
          published_at = EXCLUDED.published_at,
          metadata = EXCLUDED.metadata
        RETURNING id
      )
      SELECT COUNT(*)::integer AS "snapshotCount"
      FROM inserted
      `,
      [rebuiltBy, minimumCohortSize],
    );

    const billingRows = await manager.query(
      `
      WITH source_values AS (
        SELECT
          metric.metric_code,
          CONCAT(
            'saas_billing:',
            COALESCE(NULLIF(cycle.currency, ''), 'UNKNOWN')
          ) AS cohort_key,
          jsonb_build_object(
            'source',
            'saas_billing_cycles',
            'currency',
            COALESCE(NULLIF(cycle.currency, ''), 'UNKNOWN')
          ) AS cohort_dimensions,
          cycle.period_start::date AS period_start,
          cycle.period_end::date AS period_end,
          cycle.company_id,
          metric.metric_value::numeric AS metric_value
        FROM saas_billing_cycles cycle
        CROSS JOIN LATERAL (
          VALUES
            ('saas.billing.base_amount', cycle.base_amount),
            ('saas.billing.usage_amount', cycle.usage_amount),
            ('saas.billing.tax_amount', cycle.tax_amount),
            ('saas.billing.total_amount', cycle.total_amount)
        ) AS metric(metric_code, metric_value)
        WHERE cycle.status <> 'CANCELLED'
      ),
      aggregated AS (
        SELECT
          metric_code,
          cohort_key,
          cohort_dimensions,
          period_start,
          period_end,
          COUNT(DISTINCT company_id)::integer AS company_count,
          AVG(metric_value)::numeric AS mean_value,
          MIN(metric_value)::numeric AS minimum_value,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY metric_value)::numeric
            AS percentile_25,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value)::numeric
            AS median_value,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY metric_value)::numeric
            AS percentile_75,
          MAX(metric_value)::numeric AS maximum_value
        FROM source_values
        GROUP BY metric_code, cohort_key, cohort_dimensions, period_start, period_end
      ),
      inserted AS (
        INSERT INTO platform_benchmark_snapshots (
          metric_code,
          cohort_key,
          cohort_dimensions,
          period_start,
          period_end,
          company_count,
          mean_value,
          minimum_value,
          percentile_25,
          median_value,
          percentile_75,
          maximum_value,
          status,
          minimum_cohort_size,
          published_at,
          metadata
        )
        SELECT
          metric_code,
          cohort_key,
          cohort_dimensions,
          period_start,
          period_end,
          company_count,
          CASE WHEN company_count >= $2::integer THEN mean_value END,
          CASE WHEN company_count >= $2::integer THEN minimum_value END,
          CASE WHEN company_count >= $2::integer THEN percentile_25 END,
          CASE WHEN company_count >= $2::integer THEN median_value END,
          CASE WHEN company_count >= $2::integer THEN percentile_75 END,
          CASE WHEN company_count >= $2::integer THEN maximum_value END,
          CASE
            WHEN company_count >= $2::integer THEN 'PUBLISHED'
            ELSE 'INSUFFICIENT_COHORT'
          END,
          $2,
          CASE WHEN company_count >= $2::integer THEN NOW() END,
          jsonb_build_object(
            'rebuiltBy',
            $1::text,
            'source',
            'saas_billing_cycles'
          )
        FROM aggregated
        ON CONFLICT (metric_code, cohort_key, period_start, period_end)
        DO UPDATE SET
          cohort_dimensions = EXCLUDED.cohort_dimensions,
          company_count = EXCLUDED.company_count,
          mean_value = EXCLUDED.mean_value,
          minimum_value = EXCLUDED.minimum_value,
          percentile_25 = EXCLUDED.percentile_25,
          median_value = EXCLUDED.median_value,
          percentile_75 = EXCLUDED.percentile_75,
          maximum_value = EXCLUDED.maximum_value,
          status = EXCLUDED.status,
          minimum_cohort_size = EXCLUDED.minimum_cohort_size,
          calculated_at = NOW(),
          published_at = EXCLUDED.published_at,
          metadata = EXCLUDED.metadata
        RETURNING id
      )
      SELECT COUNT(*)::integer AS "snapshotCount"
      FROM inserted
      `,
      [rebuiltBy, minimumCohortSize],
    );

    return {
      message: 'Benchmark snapshots rebuilt',
      minimumCohortSize,
      usageSnapshotCount: Number(usageRows[0]?.snapshotCount ?? 0),
      billingSnapshotCount: Number(billingRows[0]?.snapshotCount ?? 0),
    };
  }

  private page(page: ListPage) {
    const limit = Math.trunc(Number(page.limit ?? DEFAULT_LIST_LIMIT));
    const offset = Math.trunc(Number(page.offset ?? 0));

    return {
      limit:
        Number.isFinite(limit) && limit > 0
          ? Math.min(limit, MAX_LIST_LIMIT)
          : DEFAULT_LIST_LIMIT,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    };
  }
}
