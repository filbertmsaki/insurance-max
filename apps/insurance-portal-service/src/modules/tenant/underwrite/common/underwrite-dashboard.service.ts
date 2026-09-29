import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PolicyTransactionType,
  quotationFlowForUnderwriteLine,
  UNDERWRITE_LINES,
  UnderwriteAction,
  underwritePermission,
  UnderwriteLine,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { Policy } from '../../policies/entities/policy.entity';
import { policyBusinessLineSql } from '../../policies/utils/policy-business-line.sql';
import { PolicyRenewal } from '../../policy-transactions/entities/policy-renewal.entity';
import { PolicyTransaction } from '../../policy-transactions/entities/policy-transaction.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationStatus } from '../../quotations/enums/quotation-status.enum';
import { TiraStatus } from '../../quotations/enums/tira-status.enum';
import { userHasPermission } from './underwrite-line.access';

const RENEWAL_DUE_WINDOW_DAYS = 30;
const LIVE_POLICY_STATUSES = ['ACTIVE', 'ENDORSED', 'COVER_NOTE_ISSUED'];

export interface UnderwriteQuotationStats {
  total: number;
  draft: number;
  pending_requirements: number;
  pending_approval: number;
  ready_for_submission: number;
  tira_in_progress: number;
  tira_failed: number;
  completed: number;
}

export interface UnderwritePolicyStats {
  total: number;
  active: number;
  renewals_due: number;
  cancelled: number;
  expired: number;
}

export interface UnderwriteFleetStats {
  /** Live fleet policies. */
  active_fleets: number;
  /** Vehicles (policy risks) covered by live fleet policies. */
  covered_vehicles: number;
}

export interface UnderwriteTransactionStats {
  renewals: number;
  endorsements: number;
  cancellations: number;
  tira_pending: number;
}

export interface UnderwriteLineSummary {
  line: UnderwriteLine;
  quotations: UnderwriteQuotationStats | null;
  policies: UnderwritePolicyStats | null;
  transactions: UnderwriteTransactionStats | null;
  /** Only for the FLEET line, when policies are visible. */
  fleet: UnderwriteFleetStats | null;
  /** Only for the NON_MOTOR line, when policies are visible. */
  by_class: UnderwriteClassStats[] | null;
}

export interface UnderwriteClassStats {
  category_id: string | null;
  category_name: string;
  policies: number;
  active: number;
}

/**
 * Line dashboards. Counts use the same data-scope helpers as the list
 * endpoints, so statistics never include records the user cannot open.
 * Sections the user has no permission for are returned as `null`.
 */
