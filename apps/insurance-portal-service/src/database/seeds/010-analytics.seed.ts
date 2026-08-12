import {
  AnalyticsPeriodType,
  MetricAggregationType,
  MetricValueType,
} from '@insurance-max/contracts';
import { DataSource, QueryRunner } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';

type MetricSeedDefinition = {
  code: string;
  name: string;
  description: string;
  category: string;
  valueType: MetricValueType;
  aggregationType: MetricAggregationType;
  formulaVersion: number;
  formulaDescription: string;
  supportedDimensions: string[];
  supportedPeriods: AnalyticsPeriodType[];
  permission: string;
  sensitive: boolean;
  targetSupported: boolean;
  forecastSupported: boolean;
  benchmarkSupported: boolean;
};

const METRIC_DEFINITIONS: MetricSeedDefinition[] = [
  {
    code: 'policy.issued_count',
    name: 'Policies issued',
    description: 'Count of issued policies in the selected period.',
    category: 'POLICIES',
    valueType: MetricValueType.NUMBER,
    aggregationType: MetricAggregationType.SUM,
    formulaVersion: 1,
    formulaDescription:
      'Sum of policy issued counts from analytics daily rollups.',
    supportedDimensions: ['branch_id'],
    supportedPeriods: [
      AnalyticsPeriodType.DAY,
      AnalyticsPeriodType.WEEK,
      AnalyticsPeriodType.MONTH,
      AnalyticsPeriodType.QUARTER,
      AnalyticsPeriodType.YEAR,
    ],
    permission: 'analytics:metrics:read',
    sensitive: false,
    targetSupported: true,
    forecastSupported: false,
    benchmarkSupported: true,
  },
  {
    code: 'premium.gross_written',
    name: 'Gross written premium',
    description: 'Gross written premium aggregated from premium facts.',
    category: 'FINANCE',
    valueType: MetricValueType.MONEY,
    aggregationType: MetricAggregationType.SUM,
    formulaVersion: 1,
    formulaDescription:
      'Sum of posted gross premium values from analytics daily rollups.',
    supportedDimensions: ['branch_id'],
    supportedPeriods: [
      AnalyticsPeriodType.DAY,
      AnalyticsPeriodType.WEEK,
      AnalyticsPeriodType.MONTH,
      AnalyticsPeriodType.QUARTER,
      AnalyticsPeriodType.YEAR,
    ],
    permission: 'analytics:metrics:read',
    sensitive: false,
    targetSupported: true,
    forecastSupported: false,
    benchmarkSupported: true,
  },
  {
    code: 'premium.commission',
    name: 'Commission amount',
    description: 'Commission amount aggregated from premium facts.',
    category: 'FINANCE',
    valueType: MetricValueType.MONEY,
    aggregationType: MetricAggregationType.SUM,
    formulaVersion: 1,
    formulaDescription:
      'Sum of premium commission amounts from analytics daily rollups.',
    supportedDimensions: ['branch_id'],
    supportedPeriods: [
      AnalyticsPeriodType.DAY,
      AnalyticsPeriodType.WEEK,
      AnalyticsPeriodType.MONTH,
      AnalyticsPeriodType.QUARTER,
      AnalyticsPeriodType.YEAR,
    ],
    permission: 'analytics:metrics:read',
    sensitive: false,
    targetSupported: true,
    forecastSupported: false,
    benchmarkSupported: true,
  },
  {
    code: 'claim.paid_amount',
    name: 'Claims paid amount',
    description: 'Paid claim amount aggregated from claim facts.',
    category: 'CLAIMS',
    valueType: MetricValueType.MONEY,
    aggregationType: MetricAggregationType.SUM,
    formulaVersion: 1,
    formulaDescription:
      'Sum of paid claim amounts from analytics daily rollups.',
    supportedDimensions: ['branch_id'],
    supportedPeriods: [
      AnalyticsPeriodType.DAY,
      AnalyticsPeriodType.WEEK,
      AnalyticsPeriodType.MONTH,
      AnalyticsPeriodType.QUARTER,
      AnalyticsPeriodType.YEAR,
    ],
    permission: 'analytics:metrics:read',
    sensitive: true,
    targetSupported: true,
    forecastSupported: false,
    benchmarkSupported: true,
  },
  {
    code: 'reinsurance.ceded_premium',
    name: 'Ceded premium',
    description: 'Ceded premium aggregated from reinsurance facts.',
    category: 'REINSURANCE',
    valueType: MetricValueType.MONEY,
    aggregationType: MetricAggregationType.SUM,
    formulaVersion: 1,
    formulaDescription: 'Sum of ceded premium from analytics daily rollups.',
    supportedDimensions: ['branch_id'],
    supportedPeriods: [
      AnalyticsPeriodType.DAY,
      AnalyticsPeriodType.WEEK,
      AnalyticsPeriodType.MONTH,
      AnalyticsPeriodType.QUARTER,
      AnalyticsPeriodType.YEAR,
    ],
    permission: 'analytics:metrics:read',
    sensitive: true,
    targetSupported: true,
    forecastSupported: false,
    benchmarkSupported: true,
  },
  {
    code: 'tiramis.submission_count',
    name: 'TIRAMIS submissions',
    description: 'Number of TIRAMIS submissions recorded in the period.',
    category: 'TIRAMIS',
    valueType: MetricValueType.NUMBER,
    aggregationType: MetricAggregationType.SUM,
    formulaVersion: 1,
    formulaDescription:
      'Sum of TIRAMIS submission counts from analytics daily rollups.',
    supportedDimensions: ['branch_id'],
    supportedPeriods: [
      AnalyticsPeriodType.DAY,
      AnalyticsPeriodType.WEEK,
      AnalyticsPeriodType.MONTH,
      AnalyticsPeriodType.QUARTER,
      AnalyticsPeriodType.YEAR,
    ],
    permission: 'analytics:metrics:read',
    sensitive: false,
    targetSupported: true,
    forecastSupported: false,
    benchmarkSupported: true,
  },
  {
    code: 'tiramis.success_rate',
    name: 'TIRAMIS success rate',
    description: 'Submission success rate percentage for TIRAMIS traffic.',
    category: 'TIRAMIS',
    valueType: MetricValueType.PERCENTAGE,
    aggregationType: MetricAggregationType.AVERAGE,
    formulaVersion: 1,
    formulaDescription:
      'Average success-rate percentage from analytics daily rollups for the selected period.',
    supportedDimensions: ['branch_id'],
    supportedPeriods: [
      AnalyticsPeriodType.DAY,
      AnalyticsPeriodType.WEEK,
      AnalyticsPeriodType.MONTH,
      AnalyticsPeriodType.QUARTER,
      AnalyticsPeriodType.YEAR,
    ],
    permission: 'analytics:metrics:read',
    sensitive: false,
    targetSupported: true,
    forecastSupported: false,
    benchmarkSupported: true,
  },
];

export default class AnalyticsDefinitionsSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<void> {
    void factoryManager;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hasMetricDefinitionsTable = await this.hasTable(
        queryRunner,
        'analytics_metric_definitions',
      );

      if (!hasMetricDefinitionsTable) {
        console.log(
          '[AnalyticsDefinitionsSeeder] Skipping analytics seed because analytics_metric_definitions does not exist',
        );
        await queryRunner.commitTransaction();
        return;
      }

      for (const definition of METRIC_DEFINITIONS) {
        await queryRunner.query(
          `
          UPDATE analytics_metric_definitions
          SET
            name = $2::varchar,
            description = $3::text,
            category = $4::varchar,
            value_type = $5::varchar,
            aggregation_type = $6::varchar,
            formula_version = $7::int,
            formula_description = $8::text,
            numerator_metric_code = NULL,
            denominator_metric_code = NULL,
            supported_dimensions = $9::jsonb,
            supported_periods = $10::jsonb,
            permission = $11::varchar,
            sensitive = $12::boolean,
            target_supported = $13::boolean,
            forecast_supported = $14::boolean,
            benchmark_supported = $15::boolean,
            updated_at = now()
          WHERE code = $1::varchar
          `,
          [
            definition.code,
            definition.name,
            definition.description,
            definition.category,
            definition.valueType,
            definition.aggregationType,
            definition.formulaVersion,
            definition.formulaDescription,
            JSON.stringify(definition.supportedDimensions),
            JSON.stringify(definition.supportedPeriods),
            definition.permission,
            definition.sensitive,
            definition.targetSupported,
            definition.forecastSupported,
            definition.benchmarkSupported,
          ],
        );

        await queryRunner.query(
          `
          INSERT INTO analytics_metric_definitions (
            code,
            name,
            description,
            category,
            value_type,
            aggregation_type,
            formula_version,
            formula_description,
            numerator_metric_code,
            denominator_metric_code,
            supported_dimensions,
            supported_periods,
            permission,
            sensitive,
            target_supported,
            forecast_supported,
            benchmark_supported,
            created_at,
            updated_at
          )
          SELECT
            $1::varchar,
            $2::varchar,
            $3::text,
            $4::varchar,
            $5::varchar,
            $6::varchar,
            $7::int,
            $8::text,
            NULL,
            NULL,
            $9::jsonb,
            $10::jsonb,
            $11::varchar,
            $12::boolean,
            $13::boolean,
            $14::boolean,
            $15::boolean,
            now(),
            now()
          
          WHERE NOT EXISTS (
            SELECT 1
            FROM analytics_metric_definitions
            WHERE code = $1::varchar
          )
          `,
          [
            definition.code,
            definition.name,
            definition.description,
            definition.category,
            definition.valueType,
            definition.aggregationType,
            definition.formulaVersion,
            definition.formulaDescription,
            JSON.stringify(definition.supportedDimensions),
            JSON.stringify(definition.supportedPeriods),
            definition.permission,
            definition.sensitive,
            definition.targetSupported,
            definition.forecastSupported,
            definition.benchmarkSupported,
          ],
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[AnalyticsDefinitionsSeeder] Seeding failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async hasTable(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const result = await queryRunner.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS "exists"
      `,
      [tableName],
    );

    return Boolean(result[0]?.exists);
  }
}
