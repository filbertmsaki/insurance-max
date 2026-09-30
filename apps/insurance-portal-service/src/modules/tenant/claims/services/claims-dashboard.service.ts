import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { CLAIM_QUEUE_STATUSES } from '../claim-lifecycle';
import { InsuranceClaim } from '../entities/claim.entity';
import {
  ClaimQueue,
  ClaimRegulatoryStatus,
  ClaimStatus,
} from '../enums/claim.enums';

export interface ClaimsDashboardQuery {
  from?: string;
  to?: string;
  branch_id?: string;
  product_id?: string;
}

const CLOSED = [
  ClaimStatus.SETTLED,
  ClaimStatus.REJECTED,
  ClaimStatus.CLOSED,
  ClaimStatus.CANCELLED,
];

/**
 * Claims dashboard figures. Every aggregate starts from the same scoped
 * claims query as the claims list, so users only see figures for claims
 * they may open.
 */
@Injectable()
export class ClaimsDashboardService {
  constructor(
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    private readonly scopeService: DataAccessScopeService,
  ) {}

  async summary(user: AuthenticatedUser, query: ClaimsDashboardQuery) {
    const statusRows = await this.scoped(user, query)
      .select('claim.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(claim.outstanding_reserve), 0)', 'reserve')
      .addSelect('COALESCE(SUM(claim.approved_amount), 0)', 'approved')
      .addSelect('COALESCE(SUM(claim.paid_amount), 0)', 'paid')
      .addSelect(
        'COALESCE(SUM(GREATEST(claim.approved_amount - claim.paid_amount, 0)), 0)',
        'outstanding',
      )
      .groupBy('claim.status')
      .getRawMany<{
        status: ClaimStatus;
        count: number;
        reserve: string;
        approved: string;
        paid: string;
        outstanding: string;
      }>();

    const count = (statuses: readonly ClaimStatus[]) =>
      statusRows
        .filter((row) => statuses.includes(row.status))
        .reduce((total, row) => total + Number(row.count), 0);
    const sum = (
      key: 'reserve' | 'approved' | 'paid' | 'outstanding',
      open = false,
    ) =>
      statusRows
        .filter((row) => !open || !CLOSED.includes(row.status))
        .reduce((total, row) => total + Number(row[key] ?? 0), 0)
        .toFixed(2);

    const recentSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      newlyReported,
      pendingApprovals,
      tira,
      byProduct,
      byClass,
      byBranch,
      byMonth,
    ] = await Promise.all([
      this.scoped(user, query)
        .andWhere('claim.created_at >= :recentSince', { recentSince })
        .getCount(),
      this.scoped(user, query)
        .innerJoin(
          'claim_approvals',
          'approval',
          'approval.claim_id = claim.id',
        )
        .andWhere('approval.status = :pending', { pending: 'PENDING' })
        .select('COUNT(DISTINCT approval.subject_id)::int', 'count')
        .getRawOne<{ count: number }>(),
      this.scoped(user, query)
        .innerJoin(
          'claim_regulatory_operations',
          'operation',
          'operation.claim_id = claim.id',
        )
        .select('operation.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('operation.status')
        .getRawMany<{ status: ClaimRegulatoryStatus; count: number }>(),
      this.grouped(
        user,
        query,
        "COALESCE(product.product_name, 'Unknown')",
        'insurance_products',
        'product',
        'product.id = policy.product_id',
      ),
      this.grouped(
        user,
        query,
        "COALESCE(category.name, 'Unknown')",
        'insurance_categories',
        'category',
        'category.id = policy.category_id',
      ),
      this.grouped(
        user,
        query,
        "COALESCE(branch.name, 'Unassigned')",
        'branches',
        'branch',
        'branch.id = claim.branch_id',
      ),
      this.scoped(user, query)
        .select(
          "TO_CHAR(DATE_TRUNC('month', claim.created_at), 'YYYY-MM')",
          'month',
        )
        .addSelect('COUNT(*)::int', 'claims')
        .addSelect('COALESCE(SUM(claim.paid_amount), 0)', 'paid')
        .andWhere("claim.created_at >= NOW() - INTERVAL '12 months'")
        .groupBy('1')
        .orderBy('1', 'ASC')
        .getRawMany(),
    ]);

    const tiraCount = (statuses: ClaimRegulatoryStatus[]) =>
      tira
        .filter((row) => statuses.includes(row.status))
        .reduce((total, row) => total + Number(row.count), 0);

    return {
      counts: {
        total: count(Object.values(ClaimStatus)),
        open: count(
          Object.values(ClaimStatus).filter(
            (status) => !CLOSED.includes(status),
          ),
        ),
        newly_reported: newlyReported,
        notification: count(CLAIM_QUEUE_STATUSES[ClaimQueue.NOTIFICATION]),
        pending_intimation: count(CLAIM_QUEUE_STATUSES[ClaimQueue.INTIMATION]),
        under_assessment: count([
          ClaimStatus.INTIMATED,
          ClaimStatus.ASSESSMENT_PENDING,
          ClaimStatus.UNDER_ASSESSMENT,
          ClaimStatus.ASSESSED,
          ClaimStatus.REASSESSMENT_REQUIRED,
          ClaimStatus.REOPENED,
        ]),
        pending_approval: count([
          ClaimStatus.PENDING_APPROVAL,
          ClaimStatus.REJECTION_PENDING,
        ]),
        pending_approval_items: Number(pendingApprovals?.count ?? 0),
        pending_discharge: count(CLAIM_QUEUE_STATUSES[ClaimQueue.DISCHARGE]),
        pending_payment: count([
          ClaimStatus.DISCHARGE_ACCEPTED,
          ClaimStatus.PAYMENT_PENDING,
        ]),
        partially_paid: count([ClaimStatus.PARTIALLY_PAID]),
        paid: count([ClaimStatus.PAID]),
        settled: count([ClaimStatus.SETTLED]),
        rejected: count([ClaimStatus.REJECTED]),
        closed: count([ClaimStatus.CLOSED]),
      },
      amounts: {
        reserve: sum('reserve', true),
        approved: sum('approved'),
        paid: sum('paid'),
        outstanding: sum('outstanding', true),
      },
      by_status: statusRows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      by_product: byProduct,
      by_class: byClass,
      by_branch: byBranch,
      by_month: byMonth,
      tira: {
        accepted: tiraCount([ClaimRegulatoryStatus.ACCEPTED]),
        pending: tiraCount([
          ClaimRegulatoryStatus.QUEUED,
          ClaimRegulatoryStatus.PROCESSING,
          ClaimRegulatoryStatus.ACKNOWLEDGED,
          ClaimRegulatoryStatus.RETRYABLE,
        ]),
        failed: tiraCount([
          ClaimRegulatoryStatus.FAILED,
          ClaimRegulatoryStatus.REJECTED,
        ]),
        reconciliation_required: tiraCount([
          ClaimRegulatoryStatus.RECONCILIATION_REQUIRED,
        ]),
      },
    };
  }

