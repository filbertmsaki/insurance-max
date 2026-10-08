import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type KpiDefinitionRow = {
  id: string;
  code: string;
  calculator_key?: string;
  calculatorKey?: string;
};

type ScorecardTemplateItemRow = {
  id: string;
  code: string;
  weight?: number | string | null;
  kpiDefinitionId: string;
  targetValue?: number | string | null;
  defaultTarget?: number | string | null;
  warningThreshold?: number | string | null;
  defaultWarningThreshold?: number | string | null;
  criticalThreshold?: number | string | null;
  defaultCriticalThreshold?: number | string | null;
};

type DailyMetricRow = {
  metricDate: string | Date;
  metricValue: number | string | null;
  observationCount?: number | string | null;
  dimensions?: Record<string, unknown> | null;
};

type AnomalyFindingRow = {
  id: string;
  rule_id: string;
  metric_date: string;
};

type AnomalyRuleRow = {
  id: string;
  metric_code: string;
};

type ForecastDefinitionRow = {
  id: string;
  method?: string | null;
  metric_code?: string | null;
  metricCode?: string | null;
};

type ForecastRunRow = {
  id: string;
};

type ForecastPointRow = {
  id: string;
  forecast_date: string;
  predicted_value: number | string;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async listKpiDefinitions(): Promise<KpiDefinitionRow[]> {
    return this.dataSource.query(
      `
      SELECT
        id,
        code,
        name,
        description,
        category,
        code AS "calculatorKey",
        value_type AS "valueType",
        CASE
          WHEN aggregation_type = 'AVERAGE' THEN 'higher-is-better'
          ELSE 'higher-is-better'
        END AS direction,
        '[]'::jsonb AS "applicableCompanyTypes",
        NULL::numeric AS "defaultTarget",
        NULL::numeric AS "defaultWarningThreshold",
        NULL::numeric AS "defaultCriticalThreshold",
        NULL::date AS "effectiveFrom",
        NULL::date AS "effectiveTo",
        true AS "isActive",
        jsonb_build_object(
          'source',
          'analytics_metric_definitions',
          'aggregationType',
          aggregation_type,
          'permission',
          permission,
          'supportedDimensions',
          supported_dimensions,
          'supportedPeriods',
          supported_periods
        ) AS metadata
      FROM analytics_metric_definitions
      ORDER BY category, code
      `,
    );
  }

  async getKpiDefinition(code: string): Promise<KpiDefinitionRow | null> {
    const definitions = await this.dataSource.query(
      `
      SELECT
        id,
        code,
        name,
        description,
        category,
        code AS calculator_key,
        code AS "calculatorKey",
        value_type,
        value_type AS "valueType",
        CASE
          WHEN aggregation_type = 'AVERAGE' THEN 'higher-is-better'
          ELSE 'higher-is-better'
        END AS direction,
        '[]'::jsonb AS applicable_company_types,
        '[]'::jsonb AS "applicableCompanyTypes",
        NULL::numeric AS default_target,
        NULL::numeric AS "defaultTarget",
        NULL::numeric AS default_warning_threshold,
        NULL::numeric AS "defaultWarningThreshold",
        NULL::numeric AS default_critical_threshold,
        NULL::numeric AS "defaultCriticalThreshold",
        NULL::date AS effective_from,
        NULL::date AS "effectiveFrom",
        NULL::date AS effective_to,
        NULL::date AS "effectiveTo",
        true AS is_active,
        true AS "isActive",
        jsonb_build_object(
          'source',
          'analytics_metric_definitions',
          'aggregationType',
          aggregation_type,
          'permission',
          permission,
          'supportedDimensions',
          supported_dimensions,
          'supportedPeriods',
          supported_periods
        ) AS metadata,
        aggregation_type,
        formula_version,
        formula_description,
        supported_dimensions,
        supported_periods,
        permission,
        sensitive,
        target_supported,
        forecast_supported,
        benchmark_supported
      FROM analytics_metric_definitions
      WHERE code = $1
      LIMIT 1
      `,
      [code],
    );

    return (definitions as KpiDefinitionRow[])[0] ?? null;
  }

  async listScorecardTemplates(
    companyId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.dataSource.query(
      `
      SELECT
        id,
        company_id AS "companyId",
        code,
        name,
        applicable_company_types AS "applicableCompanyTypes",
        is_default AS "isDefault",
        is_active AS "isActive",
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM analytics_scorecard_templates
      WHERE is_active = true
        AND (company_id IS NULL OR company_id = $1)
      ORDER BY name
      `,
      [companyId],
    );
  }

  async getScorecardTemplateItems(
    templateId: string,
  ): Promise<ScorecardTemplateItemRow[]> {
    return this.dataSource.query(
      `
      SELECT
        item.id,
        item.template_id AS "templateId",
        item.kpi_definition_id AS "kpiDefinitionId",
        item.display_order AS "displayOrder",
        item.weight,
        item.target_value AS "targetValue",
        item.warning_threshold AS "warningThreshold",
        item.critical_threshold AS "criticalThreshold",
        item.is_required AS "isRequired",
        def.code,
        def.name,
        def.description,
        def.category,
        def.calculator_key AS "calculatorKey",
        def.value_type AS "valueType",
        def.direction,
        def.default_target AS "defaultTarget",
        def.default_warning_threshold AS "defaultWarningThreshold",
        def.default_critical_threshold AS "defaultCriticalThreshold"
      FROM analytics_scorecard_template_items item
      JOIN analytics_kpi_definitions def
        ON def.id = item.kpi_definition_id
      WHERE item.template_id = $1
      ORDER BY item.display_order ASC
      `,
      [templateId],
    );
  }

  /**
   * `branchIds` (when set) limits the rows to those branches — used for
   * branch-limited users who did not pick a single branch.
   */
  async getDailyMetrics(params: {
    companyId: string;
    branchId?: string | null;
    branchIds?: string[] | null;
    metricCode: string;
    from?: string;
    to?: string;
  }): Promise<DailyMetricRow[]> {
    const queryParams: Array<string | string[] | null> = [
      params.companyId,
      params.metricCode,
    ];
    let dateFilter = '';

    if (params.from) {
      queryParams.push(params.from);
      dateFilter += ` AND metric_date >= $${queryParams.length}`;
    }

    if (params.to) {
      queryParams.push(params.to);
      dateFilter += ` AND metric_date <= $${queryParams.length}`;
    }

    queryParams.push(params.branchId ?? null);
    const branchParam = queryParams.length;
    queryParams.push(params.branchIds ?? null);
    const branchesParam = queryParams.length;

    return this.dataSource.query(
      `
      SELECT
        metric_date AS "metricDate",
        metric_value AS "metricValue",
        observation_count AS "observationCount",
        dimensions
      FROM analytics_daily_metrics
      WHERE company_id = $1
        AND metric_code = $2
        ${dateFilter}
        AND ($${branchParam}::uuid IS NULL OR branch_id = $${branchParam})
        AND ($${branchesParam}::uuid[] IS NULL OR branch_id = ANY($${branchesParam}::uuid[]))
      ORDER BY metric_date ASC
      `,
      queryParams,
    );
  }

  async listAnomalyFindings(
    companyId: string,
    branchId?: string | null,
    from?: string,
    to?: string,
    branchIds?: string[] | null,
  ): Promise<AnomalyFindingRow[]> {
    const params: Array<string | string[] | null> = [
      companyId,
      branchId ?? null,
      from ?? null,
      to ?? null,
      branchIds ?? null,
    ];

    return this.dataSource.query(
      `
      SELECT *
      FROM analytics_anomaly_findings
      WHERE company_id = $1
        AND ($2::uuid IS NULL OR branch_id = $2)
        AND ($3::date IS NULL OR metric_date >= $3)
        AND ($4::date IS NULL OR metric_date <= $4)
        AND ($5::uuid[] IS NULL OR branch_id = ANY($5::uuid[]))
      ORDER BY metric_date DESC, severity DESC
      `,
      params,
    );
  }

  async listAnomalyRules(companyId: string): Promise<AnomalyRuleRow[]> {
    return this.dataSource.query(
      `
      SELECT *
      FROM analytics_anomaly_rules
      WHERE is_active = true
        AND (company_id IS NULL OR company_id = $1)
      ORDER BY name
      `,
      [companyId],
    );
  }

  async listAnomalyFindingsByRuleAndDate(
    ruleId: string,
    companyId: string,
    metricDate: string,
  ): Promise<AnomalyFindingRow[]> {
    return this.dataSource.query(
      `
      SELECT *
      FROM analytics_anomaly_findings
      WHERE rule_id = $1
        AND company_id = $2
        AND metric_date = $3
      LIMIT 1
      `,
      [ruleId, companyId, metricDate],
    );
  }

  async insertAnomalyFinding(finding: {
    companyId: string;
    branchId?: string | null;
    ruleId: string;
    metricCode: string;
    metricDate: string;
    dimensionKey: string;
    dimensions: Record<string, unknown>;
    observedValue: number;
    expectedValue: number;
    deviationValue: number;
    deviationPercent: number;
    severity: string;
    status: string;
    explanation: string;
    evidence: Record<string, unknown>;
  }): Promise<AnomalyFindingRow | undefined> {
    const rows = await this.dataSource.query(
      `
      INSERT INTO analytics_anomaly_findings (
        company_id,
        branch_id,
        rule_id,
        metric_code,
        metric_date,
        dimension_key,
        dimensions,
        observed_value,
        expected_value,
        deviation_value,
        deviation_percent,
        severity,
        status,
        explanation,
        evidence
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
      `,
      [
        finding.companyId,
        finding.branchId ?? null,
        finding.ruleId,
        finding.metricCode,
        finding.metricDate,
        finding.dimensionKey,
        finding.dimensions,
        finding.observedValue,
        finding.expectedValue,
        finding.deviationValue,
        finding.deviationPercent,
        finding.severity,
        finding.status,
        finding.explanation,
        finding.evidence,
      ],
    );

    return rows[0];
  }

  async listForecastDefinitions(
    companyId: string,
  ): Promise<ForecastDefinitionRow[]> {
    return this.dataSource.query(
      `
      SELECT *
      FROM analytics_forecast_definitions
      WHERE is_active = true
        AND (company_id IS NULL OR company_id = $1)
      ORDER BY name
      `,
      [companyId],
    );
  }

  async getForecastDefinition(
    definitionId: string,
  ): Promise<ForecastDefinitionRow | null> {
    const rows = await this.dataSource.query(
      `
      SELECT *
      FROM analytics_forecast_definitions
      WHERE id = $1
      LIMIT 1
      `,
      [definitionId],
    );

    return rows[0] ?? null;
  }

  async insertForecastRun(run: {
    companyId: string;
    branchId?: string | null;
    definitionId: string;
    runNo: string;
    trainingPeriodStart: string;
    trainingPeriodEnd: string;
    forecastPeriodStart: string;
    forecastPeriodEnd: string;
    selectedMethod: string;
    status: string;
    createdBy: string;
  }): Promise<ForecastRunRow> {
    const rows = await this.dataSource.query(
      `
      INSERT INTO analytics_forecast_runs (
        company_id,
        branch_id,
        definition_id,
        run_no,
        training_period_start,
        training_period_end,
        forecast_period_start,
        forecast_period_end,
        selected_method,
        status,
        created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        run.companyId,
        run.branchId ?? null,
        run.definitionId,
        run.runNo,
        run.trainingPeriodStart,
        run.trainingPeriodEnd,
        run.forecastPeriodStart,
        run.forecastPeriodEnd,
        run.selectedMethod,
        run.status,
        run.createdBy,
      ],
    );

    return rows[0];
  }

  async insertForecastPoints(
    runId: string,
    points: Array<{
      forecastDate: string;
      predictedValue: number;
      lowerBound?: number | null;
      upperBound?: number | null;
    }>,
  ): Promise<ForecastPointRow[]> {
    const values = points
      .map(
        (point, index) =>
          `($1,$${index * 4 + 2},$${index * 4 + 3},$${index * 4 + 4},$${index * 4 + 5})`,
      )
      .join(',');

    const params: Array<string | number | null> = [runId];
    points.forEach((point) => {
      params.push(
        point.forecastDate,
        point.predictedValue,
        point.lowerBound ?? null,
        point.upperBound ?? null,
      );
    });

    if (points.length === 0) {
      return [];
    }

    return this.dataSource.query(
      `
      INSERT INTO analytics_forecast_points (
        forecast_run_id,
        forecast_date,
        predicted_value,
        lower_bound,
        upper_bound
      ) VALUES ${values}
      RETURNING *
      `,
      params,
    );
  }

  async listBenchmarkSnapshots(query: {
    metricCode?: string;
    cohortKey?: string;
    from?: string;
    to?: string;
  }) {
    const params: Array<string | null> = [
      query.metricCode ?? null,
      query.cohortKey ?? null,
      query.from ?? null,
      query.to ?? null,
    ];

    // Every placeholder is always referenced: Postgres rejects a bind with
    // more parameters than the statement uses.
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
}