@Injectable()
export class UnderwriteDashboardService {
  constructor(
    private readonly dataAccessScopeService: DataAccessScopeService,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyRenewal)
    private readonly renewalRepository: Repository<PolicyRenewal>,
  ) {}

  async getOverview(user: AuthenticatedUser): Promise<UnderwriteLineSummary[]> {
    const visibleLines = UNDERWRITE_LINES.filter((definition) =>
      this.canViewLine(user, definition.line),
    );

    return Promise.all(
      visibleLines.map((definition) =>
        this.getLineSummary(user, definition.line),
      ),
    );
  }

  async getLineSummary(
    user: AuthenticatedUser,
    line: UnderwriteLine,
  ): Promise<UnderwriteLineSummary> {
    const canViewQuotations =
      userHasPermission(
        user,
        underwritePermission(line, UnderwriteAction.VIEW),
      ) && userHasPermission(user, 'quotations:read');
    const canViewPolicies =
      userHasPermission(
        user,
        underwritePermission(line, UnderwriteAction.POLICIES_VIEW),
      ) && userHasPermission(user, 'policies:read');
    const transactionVisibility = this.transactionVisibility(user, line);

    const [quotations, policies, transactions, fleet, byClass] =
      await Promise.all([
        canViewQuotations ? this.quotationStats(user, line) : null,
        canViewPolicies ? this.policyStats(user, line) : null,
        transactionVisibility.any
          ? this.transactionStats(user, line, transactionVisibility)
          : null,
        canViewPolicies && line === UnderwriteLine.FLEET
          ? this.fleetStats(user)
          : null,
        canViewPolicies && line === UnderwriteLine.NON_MOTOR
          ? this.classStats(user)
          : null,
      ]);

    return {
      line,
      quotations,
      policies,
      transactions,
      fleet,
      by_class: byClass,
    };
  }

  private async classStats(
    user: AuthenticatedUser,
  ): Promise<UnderwriteClassStats[]> {
    const scope = this.dataAccessScopeService.resolve(user);
    const queryBuilder = this.policyRepository
      .createQueryBuilder('policy')
      .leftJoin('policy.category', 'category')
      .select('category.id', 'category_id')
      .addSelect('category.name', 'category_name')
      .addSelect('COUNT(*)', 'policies')
      .addSelect(
        `COUNT(*) FILTER (WHERE policy.policy_status IN (:...liveStatuses))`,
        'active',
      )
      .where('policy.deleted_at IS NULL')
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, {
        line: UnderwriteLine.NON_MOTOR,
      })
      .setParameters({ liveStatuses: LIVE_POLICY_STATUSES })
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('COUNT(*)', 'DESC');

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      scope,
    );

    const rows = await queryBuilder.getRawMany<Record<string, string | null>>();
    return rows.map((row) => ({
      category_id: row.category_id,
      category_name: row.category_name ?? 'Unclassified',
      policies: toCount(row.policies ?? undefined),
      active: toCount(row.active ?? undefined),
    }));
  }

  private canViewLine(user: AuthenticatedUser, line: UnderwriteLine): boolean {
    return [
      UnderwriteAction.VIEW,
      UnderwriteAction.POLICIES_VIEW,
      UnderwriteAction.RENEWALS_VIEW,
      UnderwriteAction.ENDORSEMENTS_VIEW,
      UnderwriteAction.CANCELLATIONS_VIEW,
      UnderwriteAction.TIRA_RETRY,
    ].some((action) =>
      userHasPermission(user, underwritePermission(line, action)),
    );
  }

  private transactionVisibility(user: AuthenticatedUser, line: UnderwriteLine) {
    const renewals =
      userHasPermission(
        user,
        underwritePermission(line, UnderwriteAction.RENEWALS_VIEW),
      ) && userHasPermission(user, 'renewals:read');
    const endorsements =
      userHasPermission(
        user,
        underwritePermission(line, UnderwriteAction.ENDORSEMENTS_VIEW),
      ) && userHasPermission(user, 'endorsements:create');
    const cancellations =
      userHasPermission(
        user,
        underwritePermission(line, UnderwriteAction.CANCELLATIONS_VIEW),
      ) && userHasPermission(user, 'cancellations:read');
    const tiraPending =
      userHasPermission(
        user,
        underwritePermission(line, UnderwriteAction.TIRA_RETRY),
      ) &&
      [
        'quotations:retry-tiramis',
        'endorsements:retry-tiramis',
        'cancellations:submit-tiramis',
      ].some((permission) => userHasPermission(user, permission));

    return {
      renewals,
      endorsements,
      cancellations,
      tiraPending,
      any: renewals || endorsements || cancellations || tiraPending,
    };
  }

  private async transactionStats(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    visibility: ReturnType<UnderwriteDashboardService['transactionVisibility']>,
  ): Promise<UnderwriteTransactionStats> {
    const [
      renewals,
      endorsements,
      cancellations,
      pendingQuotationTira,
      pendingTransactionTira,
    ] = await Promise.all([
      visibility.renewals ? this.renewalCount(user, line) : 0,
      visibility.endorsements
        ? this.transactionCount(
            user,
            line,
            PolicyTransactionType.ENDORSEMENT,
          )
        : 0,
      visibility.cancellations
        ? this.transactionCount(
            user,
            line,
            PolicyTransactionType.CANCELLATION,
          )
        : 0,
      visibility.tiraPending ? this.pendingQuotationTiraCount(user, line) : 0,
      visibility.tiraPending ? this.pendingTransactionTiraCount(user, line) : 0,
    ]);

    return {
      renewals,
      endorsements,
      cancellations,
      tira_pending: pendingQuotationTira + pendingTransactionTira,
    };
  }

  private async renewalCount(
    user: AuthenticatedUser,
    line: UnderwriteLine,
  ): Promise<number> {
    const queryBuilder = this.renewalRepository
      .createQueryBuilder('renewal')
      .innerJoin(
        PolicyTransaction,
        'transaction',
        'transaction.id = renewal.policy_transaction_id',
      )
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .select('COUNT(*)', 'total')
      .where('renewal.company_id = :companyId', { companyId: user.companyId! })
      .andWhere('transaction.transaction_type = :transactionType', {
        transactionType: PolicyTransactionType.RENEWAL,
      })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line });

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      this.dataAccessScopeService.resolve(user),
    );

    const row = await queryBuilder.getRawOne<Record<string, string>>();
    return toCount(row?.total);
  }

  private async transactionCount(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    transactionType: PolicyTransactionType,
  ): Promise<number> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .select('COUNT(*)', 'total')
      .where('transaction.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere('transaction.transaction_type = :transactionType', {
        transactionType,
      })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line });

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      this.dataAccessScopeService.resolve(user),
    );

    const row = await queryBuilder.getRawOne<Record<string, string>>();
    return toCount(row?.total);
  }

  private async pendingQuotationTiraCount(
    user: AuthenticatedUser,
    line: UnderwriteLine,
  ): Promise<number> {
    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .select('COUNT(*)', 'total')
      .where('quotation.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere('quotation.quotation_flow = :quotationFlow', {
        quotationFlow: quotationFlowForUnderwriteLine(line),
      })
      .andWhere('quotation.deleted_at IS NULL')
      .andWhere(
        `(quotation.tira_status IN (:...tiraStatuses)
          OR quotation.status IN (:...quotationStatuses))`,
        {
          tiraStatuses: [
            TiraStatus.SUBMITTING,
            TiraStatus.SUBMITTED,
            TiraStatus.PROCESSING,
          ],
          quotationStatuses: [
            QuotationStatus.SUBMITTING_TO_TIRA,
            QuotationStatus.SUBMITTED_TO_TIRA,
            QuotationStatus.TIRA_PROCESSING,
          ],
        },
      );

    this.dataAccessScopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      this.dataAccessScopeService.resolve(user),
    );

    const row = await queryBuilder.getRawOne<Record<string, string>>();
    return toCount(row?.total);
  }

  private async pendingTransactionTiraCount(
    user: AuthenticatedUser,
    line: UnderwriteLine,
  ): Promise<number> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .select('COUNT(*)', 'total')
      .where('transaction.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere('transaction.transaction_type IN (:...transactionTypes)', {
        transactionTypes: [
          PolicyTransactionType.ENDORSEMENT,
          PolicyTransactionType.CANCELLATION,
        ],
      })
      .andWhere('transaction.submission_status IN (:...statuses)', {
        statuses: [
          WorkflowSubmissionStatus.READY,
          WorkflowSubmissionStatus.QUEUED,
          WorkflowSubmissionStatus.PROCESSING,
          WorkflowSubmissionStatus.ACKNOWLEDGED,
        ],
      })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line });

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      this.dataAccessScopeService.resolve(user),
    );

    const row = await queryBuilder.getRawOne<Record<string, string>>();
    return toCount(row?.total);
  }

  private async quotationStats(
    user: AuthenticatedUser,
    line: UnderwriteLine,
  ): Promise<UnderwriteQuotationStats> {
    const scope = this.dataAccessScopeService.resolve(user);
    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE quotation.status = 'DRAFT')`, 'draft')
      .addSelect(
        `COUNT(*) FILTER (WHERE quotation.status = 'PENDING_REQUIREMENTS')`,
        'pending_requirements',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE quotation.approval_status_v2 = 'PENDING')`,
        'pending_approval',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE quotation.status = 'READY_FOR_SUBMISSION')`,
        'ready_for_submission',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE quotation.status IN ('SUBMITTING_TO_TIRA', 'SUBMITTED_TO_TIRA', 'TIRA_PROCESSING'))`,
        'tira_in_progress',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE quotation.status = 'FAILED' OR quotation.tira_status IN ('FAILED', 'REJECTED'))`,
        'tira_failed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE quotation.status = 'COMPLETED')`,
        'completed',
      )
      .where('quotation.deleted_at IS NULL')
      .andWhere('quotation.source_policy_transaction_id IS NULL')
      .andWhere('quotation.quotation_flow = :flow', {
        flow: quotationFlowForUnderwriteLine(line),
      });

    this.dataAccessScopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      scope,
    );

    const row = await queryBuilder.getRawOne<Record<string, string>>();
    return {
      total: toCount(row?.total),
      draft: toCount(row?.draft),
      pending_requirements: toCount(row?.pending_requirements),
      pending_approval: toCount(row?.pending_approval),
      ready_for_submission: toCount(row?.ready_for_submission),
      tira_in_progress: toCount(row?.tira_in_progress),
      tira_failed: toCount(row?.tira_failed),
      completed: toCount(row?.completed),
    };
  }

  private async policyStats(
    user: AuthenticatedUser,
    line: UnderwriteLine,
  ): Promise<UnderwritePolicyStats> {
    const scope = this.dataAccessScopeService.resolve(user);
    const queryBuilder = this.policyRepository
      .createQueryBuilder('policy')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE policy.policy_status IN (:...liveStatuses))`,
        'active',
      )
      .addSelect(
        `COUNT(*) FILTER (
          WHERE policy.policy_status IN (:...liveStatuses)
            AND policy.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + CAST(:renewalWindow AS integer)
            AND policy.renewed_to_policy_id IS NULL
        )`,
        'renewals_due',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE policy.policy_status = 'CANCELLED')`,
        'cancelled',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE policy.policy_status = 'EXPIRED')`,
        'expired',
      )
      .where('policy.deleted_at IS NULL')
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line })
      .setParameters({
        liveStatuses: LIVE_POLICY_STATUSES,
        renewalWindow: RENEWAL_DUE_WINDOW_DAYS,
      });

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      scope,
    );

    const row = await queryBuilder.getRawOne<Record<string, string>>();
    return {
      total: toCount(row?.total),
      active: toCount(row?.active),
      renewals_due: toCount(row?.renewals_due),
      cancelled: toCount(row?.cancelled),
      expired: toCount(row?.expired),
    };
  }

  private async fleetStats(
    user: AuthenticatedUser,
  ): Promise<UnderwriteFleetStats> {
    const scope = this.dataAccessScopeService.resolve(user);
    // One row per policy (no joins), so SUM of the per-policy vehicle count
    // is the number of covered vehicles.
    const queryBuilder = this.policyRepository
      .createQueryBuilder('policy')
      .select('COUNT(*)', 'active_fleets')
      .addSelect(
        `COALESCE(SUM((
          SELECT COUNT(*)
            FROM policy_risks fleet_risk
           WHERE fleet_risk.policy_id = policy.id
             AND fleet_risk.deleted_at IS NULL
        )), 0)`,
        'covered_vehicles',
      )
      .where('policy.deleted_at IS NULL')
      .andWhere('policy.policy_status IN (:...liveStatuses)', {
        liveStatuses: LIVE_POLICY_STATUSES,
      })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, {
        line: UnderwriteLine.FLEET,
      });

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      scope,
    );

    const row = await queryBuilder.getRawOne<Record<string, string>>();
    return {
      active_fleets: toCount(row?.active_fleets),
      covered_vehicles: toCount(row?.covered_vehicles),
    };
  }
}

function toCount(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
