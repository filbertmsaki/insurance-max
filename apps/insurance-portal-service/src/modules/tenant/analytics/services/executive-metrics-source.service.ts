import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';

import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PremiumLedgerEntry } from '../../regulatory-compliance/entities/premium-ledger-entry.entity';
import { PremiumLedgerEntryStatus } from '../../regulatory-compliance/enums/regulatory.enums';
import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../../../tiramis/enums/tiramis-submission-status.enum';

export type LiveMetricResult = {
  value: string;
  observationCount: number;
  currencyCode: string | null;
};

@Injectable()
export class ExecutiveMetricsSourceService {
  private static readonly LIVE_METRIC_CODES = new Set([
    'policy.issued_count',
    'premium.gross_written',
    'premium.commission',
    'tiramis.success_rate',
  ]);

  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PremiumLedgerEntry)
    private readonly premiumLedgerRepository: Repository<PremiumLedgerEntry>,
    @InjectRepository(TiramisSubmissionTrackingEntity)
    private readonly tiramisRepository: Repository<TiramisSubmissionTrackingEntity>,
    private readonly dataAccessScopeService: DataAccessScopeService,
  ) {}

  supports(metricCode: string): boolean {
    return ExecutiveMetricsSourceService.LIVE_METRIC_CODES.has(metricCode);
  }

  async compute(
    metricCode: string,
    user: AuthenticatedUser,
    periodStart: string,
    periodEnd: string,
  ): Promise<LiveMetricResult | null> {
    switch (metricCode) {
      case 'policy.issued_count':
        return this.computeIssuedCount(user, periodStart, periodEnd);
      case 'premium.gross_written':
        return this.computePremiumSum(
          user,
          periodStart,
          periodEnd,
          'gross_written_premium',
        );
      case 'premium.commission':
        return this.computePremiumSum(
          user,
          periodStart,
          periodEnd,
          'commission_amount',
        );
      case 'tiramis.success_rate':
        return this.computeTiramisSuccessRate(user, periodStart, periodEnd);
      default:
        return null;
    }
  }

  private async computeIssuedCount(
    user: AuthenticatedUser,
    periodStart: string,
    periodEnd: string,
  ): Promise<LiveMetricResult> {
    const scope = this.dataAccessScopeService.resolve(user);

    const queryBuilder = this.policyRepository
      .createQueryBuilder('policy')
      .andWhere('policy.deleted_at IS NULL')
      .andWhere("policy.policy_status NOT IN ('CANCELLED', 'VOID')")
      .andWhere('policy.issue_date >= :periodStart', { periodStart })
      .andWhere('policy.issue_date <= :periodEnd', { periodEnd });

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      scope,
    );

    const total = await queryBuilder.getCount();

    return {
      value: String(total),
      observationCount: total,
      currencyCode: null,
    };
  }

  private async computePremiumSum(
    user: AuthenticatedUser,
    periodStart: string,
    periodEnd: string,
    column: 'gross_written_premium' | 'commission_amount',
  ): Promise<LiveMetricResult> {
    const scope = this.dataAccessScopeService.resolve(user);

    const result = await this.premiumLedgerRepository
      .createQueryBuilder('entry')
      .select(`COALESCE(SUM(entry.${column}), 0)`, 'total')
      .addSelect('COUNT(*)', 'entry_count')
      .where('entry.company_id = :companyId', { companyId: scope.companyId })
      .andWhere('entry.status = :status', {
        status: PremiumLedgerEntryStatus.POSTED,
      })
      .andWhere('entry.transaction_date >= :periodStart', { periodStart })
      .andWhere('entry.transaction_date <= :periodEnd', { periodEnd })
      .getRawOne<{ total: string; entry_count: string }>();

    return {
      value: String(result?.total ?? '0'),
      observationCount: Number(result?.entry_count ?? 0),
      currencyCode: 'TZS',
    };
  }

  private async computeTiramisSuccessRate(
    user: AuthenticatedUser,
    periodStart: string,
    periodEnd: string,
  ): Promise<LiveMetricResult> {
    const scope = this.dataAccessScopeService.resolve(user);

    const queryBuilder = this.tiramisRepository
      .createQueryBuilder('tracking')
      .andWhere('tracking.deleted_at IS NULL')
      .andWhere('tracking.source_company_id = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere('tracking.created_at >= :periodStart', {
        periodStart: `${periodStart}T00:00:00.000Z`,
      })
      .andWhere('tracking.created_at <= :periodEnd', {
        periodEnd: `${periodEnd}T23:59:59.999Z`,
      });

    const total = await queryBuilder.getCount();

    if (total === 0) {
      return {
        value: '0',
        observationCount: 0,
        currencyCode: null,
      };
    }

    const success = await queryBuilder
      .clone()
      .andWhere('tracking.status = :successStatus', {
        successStatus: TiramisSubmissionStatus.FINAL_SUCCESS,
      })
      .getCount();

    const rate = (success / total) * 100;

    return {
      value: rate.toFixed(2),
      observationCount: total,
      currencyCode: null,
    };
  }
}
