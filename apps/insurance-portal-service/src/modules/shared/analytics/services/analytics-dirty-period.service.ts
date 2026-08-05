import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class AnalyticsDirtyPeriodService {
  async mark(
    manager: EntityManager,
    params: {
      companyId?: string | null;
      branchId?: string | null;
      domain: string;
      metricDate: string;
    },
  ): Promise<void> {
    if (!params.companyId) {
      throw new Error('Analytics dirty period requires a valid companyId');
    }

    await manager.query(
      `
      INSERT INTO analytics_dirty_periods (
        company_id,
        branch_id,
        domain,
        metric_date,
        status,
        next_attempt_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'PENDING',
        now()
      )
      ON CONFLICT (
        company_id,
        COALESCE(
          branch_id,
          '00000000-0000-0000-0000-000000000000'
        ),
        domain,
        metric_date
      )
      DO UPDATE SET
        status = 'PENDING',
        next_attempt_at = now(),
        last_error = NULL,
        updated_at = now()
      `,
      [
        params.companyId,
        params.branchId ?? null,
        params.domain,
        params.metricDate,
      ],
    );

    if (params.branchId) {
      await manager.query(
        `
        INSERT INTO analytics_dirty_periods (
          company_id,
          branch_id,
          domain,
          metric_date,
          status,
          next_attempt_at
        )
        VALUES (
          $1,
          NULL,
          $2,
          $3,
          'PENDING',
          now()
        )
        ON CONFLICT (
          company_id,
          COALESCE(
            branch_id,
            '00000000-0000-0000-0000-000000000000'
          ),
          domain,
          metric_date
        )
        DO UPDATE SET
          status = 'PENDING',
          next_attempt_at = now(),
          last_error = NULL,
          updated_at = now()
        `,
        [params.companyId, params.domain, params.metricDate],
      );
    }
  }
}
