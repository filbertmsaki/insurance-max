import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  AnalyticsAggregateType,
  AnalyticsEventType,
} from '../enums/analytics.enums';
import { AnalyticsProjectionEvent } from '../entities/analytics-projection-event.entity';
import { AnalyticsDirtyPeriodService } from '../services/analytics-dirty-period.service';
import { AnalyticsProjectionHandler } from '../interfaces/analytics-projection-handler.interface';

@Injectable()
export class PolicyProjectionHandler
  implements AnalyticsProjectionHandler
{
  readonly aggregateType =
    AnalyticsAggregateType.POLICY;

  constructor(
    private readonly dirtyPeriodService: AnalyticsDirtyPeriodService,
  ) {}

  async project(
    manager: EntityManager,
    event: AnalyticsProjectionEvent,
  ): Promise<void> {
    const payload = event.payload as Record<
      string,
      unknown
    >;
    const metricDate = String(
      payload.issue_date ??
        payload.start_date ??
        payload.projected_at ??
        new Date().toISOString().slice(0, 10),
    );

    const issueDate = String(
      payload.issue_date ?? payload.start_date ?? metricDate,
    );
    const startDate = String(payload.start_date ?? issueDate);
    const endDate = String(payload.end_date ?? startDate);
    const policyNo = String(
      payload.policy_no ?? event.aggregate_id,
    );
    const policyStatus = String(
      payload.policy_status ?? 'UNKNOWN',
    );
    const currency = String(
      payload.currency ?? 'UNKNOWN',
    );

    if (!payload.category_id) {
      throw new Error('Analytics policy projection requires category_id');
    }
    if (!payload.product_id) {
      throw new Error('Analytics policy projection requires product_id');
    }
    if (!payload.customer_id) {
      throw new Error('Analytics policy projection requires customer_id');
    }

    if (
      event.event_type ===
        AnalyticsEventType.DELETED ||
      event.event_type ===
        AnalyticsEventType.REVERSED
    ) {
      await manager.query(
        `
        DELETE FROM analytics_policy_facts
        WHERE policy_id = $1
        `,
        [event.aggregate_id],
      );
    } else {
      await manager.query(
        `
        INSERT INTO analytics_policy_facts (
          policy_id,
          company_id,
          insurer_company_id,
          intermediary_company_id,
          branch_id,
          department_id,
          category_id,
          product_id,
          sub_class_id,
          customer_id,
          policy_no,
          channel_type,
          policy_status,
          issue_date,
          start_date,
          end_date,
          currency,
          sum_insured,
          basic_premium,
          gross_premium,
          net_premium,
          tax_amount,
          commission_amount,
          retention_amount,
          ceded_sum_insured,
          ceded_premium,
          reinsurance_required,
          tiramis_status,
          source_created_at,
          source_updated_at,
          projected_at,
          projection_version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
        )
        ON CONFLICT (policy_id)
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          insurer_company_id = EXCLUDED.insurer_company_id,
          intermediary_company_id = EXCLUDED.intermediary_company_id,
          branch_id = EXCLUDED.branch_id,
          department_id = EXCLUDED.department_id,
          category_id = EXCLUDED.category_id,
          product_id = EXCLUDED.product_id,
          sub_class_id = EXCLUDED.sub_class_id,
          customer_id = EXCLUDED.customer_id,
          policy_no = EXCLUDED.policy_no,
          channel_type = EXCLUDED.channel_type,
          policy_status = EXCLUDED.policy_status,
          issue_date = EXCLUDED.issue_date,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          currency = EXCLUDED.currency,
          sum_insured = EXCLUDED.sum_insured,
          basic_premium = EXCLUDED.basic_premium,
          gross_premium = EXCLUDED.gross_premium,
          net_premium = EXCLUDED.net_premium,
          tax_amount = EXCLUDED.tax_amount,
          commission_amount = EXCLUDED.commission_amount,
          retention_amount = EXCLUDED.retention_amount,
          ceded_sum_insured = EXCLUDED.ceded_sum_insured,
          ceded_premium = EXCLUDED.ceded_premium,
          reinsurance_required = EXCLUDED.reinsurance_required,
          tiramis_status = EXCLUDED.tiramis_status,
          source_updated_at = EXCLUDED.source_updated_at,
          projected_at = EXCLUDED.projected_at,
          projection_version = EXCLUDED.projection_version
        `,
        [
          event.aggregate_id,
          event.company_id,
          payload.insurer_company_id ?? event.company_id,
          payload.intermediary_company_id ?? null,
          event.branch_id,
          payload.department_id ?? null,
          payload.category_id ?? null,
          payload.product_id ?? null,
          payload.sub_class_id ?? null,
          payload.customer_id ?? null,
          policyNo,
          payload.channel_type ?? null,
          policyStatus,
          issueDate,
          startDate,
          endDate,
          currency,
          payload.sum_insured ?? 0,
          payload.basic_premium ?? 0,
          payload.gross_premium ?? 0,
          payload.net_premium ?? 0,
          payload.tax_amount ?? 0,
          payload.commission_amount ?? 0,
          payload.retention_amount ?? 0,
          payload.ceded_sum_insured ?? 0,
          payload.ceded_premium ?? 0,
          payload.reinsurance_required ?? false,
          payload.tiramis_status ?? null,
          payload.source_created_at ?? payload.created_at ?? new Date().toISOString(),
          payload.source_updated_at ?? payload.updated_at ?? new Date().toISOString(),
          payload.projected_at ?? new Date().toISOString(),
          event.event_version,
        ],
      );
    }

    await this.dirtyPeriodService.mark(manager, {
      companyId: event.company_id,
      branchId: event.branch_id,
      domain: 'POLICY',
      metricDate,
    });
  }
}
