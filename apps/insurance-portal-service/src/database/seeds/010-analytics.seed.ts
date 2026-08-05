import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Company } from '../../modules/platform/companies/entities/company.entity';

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
      const targetCompanyCode =
        process.env.SEED_TARGET_COMPANY_CODE ?? 'ICC110';

      const company = await queryRunner.manager.getRepository(Company).findOne({
        where: {
          tira_company_code: targetCompanyCode,
        },
      });

      if (!company) {
        throw new Error(
          `[AnalyticsDefinitionsSeeder] Seed target company not found (${targetCompanyCode})`,
        );
      }

      await queryRunner.query(
        `
        INSERT INTO analytics_kpi_definitions (
          code,
          name,
          description,
          category,
          calculator_key,
          value_type,
          direction,
          applicable_company_types,
          default_target,
          default_warning_threshold,
          default_critical_threshold,
          effective_from,
          is_active,
          metadata
        )
        SELECT $1::varchar,$2::varchar,$3::text,$4::varchar,$5::varchar,$6::varchar,$7::varchar,$8::jsonb,$9::numeric,$10::numeric,$11::numeric,$12::date,$13::boolean,$14::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_kpi_definitions
          WHERE code = $1::varchar
            AND effective_from = $12::date
        )
        `,
        [
          'policy.issued_count',
          'Issued Policies',
          'Total number of policies issued during the period',
          'Policy',
          'policy.issued_count',
          'number',
          'higher-is-better',
          JSON.stringify(['insurance_company', 'broker']),
          100,
          80,
          50,
          new Date().toISOString().split('T')[0],
          true,
          JSON.stringify({ unit: 'count' }),
        ],
      );

      await queryRunner.query(
        `
        INSERT INTO analytics_kpi_definitions (
          code,
          name,
          description,
          category,
          calculator_key,
          value_type,
          direction,
          applicable_company_types,
          default_target,
          default_warning_threshold,
          default_critical_threshold,
          effective_from,
          is_active,
          metadata
        )
        SELECT $1::varchar,$2::varchar,$3::text,$4::varchar,$5::varchar,$6::varchar,$7::varchar,$8::jsonb,$9::numeric,$10::numeric,$11::numeric,$12::date,$13::boolean,$14::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_kpi_definitions
          WHERE code = $1::varchar
            AND effective_from = $12::date
        )
        `,
        [
          'premium.gross_written',
          'Gross Written Premium',
          'Total premiums written for the selected period',
          'Premium',
          'premium.gross_written',
          'currency',
          'higher-is-better',
          JSON.stringify(['insurance_company', 'broker']),
          1000000,
          700000,
          300000,
          new Date().toISOString().split('T')[0],
          true,
          JSON.stringify({ currency: 'NGN' }),
        ],
      );

      await queryRunner.query(
        `
        INSERT INTO analytics_kpi_definitions (
          code,
          name,
          description,
          category,
          calculator_key,
          value_type,
          direction,
          applicable_company_types,
          default_target,
          default_warning_threshold,
          default_critical_threshold,
          effective_from,
          is_active,
          metadata
        )
        SELECT $1::varchar,$2::varchar,$3::text,$4::varchar,$5::varchar,$6::varchar,$7::varchar,$8::jsonb,$9::numeric,$10::numeric,$11::numeric,$12::date,$13::boolean,$14::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_kpi_definitions
          WHERE code = $1::varchar
            AND effective_from = $12::date
        )
        `,
        [
          'tiramis.success_rate',
          'TIRAMIS Success Rate',
          'Percentage of successful TIRAMIS integrations',
          'TIRAMIS',
          'tiramis.success_rate',
          'percentage',
          'higher-is-better',
          JSON.stringify(['insurance_company', 'broker']),
          98,
          95,
          90,
          new Date().toISOString().split('T')[0],
          true,
          JSON.stringify({ unit: 'percent' }),
        ],
      );

      await queryRunner.query(
        `
        INSERT INTO analytics_scorecard_templates (
          company_id,
          code,
          name,
          applicable_company_types,
          is_default,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        SELECT $1::uuid,$2::varchar,$3::varchar,$4::jsonb,$5::boolean,$6::boolean,$7::uuid,now(),now()
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_scorecard_templates
          WHERE code = $2::varchar
            AND company_id = $1::uuid
        )
        `,
        [
          company.id,
          'executive-analytics',
          'Executive Analytics Scorecard',
          JSON.stringify(['insurance_company', 'broker']),
          true,
          true,
          company.id,
        ],
      );

      await queryRunner.query(
        `
        INSERT INTO analytics_scorecard_template_items (
          template_id,
          kpi_definition_id,
          display_order,
          weight,
          target_value,
          warning_threshold,
          critical_threshold,
          is_required,
          created_at
        )
        SELECT template.id, kpi.id, item.order_index, item.weight, item.target, item.warning, item.critical, true, now()
        FROM analytics_scorecard_templates template
        CROSS JOIN (VALUES
          (1, 'policy.issued_count', 0.4, 100, 80, 50),
          (2, 'premium.gross_written', 0.35, 1000000, 700000, 300000),
          (3, 'tiramis.success_rate', 0.25, 98, 95, 90)
        ) AS item(order_index, kpi_code, weight, target, warning, critical)
        JOIN analytics_kpi_definitions kpi
          ON kpi.code = item.kpi_code
        WHERE template.code = $1
          AND template.company_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM analytics_scorecard_template_items
            WHERE template_id = template.id
              AND kpi_definition_id = kpi.id
          )
        `,
        ['executive-analytics', company.id],
      );

      await queryRunner.query(
        `
        INSERT INTO analytics_anomaly_rules (
          company_id,
          code,
          name,
          metric_code,
          method,
          severity,
          lookback_periods,
          minimum_observations,
          configuration,
          dimension_filter,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        SELECT $1::uuid,$2::varchar,$3::varchar,$4::varchar,$5::varchar,$6::varchar,$7::int,$8::int,$9::jsonb,$10::jsonb,$11::boolean,$12::uuid,now(),now()
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_anomaly_rules
          WHERE code = $2::varchar
            AND company_id = $1::uuid
        )
        `,
        [
          company.id,
          'tiramis-success-drop',
          'TIRAMIS Success Rate Drop',
          'tiramis.success_rate',
          'moving-average',
          'MEDIUM',
          14,
          5,
          JSON.stringify({ thresholdPercent: 15 }),
          JSON.stringify({}),
          true,
          company.id,
        ],
      );

      await queryRunner.query(
        `
        INSERT INTO analytics_forecast_definitions (
          company_id,
          code,
          name,
          metric_code,
          method,
          frequency,
          history_periods,
          horizon_periods,
          season_length,
          gap_strategy,
          configuration,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        SELECT $1::uuid,$2::varchar,$3::varchar,$4::varchar,$5::varchar,$6::varchar,$7::int,$8::int,$9::int,$10::varchar,$11::jsonb,$12::boolean,$13::uuid,now(),now()
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_forecast_definitions
          WHERE code = $2::varchar
            AND company_id = $1::uuid
        )
        `,
        [
          company.id,
          'policy-issuance-trend',
          'Policy Issuance Trend',
          'policy.issued_count',
          'linear-regression',
          'DAILY',
          90,
          30,
          7,
          'ZERO',
          JSON.stringify({ seasonality: 'weekly' }),
          true,
          company.id,
        ],
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[AnalyticsDefinitionsSeeder] Seeding failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