  private scoped(
    user: AuthenticatedUser,
    query: ClaimsDashboardQuery,
  ): SelectQueryBuilder<InsuranceClaim> {
    const scope = this.scopeService.resolve(user);
    const queryBuilder = this.claimRepository
      .createQueryBuilder('claim')
      .innerJoin('claim.policy', 'policy')
      .where('claim.deleted_at IS NULL');

    this.scopeService.applyClaimReadScope(queryBuilder, 'claim', scope);

    if (query.branch_id) {
      this.scopeService.assertRequestedBranchAllowed(scope, query.branch_id);
      queryBuilder.andWhere('claim.branch_id = :branchId', {
        branchId: query.branch_id,
      });
    }

    if (query.product_id) {
      queryBuilder.andWhere('policy.product_id = :productId', {
        productId: query.product_id,
      });
    }

    if (query.from) {
      queryBuilder.andWhere('claim.created_at >= :from::date', {
        from: query.from,
      });
    }

    if (query.to) {
      queryBuilder.andWhere(
        "claim.created_at < (:to::date + INTERVAL '1 day')",
        { to: query.to },
      );
    }

    return queryBuilder;
  }

  private grouped(
    user: AuthenticatedUser,
    query: ClaimsDashboardQuery,
    label: string,
    table: string,
    alias: string,
    on: string,
  ) {
    return this.scoped(user, query)
      .leftJoin(table, alias, on)
      .select(label, 'label')
      .addSelect('COUNT(*)::int', 'claims')
      .addSelect('COALESCE(SUM(claim.approved_amount), 0)', 'approved')
      .addSelect('COALESCE(SUM(claim.paid_amount), 0)', 'paid')
      .groupBy('1')
      .orderBy('claims', 'DESC')
      .limit(10)
      .getRawMany();
  }
}
