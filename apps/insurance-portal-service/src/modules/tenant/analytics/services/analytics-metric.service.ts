import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AnalyticsDataFreshness,
  AnalyticsPeriodType,
  AnalyticsValueKind,
  MetricAggregationType,
  MetricValueType,
} from '@insurance-max/contracts';
import { DateTime } from 'luxon';
import { DataSource, Repository } from 'typeorm';

import { AnalyticsProjectionCheckpoint } from '../../../shared/analytics/entities/analytics-projection-checkpoint.entity';
import { AnalyticsMetricDefinitionEntity } from '../entities/analytics-metric-definition.entity';
import { AnalyticsMetricValueEntity } from '../entities/analytics-metric-value.entity';

type RegisteredMetricSeed = {
  code: string;
  name: string;
  description: string;
  category: string;
  value_type: MetricValueType;
  aggregation_type: MetricAggregationType;
  formula_version: number;
  formula_description: string;
  numerator_metric_code?: string | null;
  denominator_metric_code?: string | null;
  supported_dimensions: string[];
  supported_periods: AnalyticsPeriodType[];
  permission: string;
  sensitive: boolean;
  target_supported: boolean;
  forecast_supported: boolean;
  benchmark_supported: boolean;
  legacyMetricCode?: string | null;
  currency_code?: string | null;
};

type MetricQueryInput = {
  companyId: string;
  metricCode: string;
  periodType: AnalyticsPeriodType;
  periodStart: string;
  periodEnd: string;
  branchId?: string | null;
  dimensions?: Record<string, string>;
  valueKind?: AnalyticsValueKind;
  currencyCode?: string | null;
};

