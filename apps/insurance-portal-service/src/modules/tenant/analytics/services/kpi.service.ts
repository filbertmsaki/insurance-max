import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  KPI_CALCULATORS,
  KpiCalculator,
  KpiCalculationContext,
  KpiCalculationResult,
} from '../interfaces/kpi-calculator.interface';
import { AnalyticsService } from './analytics.service';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

@Injectable()
export class KpiService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @Inject(KPI_CALCULATORS)
    private readonly calculators: KpiCalculator[] = [],
  ) {}

  async listDefinitions(companyId: string) {
    return this.analyticsService.listKpiDefinitions();
  }

  async calculateKpi(
    user: AuthenticatedUser,
    code: string,
    query: {
      from?: string;
      to?: string;
      branchId?: string | null;
    },
  ): Promise<KpiCalculationResult> {
    if (!user.companyId) {
      throw new NotFoundException(
        'Company context is required for KPI calculations',
      );
    }

    const companyId = user.companyId;
    const definition = await this.analyticsService.getKpiDefinition(code);

    if (!definition) {
      throw new NotFoundException(`KPI definition not found: ${code}`);
    }

    const calculator = this.calculators.find(
      (candidate) =>
        candidate.key === definition.calculator_key || candidate.key === code,
    );

    const context: KpiCalculationContext = {
      user,
      companyId,
      branchId: query.branchId ?? null,
      periodStart: query.from ?? new Date().toISOString().slice(0, 10),
      periodEnd: query.to ?? new Date().toISOString().slice(0, 10),
      parameters: {
        metricCode: code,
        branchId: query.branchId,
      },
    };

    if (calculator) {
      return calculator.calculate(context);
    }

    const values = await this.analyticsService.getDailyMetrics({
      companyId: user.companyId,
      branchId: query.branchId ?? null,
      metricCode: code,
      from: query.from,
      to: query.to,
    });

    const total = values.reduce(
      (sum, row) => sum + Number(row.metricValue ?? 0),
      0,
    );

    return {
      value: String(total),
      numerator: String(total),
      denominator: null,
      explanation: `Fallback KPI calculation based on metric ${code} for the requested period`,
      metadata: {
        itemCount: values.length,
        from: query.from ?? null,
        to: query.to ?? null,
      },
    };
  }
}
