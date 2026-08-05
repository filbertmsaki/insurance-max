import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class AnalyticsRollupService {
  async refresh(
    manager: EntityManager,
    period: {
      company_id: string;
      branch_id: string | null;
      domain: string;
      metric_date: string;
    },
  ): Promise<void> {
    switch (period.domain) {
      case 'POLICY':
        await this.refreshPolicyMetrics(manager, period);
        return;

      case 'PREMIUM':
        await this.refreshPremiumMetrics(manager, period);
        return;

      case 'CLAIM':
        await this.refreshClaimMetrics(manager, period);
        return;

      case 'REINSURANCE':
        await this.refreshReinsuranceMetrics(manager, period);
        return;

      case 'TIRAMIS':
        await this.refreshTiramisMetrics(manager, period);
        return;
    }
  }

  private async refreshPolicyMetrics(
    manager: EntityManager,
    period: {
      company_id: string;
      branch_id: string | null;
      metric_date: string;
    },
  ) {
    const values = await manager.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE policy_status NOT IN (
              'CANCELLED',
              'VOID'
            )
          )::numeric AS issued_count,

          COALESCE(
            SUM(gross_premium)
            FILTER (
              WHERE policy_status NOT IN (
                'CANCELLED',
                'VOID'
              )
            ),
            0
          ) AS written_premium,

          COALESCE(
            SUM(sum_insured)
            FILTER (
              WHERE policy_status NOT IN (
                'CANCELLED',
                'VOID'
              )
            ),
            0
          ) AS sum_insured
        FROM analytics_policy_facts
        WHERE
          insurer_company_id = $1
          AND issue_date = $2
          AND (
            $3::uuid IS NULL
            OR branch_id = $3
          )
        `,
      [period.company_id, period.metric_date, period.branch_id],
    );

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'policy.issued_count',

      value: values[0]?.issued_count ?? 0,

      observationCount: values[0]?.issued_count ?? 0,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'policy.written_premium',

      value: values[0]?.written_premium ?? 0,

      observationCount: values[0]?.issued_count ?? 0,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'policy.sum_insured',

      value: values[0]?.sum_insured ?? 0,

      observationCount: values[0]?.issued_count ?? 0,
    });
  }

  private async refreshPremiumMetrics(
    manager: EntityManager,
    period: {
      company_id: string;
      branch_id: string | null;
      metric_date: string;
    },
  ) {
    const values = await manager.query(
      `
        SELECT
          COALESCE(
            SUM(gross_premium),
            0
          ) AS gross_premium,

          COALESCE(
            SUM(tax_amount),
            0
          ) AS tax_amount,

          COALESCE(
            SUM(commission_amount),
            0
          ) AS commission_amount,

          COUNT(*)::numeric
            AS entry_count
        FROM analytics_premium_facts
        WHERE
          company_id = $1
          AND effective_date = $2
          AND status = 'POSTED'
          AND (
            $3::uuid IS NULL
            OR branch_id = $3
          )
        `,
      [period.company_id, period.metric_date, period.branch_id],
    );

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'premium.gross_written',

      value: values[0]?.gross_premium ?? 0,

      observationCount: values[0]?.entry_count ?? 0,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'premium.commission',

      value: values[0]?.commission_amount ?? 0,

      observationCount: values[0]?.entry_count ?? 0,
    });
  }

  private async refreshClaimMetrics(
    manager: EntityManager,
    period: {
      company_id: string;
      branch_id: string | null;
      metric_date: string;
    },
  ) {
    const values = await manager.query(
      `
        SELECT
          COUNT(*)::numeric
            AS reported_count,

          COALESCE(
            SUM(approved_amount),
            0
          ) AS approved_amount,

          COALESCE(
            SUM(paid_amount),
            0
          ) AS paid_amount,

          COALESCE(
            SUM(outstanding_reserve),
            0
          ) AS outstanding_reserve
        FROM analytics_claim_facts
        WHERE
          company_id = $1
          AND report_date::date = $2
          AND (
            $3::uuid IS NULL
            OR branch_id = $3
          )
        `,
      [period.company_id, period.metric_date, period.branch_id],
    );

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'claim.reported_count',

      value: values[0]?.reported_count ?? 0,

      observationCount: values[0]?.reported_count ?? 0,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'claim.approved_amount',

      value: values[0]?.approved_amount ?? 0,

      observationCount: values[0]?.reported_count ?? 0,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'claim.paid_amount',

      value: values[0]?.paid_amount ?? 0,

      observationCount: values[0]?.reported_count ?? 0,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'claim.outstanding_reserve',

      value: values[0]?.outstanding_reserve ?? 0,

      observationCount: values[0]?.reported_count ?? 0,
    });
  }

  private async refreshReinsuranceMetrics(
    manager: EntityManager,
    period: {
      company_id: string;
      branch_id: string | null;
      metric_date: string;
    },
  ) {
    const values = await manager.query(
      `
        SELECT
          COALESCE(
            SUM(ceded_premium),
            0
          ) AS ceded_premium,

          COALESCE(
            SUM(ceded_sum_insured),
            0
          ) AS ceded_sum_insured,

          COUNT(*)::numeric
            AS cession_count
        FROM analytics_reinsurance_facts
        WHERE
          company_id = $1
          AND effective_from = $2
          AND cession_status IN (
            'ACTIVE',
            'DECLARED'
          )
          AND (
            $3::uuid IS NULL
            OR branch_id = $3
          )
        `,
      [period.company_id, period.metric_date, period.branch_id],
    );

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'reinsurance.ceded_premium',

      value: values[0]?.ceded_premium ?? 0,

      observationCount: values[0]?.cession_count ?? 0,
    });
  }

  private async refreshTiramisMetrics(
    manager: EntityManager,
    period: {
      company_id: string;
      branch_id: string | null;
      metric_date: string;
    },
  ) {
    const values = await manager.query(
      `
        SELECT
          COUNT(*)::numeric
            AS submission_count,

          COUNT(*) FILTER (
            WHERE successful = true
          )::numeric
            AS success_count,

          COALESCE(
            AVG(processing_duration_ms),
            0
          ) AS average_duration_ms
        FROM analytics_tiramis_facts
        WHERE
          company_id = $1
          AND submitted_at::date = $2
          AND (
            $3::uuid IS NULL
            OR branch_id = $3
          )
        `,
      [period.company_id, period.metric_date, period.branch_id],
    );

    const total = Number(values[0]?.submission_count ?? 0);

    const success = Number(values[0]?.success_count ?? 0);

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'tiramis.submission_count',

      value: total,
      observationCount: total,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'tiramis.success_rate',

      value: total > 0 ? (success / total) * 100 : 0,

      observationCount: total,
    });

    await this.upsertMetric(manager, {
      ...period,
      metricCode: 'tiramis.average_duration_ms',

      value: values[0]?.average_duration_ms ?? 0,

      observationCount: total,
    });
  }

  private async upsertMetric(
    manager: EntityManager,
    params: {
      company_id: string;
      branch_id: string | null;
      metric_date: string;
      metricCode: string;
      value: string | number;
      observationCount: string | number;
      dimensionKey?: string;
      dimensions?: Record<string, unknown>;
      currency?: string | null;
    },
  ) {
    await manager.query(
      `
      INSERT INTO analytics_daily_metrics (
        company_id,
        branch_id,
        metric_date,
        metric_code,
        dimension_key,
        dimensions,
        metric_value,
        observation_count,
        currency,
        calculated_at,
        projection_version
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        now(),
        $10
      )
      ON CONFLICT (
        company_id,
        COALESCE(
          branch_id,
          '00000000-0000-0000-0000-000000000000'
        ),
        metric_date,
        metric_code,
        dimension_key
      )
      DO UPDATE SET
        dimensions =
          EXCLUDED.dimensions,
        metric_value =
          EXCLUDED.metric_value,
        observation_count =
          EXCLUDED.observation_count,
        currency =
          EXCLUDED.currency,
        calculated_at = now(),
        projection_version =
          EXCLUDED.projection_version
      `,
      [
        params.company_id,
        params.branch_id,
        params.metric_date,
        params.metricCode,
        params.dimensionKey ?? 'default',
        params.dimensions ?? {},
        params.value,
        params.observationCount,
        params.currency ?? null,
        Date.now().toString(),
      ],
    );
  }
}
