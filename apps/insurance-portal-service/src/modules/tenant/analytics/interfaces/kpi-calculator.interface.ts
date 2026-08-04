import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

export interface KpiCalculationContext {
  user: AuthenticatedUser;

  companyId: string;
  branchId?: string | null;

  periodStart: string;
  periodEnd: string;

  parameters?: Record<
    string,
    unknown
  >;
}

export interface KpiCalculationResult {
  value: string | null;

  numerator?: string | null;
  denominator?: string | null;

  explanation: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface KpiCalculator {
  readonly key: string;

  calculate(
    context:
      KpiCalculationContext,
  ): Promise<KpiCalculationResult>;
}

export const KPI_CALCULATORS =
  Symbol('KPI_CALCULATORS');