@Injectable()
export class AnalyticsMetricService {
  constructor(
    @InjectRepository(AnalyticsMetricDefinitionEntity)
    private readonly definitionRepository: Repository<AnalyticsMetricDefinitionEntity>,
    @InjectRepository(AnalyticsMetricValueEntity)
    private readonly valueRepository: Repository<AnalyticsMetricValueEntity>,
    @InjectRepository(AnalyticsProjectionCheckpoint)
    private readonly checkpointRepository: Repository<AnalyticsProjectionCheckpoint>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async listDefinitions(permissions: string[] = []) {
    await this.ensureDefaultDefinitions();
    const definitions = await this.definitionRepository.find({
      order: { category: 'ASC', code: 'ASC' },
    });

    return definitions
      .filter(
        (definition) =>
          !definition.permission || permissions.includes(definition.permission),
      )
      .map((definition) => this.serializeDefinition(definition));
  }

  async getDefinition(code: string) {
    await this.ensureDefaultDefinitions();
    const definition = await this.definitionRepository.findOne({
      where: { code },
    });

    if (!definition) {
      throw new NotFoundException(`Metric definition not found: ${code}`);
    }

    return this.serializeDefinition(definition);
  }

  async queryMetric(input: MetricQueryInput) {
    await this.ensureDefaultDefinitions();
    const definition = await this.requireDefinition(input.metricCode);
    this.validateQuery(definition, input);

    const values = await this.findStoredValues(definition, input);
    if (values.length > 0) {
      return {
        definition: this.serializeDefinition(definition),
        values: values.map((value) => this.serializeValue(value)),
      };
    }

    const fallbackValues = await this.queryLegacyMetric(definition, input);
    return {
      definition: this.serializeDefinition(definition),
      values: fallbackValues,
    };
  }

  async compareMetric(
    input: MetricQueryInput & {
      comparePeriodStart?: string;
      comparePeriodEnd?: string;
    },
  ) {
    const primary = await this.queryMetric(input);

    const primaryStart = DateTime.fromISO(input.periodStart);
    const primaryEnd = DateTime.fromISO(input.periodEnd);
    const periodDays = Math.max(
      primaryEnd.diff(primaryStart, 'days').days + 1,
      1,
    );

    const comparePeriodEnd =
      input.comparePeriodEnd ??
      primaryStart.minus({ day: 1 }).toISODate() ??
      input.periodStart;
    const comparePeriodStart =
      input.comparePeriodStart ??
      DateTime.fromISO(comparePeriodEnd)
        .minus({ day: periodDays - 1 })
        .toISODate() ??
      input.periodStart;

    const comparison = await this.queryMetric({
      ...input,
      periodStart: comparePeriodStart,
      periodEnd: comparePeriodEnd,
    });

    return {
      primary,
      comparison,
      delta: this.calculateDelta(
        primary.values[primary.values.length - 1]?.value ?? null,
        comparison.values[comparison.values.length - 1]?.value ?? null,
      ),
    };
  }

  async getExecutiveDashboard(companyId: string, permissions: string[] = []) {
    await this.ensureDefaultDefinitions();
    const now = DateTime.utc();
    const monthStart = now.startOf('month').toISODate() ?? now.toISODate();
    const monthEnd = now.endOf('day').toISODate() ?? now.toISODate();
    const widgetCodes = [
      'policy.issued_count',
      'premium.gross_written',
      'premium.commission',
      'tiramis.success_rate',
    ];

    const widgets = await Promise.all(
      widgetCodes.map(async (metricCode) => {
        const definition = await this.definitionRepository.findOne({
          where: { code: metricCode },
        });

        if (!definition) {
          return {
            code: metricCode,
            status: 'UNAVAILABLE',
            data: null,
            freshness: null,
          };
        }

        if (
          definition.permission &&
          !permissions.includes(definition.permission)
        ) {
          return {
            code: metricCode,
            status: 'UNAVAILABLE',
            data: null,
            freshness: null,
          };
        }

        const result = await this.queryMetric({
          companyId,
          metricCode,
          periodType: AnalyticsPeriodType.MONTH,
          periodStart: monthStart,
          periodEnd: monthEnd,
          valueKind: AnalyticsValueKind.ACTUAL,
        });

        const current = result.values[result.values.length - 1] ?? null;

        return {
          code: metricCode,
          name: definition.name,
          status:
            current?.value === null || current === null
              ? 'NO_DATA'
              : 'AVAILABLE',
          data:
            current === null
              ? null
              : {
                  value: current.value,
                  unit: definition.value_type,
                  periodStart: current.periodStart,
                  periodEnd: current.periodEnd,
                  formulaVersion: current.formulaVersion,
                },
          freshness:
            current === null
              ? null
              : {
                  status: current.freshness,
                  lastProjectedAt: current.calculatedAt,
                  reason: current.freshnessReason,
                },
        };
      }),
    );

    return {
      period: {
        type: AnalyticsPeriodType.MONTH,
        start: monthStart,
        end: monthEnd,
      },
      widgets,
      generatedAt: new Date().toISOString(),
    };
  }

  private async ensureDefaultDefinitions() {
    const definitions = this.defaultDefinitions();

    for (const item of definitions) {
      let existing = await this.definitionRepository.findOne({
        where: { code: item.code },
      });

      if (!existing) {
        existing = this.definitionRepository.create({
          code: item.code,
          name: item.name,
          description: item.description,
          category: item.category,
          value_type: item.value_type,
          aggregation_type: item.aggregation_type,
          formula_version: item.formula_version,
          formula_description: item.formula_description,
          numerator_metric_code: item.numerator_metric_code ?? null,
          denominator_metric_code: item.denominator_metric_code ?? null,
          supported_dimensions: item.supported_dimensions,
          supported_periods: item.supported_periods,
          permission: item.permission,
          sensitive: item.sensitive,
          target_supported: item.target_supported,
          forecast_supported: item.forecast_supported,
          benchmark_supported: item.benchmark_supported,
        });
      } else {
        Object.assign(existing, {
          name: item.name,
          description: item.description,
          category: item.category,
          value_type: item.value_type,
          aggregation_type: item.aggregation_type,
          formula_version: item.formula_version,
          formula_description: item.formula_description,
          numerator_metric_code: item.numerator_metric_code ?? null,
          denominator_metric_code: item.denominator_metric_code ?? null,
          supported_dimensions: item.supported_dimensions,
          supported_periods: item.supported_periods,
          permission: item.permission,
          sensitive: item.sensitive,
          target_supported: item.target_supported,
          forecast_supported: item.forecast_supported,
          benchmark_supported: item.benchmark_supported,
        });
      }

      await this.definitionRepository.save(existing);
    }
  }

  private async requireDefinition(code: string) {
    const definition = await this.definitionRepository.findOne({
      where: { code },
    });

    if (!definition) {
      throw new NotFoundException(`Metric definition not found: ${code}`);
    }

    return definition;
  }

  private validateQuery(
    definition: AnalyticsMetricDefinitionEntity,
    input: MetricQueryInput,
  ) {
    if (!definition.supported_periods.includes(input.periodType)) {
      throw new BadRequestException(
        `Metric ${definition.code} does not support period type ${input.periodType}`,
      );
    }

    const unsupportedDimensions = Object.keys(input.dimensions ?? {}).filter(
      (key) => !definition.supported_dimensions.includes(key),
    );

    if (unsupportedDimensions.length > 0) {
      throw new BadRequestException(
        `Unsupported metric dimensions: ${unsupportedDimensions.join(', ')}`,
      );
    }
  }

  private async findStoredValues(
    definition: AnalyticsMetricDefinitionEntity,
    input: MetricQueryInput,
  ) {
    const dimensions = this.normalizeDimensions(input);
    const dimensionEntries = Object.entries(dimensions);
    const builder = this.valueRepository
      .createQueryBuilder('value')
      .where('value.company_id = :companyId', { companyId: input.companyId })
      .andWhere('value.metric_code = :metricCode', {
        metricCode: definition.code,
      })
      .andWhere('value.period_type = :periodType', {
        periodType: input.periodType,
      })
      .andWhere('value.period_start >= :periodStart', {
        periodStart: input.periodStart,
      })
      .andWhere('value.period_end <= :periodEnd', {
        periodEnd: input.periodEnd,
      })
      .andWhere('value.value_kind = :valueKind', {
        valueKind: input.valueKind ?? AnalyticsValueKind.ACTUAL,
      });

    if (input.currencyCode) {
      builder.andWhere('value.currency_code = :currencyCode', {
        currencyCode: input.currencyCode,
      });
    }

    for (const [key, value] of dimensionEntries) {
      builder.andWhere(
        `value.dimensions ->> :dimensionKey_${key} = :dimensionValue_${key}`,
        {
          [`dimensionKey_${key}`]: key,
          [`dimensionValue_${key}`]: value,
        },
      );
    }

    return builder.orderBy('value.period_start', 'ASC').getMany();
  }

  private async queryLegacyMetric(
    definition: AnalyticsMetricDefinitionEntity,
    input: MetricQueryInput,
  ) {
    const periodExpression = this.legacyPeriodExpression(input.periodType);
    const query = `
      SELECT
        ${periodExpression} AS "periodStart",
        MAX(metric_date)::date AS "periodEnd",
        SUM(metric_value)::numeric::text AS "value",
        MAX(currency)::varchar AS "currencyCode",
        MAX(calculated_at) AS "calculatedAt",
        MAX(projection_version)::bigint::text AS "sourceEventSequence"
      FROM analytics_daily_metrics
      WHERE company_id = $1
        AND metric_code = $2
        AND metric_date >= $3::date
        AND metric_date <= $4::date
        AND ($5::uuid IS NULL OR branch_id = $5)
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    let rows: Array<Record<string, unknown>> = [];

    try {
      rows = await this.dataSource.query(query, [
        input.companyId,
        definition.code,
        input.periodStart,
        input.periodEnd,
        input.branchId ?? null,
      ]);
    } catch (error) {
      if (!this.isMissingRelationError(error)) {
        throw error;
      }

      rows = [];
    }

    const freshness = await this.resolveFreshness(
      input.companyId,
      definition.code,
    );

    return rows.map((row: Record<string, unknown>) => ({
      metricCode: definition.code,
      periodType: input.periodType,
      periodStart: String(row.periodStart),
      periodEnd: String(row.periodEnd),
      value: row.value === null ? null : String(row.value),
      valueKind: input.valueKind ?? AnalyticsValueKind.ACTUAL,
      currencyCode:
        typeof row.currencyCode === 'string'
          ? row.currencyCode
          : this.defaultCurrencyFor(definition.code),
      dimensions: this.normalizeDimensions(input),
      formulaVersion: definition.formula_version,
      sourceEventSequence:
        typeof row.sourceEventSequence === 'string'
          ? row.sourceEventSequence
          : '0',
      calculatedAt:
        row.calculatedAt instanceof Date
          ? row.calculatedAt.toISOString()
          : typeof row.calculatedAt === 'string'
            ? row.calculatedAt
            : new Date().toISOString(),
      freshness: freshness.status,
      freshnessReason: freshness.reason,
    }));
  }

  private async resolveFreshness(companyId: string, metricCode: string) {
    const projectionCode = metricCode.split('.')[0].toUpperCase();
    const checkpoint = await this.checkpointRepository.findOne({
      where: {
        company_id: companyId,
        projection_code: projectionCode,
      },
      order: { updated_at: 'DESC' },
    });

    if (!checkpoint?.last_projected_at) {
      return {
        status: AnalyticsDataFreshness.DELAYED,
        reason: 'No projection checkpoint has been recorded yet',
      };
    }

    const currentLag = Number(
      this.configService.get<string>('ANALYTICS_CURRENT_LAG_SECONDS') ?? '300',
    );
    const staleLag = Number(
      this.configService.get<string>('ANALYTICS_STALE_LAG_SECONDS') ?? '3600',
    );
    const lagSeconds = Math.max(
      DateTime.utc().diff(
        DateTime.fromJSDate(checkpoint.last_projected_at),
        'seconds',
      ).seconds,
      0,
    );

    if (checkpoint.status === AnalyticsDataFreshness.FAILED) {
      return {
        status: AnalyticsDataFreshness.FAILED,
        reason: checkpoint.failure_reason ?? 'Projection failed',
      };
    }

    if (lagSeconds <= currentLag) {
      return {
        status: AnalyticsDataFreshness.CURRENT,
        reason: null,
      };
    }

    if (lagSeconds <= staleLag) {
      return {
        status: AnalyticsDataFreshness.DELAYED,
        reason: `Projection lag is ${Math.round(lagSeconds)} seconds`,
      };
    }

    return {
      status: AnalyticsDataFreshness.STALE,
      reason: `Projection lag is ${Math.round(lagSeconds)} seconds`,
    };
  }

  private serializeDefinition(definition: AnalyticsMetricDefinitionEntity) {
    return {
      code: definition.code,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      valueType: definition.value_type,
      aggregationType: definition.aggregation_type,
      formulaVersion: definition.formula_version,
      formulaDescription: definition.formula_description,
      numeratorMetricCode: definition.numerator_metric_code,
      denominatorMetricCode: definition.denominator_metric_code,
      supportedDimensions: definition.supported_dimensions,
      supportedPeriods: definition.supported_periods,
      permission: definition.permission,
      sensitive: definition.sensitive,
      targetSupported: definition.target_supported,
      forecastSupported: definition.forecast_supported,
      benchmarkSupported: definition.benchmark_supported,
    };
  }

  private serializeValue(value: AnalyticsMetricValueEntity) {
    return {
      metricCode: value.metric_code,
      periodType: value.period_type,
      periodStart: value.period_start,
      periodEnd: value.period_end,
      value: value.value,
      valueKind: value.value_kind,
      currencyCode: value.currency_code,
      dimensions: value.dimensions,
      formulaVersion: value.formula_version,
      sourceEventSequence: value.source_event_sequence,
      calculatedAt: value.calculated_at.toISOString(),
      freshness: value.freshness,
      freshnessReason: value.freshness_reason,
    };
  }

  private normalizeDimensions(input: MetricQueryInput) {
    return {
      ...(input.dimensions ?? {}),
      ...(input.branchId ? { branch_id: input.branchId } : {}),
    };
  }

  private defaultCurrencyFor(metricCode: string) {
    if (
      metricCode.includes('premium') ||
      metricCode.includes('claim') ||
      metricCode.includes('commission') ||
      metricCode.includes('reinsurance')
    ) {
      return 'TZS';
    }

    return null;
  }

  private calculateDelta(
    currentValue: string | null,
    previousValue: string | null,
  ) {
    if (currentValue === null || previousValue === null) {
      return null;
    }

    const current = Number(currentValue);
    const previous = Number(previousValue);

    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return null;
    }

    return String(current - previous);
  }

  private isMissingRelationError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    return 'code' in error && error.code === '42P01';
  }

  private legacyPeriodExpression(periodType: AnalyticsPeriodType) {
    switch (periodType) {
      case AnalyticsPeriodType.WEEK:
        return `DATE_TRUNC('week', metric_date)::date`;
      case AnalyticsPeriodType.MONTH:
      case AnalyticsPeriodType.ROLLING_30_DAYS:
        return `DATE_TRUNC('month', metric_date)::date`;
      case AnalyticsPeriodType.QUARTER:
        return `DATE_TRUNC('quarter', metric_date)::date`;
      case AnalyticsPeriodType.YEAR:
      case AnalyticsPeriodType.ROLLING_12_MONTHS:
        return `DATE_TRUNC('year', metric_date)::date`;
      case AnalyticsPeriodType.DAY:
      default:
        return `metric_date::date`;
    }
  }

  private defaultDefinitions(): RegisteredMetricSeed[] {
    return [
      {
        code: 'policy.issued_count',
        name: 'Policies issued',
        description: 'Count of issued policies in the selected period.',
        category: 'POLICIES',
        value_type: MetricValueType.NUMBER,
        aggregation_type: MetricAggregationType.SUM,
        formula_version: 1,
        formula_description:
          'Sum of policy issued counts from analytics daily rollups.',
        supported_dimensions: ['branch_id'],
        supported_periods: [
          AnalyticsPeriodType.DAY,
          AnalyticsPeriodType.WEEK,
          AnalyticsPeriodType.MONTH,
          AnalyticsPeriodType.QUARTER,
          AnalyticsPeriodType.YEAR,
        ],
        permission: 'analytics:metrics:read',
        sensitive: false,
        target_supported: true,
        forecast_supported: false,
        benchmark_supported: true,
      },
      {
        code: 'premium.gross_written',
        name: 'Gross written premium',
        description: 'Gross written premium aggregated from premium facts.',
        category: 'FINANCE',
        value_type: MetricValueType.MONEY,
        aggregation_type: MetricAggregationType.SUM,
        formula_version: 1,
        formula_description:
          'Sum of posted gross premium values from analytics daily rollups.',
        supported_dimensions: ['branch_id'],
        supported_periods: [
          AnalyticsPeriodType.DAY,
          AnalyticsPeriodType.WEEK,
          AnalyticsPeriodType.MONTH,
          AnalyticsPeriodType.QUARTER,
          AnalyticsPeriodType.YEAR,
        ],
        permission: 'analytics:metrics:read',
        sensitive: false,
        target_supported: true,
        forecast_supported: false,
        benchmark_supported: true,
      },
      {
        code: 'premium.commission',
        name: 'Commission amount',
        description: 'Commission amount aggregated from premium facts.',
        category: 'FINANCE',
        value_type: MetricValueType.MONEY,
        aggregation_type: MetricAggregationType.SUM,
        formula_version: 1,
        formula_description:
          'Sum of premium commission amounts from analytics daily rollups.',
        supported_dimensions: ['branch_id'],
        supported_periods: [
          AnalyticsPeriodType.DAY,
          AnalyticsPeriodType.WEEK,
          AnalyticsPeriodType.MONTH,
          AnalyticsPeriodType.QUARTER,
          AnalyticsPeriodType.YEAR,
        ],
        permission: 'analytics:metrics:read',
        sensitive: false,
        target_supported: true,
        forecast_supported: false,
        benchmark_supported: true,
      },
      {
        code: 'claim.paid_amount',
        name: 'Claims paid amount',
        description: 'Paid claim amount aggregated from claim facts.',
        category: 'CLAIMS',
        value_type: MetricValueType.MONEY,
        aggregation_type: MetricAggregationType.SUM,
        formula_version: 1,
        formula_description:
          'Sum of paid claim amounts from analytics daily rollups.',
        supported_dimensions: ['branch_id'],
        supported_periods: [
          AnalyticsPeriodType.DAY,
          AnalyticsPeriodType.WEEK,
          AnalyticsPeriodType.MONTH,
          AnalyticsPeriodType.QUARTER,
          AnalyticsPeriodType.YEAR,
        ],
        permission: 'analytics:metrics:read',
        sensitive: true,
        target_supported: true,
        forecast_supported: false,
        benchmark_supported: true,
      },
      {
        code: 'reinsurance.ceded_premium',
        name: 'Ceded premium',
        description: 'Ceded premium aggregated from reinsurance facts.',
        category: 'REINSURANCE',
        value_type: MetricValueType.MONEY,
        aggregation_type: MetricAggregationType.SUM,
        formula_version: 1,
        formula_description:
          'Sum of ceded premium from analytics daily rollups.',
        supported_dimensions: ['branch_id'],
        supported_periods: [
          AnalyticsPeriodType.DAY,
          AnalyticsPeriodType.WEEK,
          AnalyticsPeriodType.MONTH,
          AnalyticsPeriodType.QUARTER,
          AnalyticsPeriodType.YEAR,
        ],
        permission: 'analytics:metrics:read',
        sensitive: true,
        target_supported: true,
        forecast_supported: false,
        benchmark_supported: true,
      },
      {
        code: 'tiramis.submission_count',
        name: 'TIRAMIS submissions',
        description: 'Number of TIRAMIS submissions recorded in the period.',
        category: 'TIRAMIS',
        value_type: MetricValueType.NUMBER,
        aggregation_type: MetricAggregationType.SUM,
        formula_version: 1,
        formula_description:
          'Sum of TIRAMIS submission counts from analytics daily rollups.',
        supported_dimensions: ['branch_id'],
        supported_periods: [
          AnalyticsPeriodType.DAY,
          AnalyticsPeriodType.WEEK,
          AnalyticsPeriodType.MONTH,
          AnalyticsPeriodType.QUARTER,
          AnalyticsPeriodType.YEAR,
        ],
        permission: 'analytics:metrics:read',
        sensitive: false,
        target_supported: true,
        forecast_supported: false,
        benchmark_supported: true,
      },
      {
        code: 'tiramis.success_rate',
        name: 'TIRAMIS success rate',
        description: 'Submission success rate percentage for TIRAMIS traffic.',
        category: 'TIRAMIS',
        value_type: MetricValueType.PERCENTAGE,
        aggregation_type: MetricAggregationType.AVERAGE,
        formula_version: 1,
        formula_description:
          'Average success-rate percentage from analytics daily rollups for the selected period.',
        supported_dimensions: ['branch_id'],
        supported_periods: [
          AnalyticsPeriodType.DAY,
          AnalyticsPeriodType.WEEK,
          AnalyticsPeriodType.MONTH,
          AnalyticsPeriodType.QUARTER,
          AnalyticsPeriodType.YEAR,
        ],
        permission: 'analytics:metrics:read',
        sensitive: false,
        target_supported: true,
        forecast_supported: false,
        benchmark_supported: true,
      },
    ];
  }
}
