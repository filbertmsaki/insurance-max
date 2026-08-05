import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async listKpiDefinitions() {
    return this.dataSource.query(
      `
      SELECT
        id,
        code,
        name,
        description,
        category,
        calculator_key AS "calculatorKey",
        value_type AS "valueType",
        direction,
        applicable_company_types AS "applicableCompanyTypes",
        default_target AS "defaultTarget",
        default_warning_threshold AS "defaultWarningThreshold",
        default_critical_threshold AS "defaultCriticalThreshold",
        effective_from AS "effectiveFrom",
        effective_to AS "effectiveTo",
        is_active AS "isActive",
        metadata
      FROM analytics_kpi_definitions
      WHERE is_active = true
      ORDER BY category, code
      `,
    );
  }

  async getKpiDefinition(code: string) {
    const definitions = await this.dataSource.query(
      `
      SELECT
        *
      FROM analytics_kpi_definitions
      WHERE code = $1
      LIMIT 1
      `,
      [code],
    );

    return definitions[0] ?? null;
  }

  async listScorecardTemplates(companyId: string) {
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

  async getScorecardTemplateItems(templateId: string) {
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

  async getDailyMetrics(params: {
    companyId: string;
    branchId?: string | null;
    metricCode: string;
    from?: string;
    to?: string;
  }) {
    const queryParams: Array<string | null> = [
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
        AND ($${queryParams.length}::uuid IS NULL OR branch_id = $${queryParams.length})
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
  ) {
    const params: Array<string | null> = [
      companyId,
      branchId ?? null,
      from ?? null,
      to ?? null,
    ];

    return this.dataSource.query(
      `
      SELECT *
      FROM analytics_anomaly_findings
      WHERE company_id = $1
        AND ($2::uuid IS NULL OR branch_id = $2)
        AND ($3::date IS NULL OR metric_date >= $3)
        AND ($4::date IS NULL OR metric_date <= $4)
      ORDER BY metric_date DESC, severity DESC
      `,
      params,
    );
  }

  async listAnomalyRules(companyId: string) {
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
  ) {
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
  }) {
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

  async listForecastDefinitions(companyId: string) {
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

  async getForecastDefinition(definitionId: string) {
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
  }) {
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
  ) {
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
    const conditions = [
      '($1::varchar IS NULL OR metric_code = $1)',
      '($2::varchar IS NULL OR cohort_key = $2)',
    ];

    if (query.from) {
      conditions.push('period_start >= $3');
    }

    if (query.to) {
      conditions.push('period_end <= $4');
    }

    return this.dataSource.query(
      `
      SELECT *
      FROM platform_benchmark_snapshots
      WHERE ${conditions.join(' AND ')}
      ORDER BY period_start DESC
      `,
      params,
    );
  }

  async insertBenchmarkSnapshot(snapshot: {
    metricCode: string;
    cohortKey: string;
    cohortDimensions: Record<string, unknown>;
    periodStart: string;
    periodEnd: string;
    companyCount: number;
    meanValue: number;
    minimumValue: number;
    percentile25: number;
    medianValue: number;
    percentile75: number;
    maximumValue: number;
    status: string;
    minimumCohortSize: number;
    metadata?: Record<string, unknown>;
  }) {
    const rows = await this.dataSource.query(
      `
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
        metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
      `,
      [
        snapshot.metricCode,
        snapshot.cohortKey,
        snapshot.cohortDimensions,
        snapshot.periodStart,
        snapshot.periodEnd,
        snapshot.companyCount,
        snapshot.meanValue,
        snapshot.minimumValue,
        snapshot.percentile25,
        snapshot.medianValue,
        snapshot.percentile75,
        snapshot.maximumValue,
        snapshot.status,
        snapshot.minimumCohortSize,
        snapshot.metadata ?? {},
      ],
    );

    return rows[0];
  }
}
