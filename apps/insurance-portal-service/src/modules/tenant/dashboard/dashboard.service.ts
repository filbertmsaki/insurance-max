import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  Brackets,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../../tiramis/enums/tiramis-submission-status.enum';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import type { TenantDataScope } from '../../shared/authorization/interfaces/tenant-data-scope.interface';
import { CommissionTransaction } from '../billing-commission/entities/commission-transaction.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerKycStatus } from '../customers/enums/customer-kyc-status.enum';
import { CustomerStatus } from '../customers/enums/customer-status.enum';
import { Policy } from '../policies/entities/policy.entity';
import { ApprovalStatus } from '../quotations/enums/approval-status.enum';
import { PaymentStatus } from '../quotations/enums/payment-status.enum';
import { QuotationStatus } from '../quotations/enums/quotation-status.enum';
import { TiraStatus } from '../quotations/enums/tira-status.enum';
import { Quotation } from '../quotations/entities/quotation.entity';
import { DashboardCacheService } from './dashboard-cache.service';
import {
  DashboardGroupBy,
  DashboardQueryDto,
} from './dto/dashboard-query.dto';
import { DashboardPermissions } from './dashboard.permissions';

interface DashboardPeriod {
  from: string;
  to: string;
  groupBy: DashboardGroupBy;
}

interface MoneyByCurrency {
  currency: string;
  amount: string;
}

interface CountByLabel {
  label: string;
  count: string;
}

interface PeriodMoneyRow {
  period: string;
  currency: string;
  count: string;
  amount: string;
}

@Injectable()
export class DashboardService {
  private readonly timezone: string;
  private readonly maximumRangeDays: number;

  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,

    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,

    @InjectRepository(CommissionTransaction)
    private readonly commissionRepository: Repository<CommissionTransaction>,

    @InjectRepository(TiramisSubmissionTrackingEntity)
    private readonly tiramisTrackingRepository:
      Repository<TiramisSubmissionTrackingEntity>,

    private readonly dataAccessScopeService: DataAccessScopeService,
    private readonly dashboardCacheService: DashboardCacheService,
    private readonly configService: ConfigService,
  ) {
    this.timezone =
      this.configService.get<string>('app.timezone') ??
      this.configService.get<string>(
        'APP_TIMEZONE',
        'Africa/Dar_es_Salaam',
      ) ??
      'Africa/Dar_es_Salaam';

    this.maximumRangeDays = Number(
      this.configService.get<string>(
        'DASHBOARD_MAX_RANGE_DAYS',
        '366',
      ),
    );
  }

  getCapabilities(user: AuthenticatedUser) {
    const scope = this.dataAccessScopeService.resolve(user);
    const has = (permission: string) =>
      (user.permissions ?? []).includes(permission);

    const sections = {
      overview: has(DashboardPermissions.OVERVIEW),
      sales: has(DashboardPermissions.SALES),
      policies: has(DashboardPermissions.POLICIES),
      finance: has(DashboardPermissions.FINANCE),
      commissions: has(DashboardPermissions.COMMISSIONS),
      tiramis: has(DashboardPermissions.TIRAMIS),
      tasks: has(DashboardPermissions.TASKS),
      claims: false,
      reinsurance: false,
      endorsements: false,
      renewals: false,
      subscriptions: false,
    };

    return {
      organization: {
        company_id: user.companyId,
        company_name: user.companyName,
        company_type: user.companyType,
      },
      user: {
        user_id: user.id,
        user_type: user.userType,
        roles: user.roles,
      },
      scope: {
        active_branch_id: scope.activeBranchId,
        assigned_branch_ids: scope.assignedBranchIds,
        allowed_branch_ids: scope.allowedBranchIds,
        can_view_all_branches: scope.canViewAllBranches,
        own_records_only: scope.ownRecordsOnly,
        can_view_carrier_portfolio:
          scope.canViewCarrierPortfolio,
        can_view_intermediary_portfolio:
          scope.canViewIntermediaryPortfolio,
      },
      sections,
      navigation: this.buildNavigation(
        user.companyType ?? CompanyType.INSURANCE_COMPANY,
        sections,
      ),
    };
  }

  async getOverview(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ) {
    return this.dashboardCacheService.getOrSet(
      'overview',
      user,
      query,
      async () => {
        const { scope, period } = this.resolveContext(user, query);
        const [
          sales,
          policies,
          customers,
          finance,
          tiramis,
          tasks,
        ] = await Promise.all([
          this.buildSales(scope, user, query, period),
          this.buildPolicies(scope, query, period),
          this.buildCustomers(scope, query, period),
          this.buildFinance(scope, user, query, period),
          this.buildTiramis(scope, query, period),
          this.buildTasks(scope, query, period),
        ]);

        return {
          context: this.buildContext(scope, query, period),
          capabilities: this.getCapabilities(user),
          kpis: {
            quotations: sales.kpis,
            policies: policies.kpis,
            customers: customers.kpis,
            finance: finance.kpis,
            commissions: finance.commissions?.kpis ?? null,
            tiramis: tiramis.kpis,
          },
          charts: {
            quotation_trend: sales.charts.trend,
            quotation_statuses:
              sales.charts.status_breakdown,
            policy_trend: policies.charts.trend,
            policy_statuses:
              policies.charts.status_breakdown,
            tiramis_statuses:
              tiramis.charts.status_breakdown,
          },
          work_queues: tasks.queues,
          alerts: tasks.alerts,
          generated_at: new Date().toISOString(),
        };
      },
    );
  }

  async getSales(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ) {
    return this.dashboardCacheService.getOrSet(
      'sales',
      user,
      query,
      async () => {
        const { scope, period } = this.resolveContext(user, query);

        return {
          context: this.buildContext(scope, query, period),
          ...(await this.buildSales(scope, user, query, period)),
          generated_at: new Date().toISOString(),
        };
      },
    );
  }

  async getPolicies(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ) {
    return this.dashboardCacheService.getOrSet(
      'policies',
      user,
      query,
      async () => {
        const { scope, period } = this.resolveContext(user, query);

        return {
          context: this.buildContext(scope, query, period),
          ...(await this.buildPolicies(scope, query, period)),
          generated_at: new Date().toISOString(),
        };
      },
    );
  }

  async getFinance(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ) {
    return this.dashboardCacheService.getOrSet(
      'finance',
      user,
      query,
      async () => {
        const { scope, period } = this.resolveContext(user, query);

        return {
          context: this.buildContext(scope, query, period),
          ...(await this.buildFinance(scope, user, query, period)),
          generated_at: new Date().toISOString(),
        };
      },
    );
  }

  async getTiramis(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ) {
    return this.dashboardCacheService.getOrSet(
      'tiramis',
      user,
      query,
      async () => {
        const { scope, period } = this.resolveContext(user, query);

        return {
          context: this.buildContext(scope, query, period),
          ...(await this.buildTiramis(scope, query, period)),
          generated_at: new Date().toISOString(),
        };
      },
    );
  }

  async getTasks(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ) {
    return this.dashboardCacheService.getOrSet(
      'tasks',
      user,
      query,
      async () => {
        const { scope, period } = this.resolveContext(user, query);

        return {
          context: this.buildContext(scope, query, period),
          ...(await this.buildTasks(scope, query, period)),
          generated_at: new Date().toISOString(),
        };
      },
    );
  }

  private async buildSales(
    scope: TenantDataScope,
    user: AuthenticatedUser,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const metrics = await this.createQuotationQuery(
      scope,
      query,
      period,
    )
      .select('COUNT(DISTINCT quotation.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT quotation.id) FILTER (
          WHERE quotation.status = :completedStatus
        )`,
        'completed',
      )
      .addSelect(
        `COUNT(DISTINCT quotation.id) FILTER (
          WHERE quotation.approval_status = :pendingApproval
        )`,
        'pending_approval',
      )
      .addSelect(
        `COUNT(DISTINCT quotation.id) FILTER (
          WHERE quotation.payment_status IN (:...paymentPendingStatuses)
        )`,
        'awaiting_payment',
      )
      .addSelect(
        `COUNT(DISTINCT quotation.id) FILTER (
          WHERE quotation.status = :readyForSubmission
            AND quotation.tira_status = :notSubmitted
        )`,
        'ready_for_tiramis',
      )
      .addSelect(
        `COUNT(DISTINCT quotation.id) FILTER (
          WHERE quotation.tira_status IN (:...failedTiraStatuses)
            OR quotation.status = :failedStatus
        )`,
        'failed_tiramis',
      )
      .addSelect(
        `COUNT(DISTINCT quotation.id) FILTER (
          WHERE quotation.status NOT IN (:...ineligibleStatuses)
        )`,
        'eligible_for_conversion',
      )
      .setParameters({
        completedStatus: QuotationStatus.COMPLETED,
        pendingApproval: ApprovalStatus.PENDING,
        paymentPendingStatuses: [
          PaymentStatus.REQUESTED,
          PaymentStatus.PROCESSING,
          PaymentStatus.PARTIALLY_PAID,
        ],
        readyForSubmission:
          QuotationStatus.READY_FOR_SUBMISSION,
        notSubmitted: TiraStatus.NOT_SUBMITTED,
        failedTiraStatuses: [
          TiraStatus.FAILED,
          TiraStatus.REJECTED,
        ],
        failedStatus: QuotationStatus.FAILED,
        ineligibleStatuses: [
          QuotationStatus.DRAFT,
          QuotationStatus.CANCELLED,
          QuotationStatus.EXPIRED,
        ],
      })
      .getRawOne<{
        total: string;
        completed: string;
        pending_approval: string;
        awaiting_payment: string;
        ready_for_tiramis: string;
        failed_tiramis: string;
        eligible_for_conversion: string;
      }>();

    const converted = await this.createQuotationQuery(
      scope,
      query,
      period,
    )
      .innerJoin(
        Policy,
        'convertedPolicy',
        `
          convertedPolicy.quotation_id = quotation.id
          AND convertedPolicy.deleted_at IS NULL
        `,
      )
      .select('COUNT(DISTINCT quotation.id)', 'count')
      .getRawOne<{ count: string }>();

    const premiumByCurrency = await this.createQuotationQuery(
      scope,
      query,
      period,
    )
      .select(
        `COALESCE(coverNote.currency_code, 'UNKNOWN')`,
        'currency',
      )
      .addSelect(
        `COALESCE(SUM(coverNote.total_premium_including_tax), 0)`,
        'amount',
      )
      .groupBy(`COALESCE(coverNote.currency_code, 'UNKNOWN')`)
      .orderBy('currency', 'ASC')
      .getRawMany<MoneyByCurrency>();

    const trend = await this.createQuotationQuery(
      scope,
      query,
      period,
    )
      .select(
        this.dateBucketExpression(
          'quotation.created_at',
          period.groupBy,
        ),
        'period',
      )
      .addSelect(
        `COALESCE(coverNote.currency_code, 'UNKNOWN')`,
        'currency',
      )
      .addSelect('COUNT(DISTINCT quotation.id)', 'count')
      .addSelect(
        `COALESCE(SUM(coverNote.total_premium_including_tax), 0)`,
        'amount',
      )
      .groupBy('period')
      .addGroupBy(`COALESCE(coverNote.currency_code, 'UNKNOWN')`)
      .orderBy('period', 'ASC')
      .addOrderBy('currency', 'ASC')
      .getRawMany<PeriodMoneyRow>();

    const statusBreakdown = await this.createQuotationQuery(
      scope,
      query,
      period,
    )
      .select('quotation.status', 'label')
      .addSelect('COUNT(DISTINCT quotation.id)', 'count')
      .groupBy('quotation.status')
      .orderBy('quotation.status', 'ASC')
      .getRawMany<CountByLabel>();

    const eligible = this.toNumber(
      metrics?.eligible_for_conversion,
    );
    const convertedCount = this.toNumber(converted?.count);

    return {
      kpis: {
        total_quotations: this.toNumber(metrics?.total),
        completed_quotations: this.toNumber(
          metrics?.completed,
        ),
        pending_approval: this.toNumber(
          metrics?.pending_approval,
        ),
        awaiting_payment: this.toNumber(
          metrics?.awaiting_payment,
        ),
        ready_for_tiramis: this.toNumber(
          metrics?.ready_for_tiramis,
        ),
        failed_tiramis: this.toNumber(
          metrics?.failed_tiramis,
        ),
        eligible_for_conversion: eligible,
        converted_quotations: convertedCount,
        conversion_rate: this.roundPercentage(
          eligible > 0
            ? (convertedCount / eligible) * 100
            : 0,
        ),
        quoted_premium: this.normalizeMoneyRows(
          premiumByCurrency,
        ),
        can_view_partner_portfolio:
          scope.canViewCarrierPortfolio ||
          scope.canViewIntermediaryPortfolio,
        company_type: user.companyType,
      },
      charts: {
        trend: trend.map((row) => ({
          period: row.period,
          currency: row.currency,
          quotation_count: this.toNumber(row.count),
          quoted_premium: this.toAmountString(row.amount),
        })),
        status_breakdown:
          this.normalizeCountBreakdown(statusBreakdown),
      },
    };
  }

  private async buildPolicies(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const today = this.todayInTimeZone();
    const expiryBoundary = this.addDays(today, 30);

    const metrics = await this.createPolicyQuery(
      scope,
      query,
      period,
    )
      .select('COUNT(DISTINCT policy.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT policy.id) FILTER (
          WHERE policy.end_date >= :today
            AND policy.policy_status NOT IN ('CANCELLED', 'EXPIRED', 'DRAFT')
        )`,
        'active',
      )
      .addSelect(
        `COUNT(DISTINCT policy.id) FILTER (
          WHERE policy.end_date < :today
            OR policy.policy_status = 'EXPIRED'
        )`,
        'expired',
      )
      .addSelect(
        `COUNT(DISTINCT policy.id) FILTER (
          WHERE policy.end_date BETWEEN :today AND :expiryBoundary
            AND policy.policy_status NOT IN ('CANCELLED', 'EXPIRED')
        )`,
        'expiring_soon',
      )
      .addSelect(
        `COUNT(DISTINCT policy.id) FILTER (
          WHERE COALESCE(policy.tiramis_status, 'PENDING')
            NOT IN ('FINAL_SUCCESS', 'SUCCESS')
        )`,
        'pending_tiramis',
      )
      .setParameters({
        today,
        expiryBoundary,
      })
      .getRawOne<{
        total: string;
        active: string;
        expired: string;
        expiring_soon: string;
        pending_tiramis: string;
      }>();

    const premiumByCurrency = await this.createPolicyQuery(
      scope,
      query,
      period,
    )
      .select('COALESCE(policy.currency, \'UNKNOWN\')', 'currency')
      .addSelect(
        'COALESCE(SUM(policy.total_premium), 0)',
        'amount',
      )
      .groupBy('COALESCE(policy.currency, \'UNKNOWN\')')
      .orderBy('currency', 'ASC')
      .getRawMany<MoneyByCurrency>();

    const trend = await this.createPolicyQuery(
      scope,
      query,
      period,
    )
      .select(
        this.dateBucketExpression(
          'policy.created_at',
          period.groupBy,
        ),
        'period',
      )
      .addSelect('COALESCE(policy.currency, \'UNKNOWN\')', 'currency')
      .addSelect('COUNT(DISTINCT policy.id)', 'count')
      .addSelect(
        'COALESCE(SUM(policy.total_premium), 0)',
        'amount',
      )
      .groupBy('period')
      .addGroupBy('COALESCE(policy.currency, \'UNKNOWN\')')
      .orderBy('period', 'ASC')
      .addOrderBy('currency', 'ASC')
      .getRawMany<PeriodMoneyRow>();

    const statusBreakdown = await this.createPolicyQuery(
      scope,
      query,
      period,
    )
      .select('policy.policy_status', 'label')
      .addSelect('COUNT(DISTINCT policy.id)', 'count')
      .groupBy('policy.policy_status')
      .orderBy('policy.policy_status', 'ASC')
      .getRawMany<CountByLabel>();

    return {
      kpis: {
        total_policies: this.toNumber(metrics?.total),
        active_policies: this.toNumber(metrics?.active),
        expired_policies: this.toNumber(metrics?.expired),
        expiring_within_30_days: this.toNumber(
          metrics?.expiring_soon,
        ),
        pending_tiramis_sync: this.toNumber(
          metrics?.pending_tiramis,
        ),
        total_premium: this.normalizeMoneyRows(
          premiumByCurrency,
        ),
      },
      charts: {
        trend: trend.map((row) => ({
          period: row.period,
          currency: row.currency,
          policy_count: this.toNumber(row.count),
          total_premium: this.toAmountString(row.amount),
        })),
        status_breakdown:
          this.normalizeCountBreakdown(statusBreakdown),
      },
    };
  }

  private async buildCustomers(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const metrics = await this.createCustomerQuery(
      scope,
      query,
      period,
    )
      .select('COUNT(DISTINCT customer.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT customer.id) FILTER (
          WHERE customer.status = :activeStatus
        )`,
        'active',
      )
      .addSelect(
        `COUNT(DISTINCT customer.id) FILTER (
          WHERE customer.kyc_status = :pendingKyc
        )`,
        'pending_kyc',
      )
      .setParameters({
        activeStatus: CustomerStatus.ACTIVE,
        pendingKyc: CustomerKycStatus.PENDING,
      })
      .getRawOne<{
        total: string;
        active: string;
        pending_kyc: string;
      }>();

    const typeBreakdown = await this.createCustomerQuery(
      scope,
      query,
      period,
    )
      .select('customer.customer_type', 'label')
      .addSelect('COUNT(DISTINCT customer.id)', 'count')
      .groupBy('customer.customer_type')
      .orderBy('customer.customer_type', 'ASC')
      .getRawMany<CountByLabel>();

    return {
      kpis: {
        total_customers: this.toNumber(metrics?.total),
        active_customers: this.toNumber(metrics?.active),
        pending_kyc: this.toNumber(metrics?.pending_kyc),
      },
      charts: {
        customer_types:
          this.normalizeCountBreakdown(typeBreakdown),
      },
    };
  }

  private async buildFinance(
    scope: TenantDataScope,
    user: AuthenticatedUser,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const today = this.todayInTimeZone();

    const invoiceMetrics = await this.createInvoiceQuery(
      scope,
      query,
      period,
    )
      .select('COUNT(DISTINCT invoice.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT invoice.id) FILTER (
          WHERE invoice.balance_amount > 0
        )`,
        'open',
      )
      .addSelect(
        `COUNT(DISTINCT invoice.id) FILTER (
          WHERE invoice.balance_amount > 0
            AND invoice.due_date IS NOT NULL
            AND invoice.due_date < :today
        )`,
        'overdue',
      )
      .setParameter('today', today)
      .getRawOne<{
        total: string;
        open: string;
        overdue: string;
      }>();

    const invoiceTotals = await this.createInvoiceQuery(
      scope,
      query,
      period,
    )
      .select('invoice.currency', 'currency')
      .addSelect(
        'COALESCE(SUM(invoice.total_amount), 0)',
        'total_amount',
      )
      .addSelect(
        'COALESCE(SUM(invoice.balance_amount), 0)',
        'balance_amount',
      )
      .groupBy('invoice.currency')
      .orderBy('invoice.currency', 'ASC')
      .getRawMany<{
        currency: string;
        total_amount: string;
        balance_amount: string;
      }>();

    const invoiceTrend = await this.createInvoiceQuery(
      scope,
      query,
      period,
    )
      .select(
        this.dateBucketExpression(
          'invoice.created_at',
          period.groupBy,
        ),
        'period',
      )
      .addSelect('invoice.currency', 'currency')
      .addSelect('COUNT(DISTINCT invoice.id)', 'count')
      .addSelect(
        'COALESCE(SUM(invoice.total_amount), 0)',
        'amount',
      )
      .groupBy('period')
      .addGroupBy('invoice.currency')
      .orderBy('period', 'ASC')
      .addOrderBy('invoice.currency', 'ASC')
      .getRawMany<PeriodMoneyRow>();

    const receiptMetrics = await this.createReceiptQuery(
      scope,
      query,
      period,
    )
      .select('COUNT(DISTINCT receipt.id)', 'total')
      .getRawOne<{ total: string }>();

    const receiptTotals = await this.createReceiptQuery(
      scope,
      query,
      period,
    )
      .select('receipt.currency', 'currency')
      .addSelect(
        'COALESCE(SUM(receipt.amount), 0)',
        'amount',
      )
      .groupBy('receipt.currency')
      .orderBy('receipt.currency', 'ASC')
      .getRawMany<MoneyByCurrency>();

    const receiptTrend = await this.createReceiptQuery(
      scope,
      query,
      period,
    )
      .select(
        this.dateBucketExpression(
          'receipt.created_at',
          period.groupBy,
        ),
        'period',
      )
      .addSelect('receipt.currency', 'currency')
      .addSelect('COUNT(DISTINCT receipt.id)', 'count')
      .addSelect(
        'COALESCE(SUM(receipt.amount), 0)',
        'amount',
      )
      .groupBy('period')
      .addGroupBy('receipt.currency')
      .orderBy('period', 'ASC')
      .addOrderBy('receipt.currency', 'ASC')
      .getRawMany<PeriodMoneyRow>();

    return {
      kpis: {
        total_invoices: this.toNumber(invoiceMetrics?.total),
        open_invoices: this.toNumber(invoiceMetrics?.open),
        overdue_invoices: this.toNumber(
          invoiceMetrics?.overdue,
        ),
        total_receipts: this.toNumber(receiptMetrics?.total),
        invoiced_amount: invoiceTotals.map((row) => ({
          currency: row.currency,
          amount: this.toAmountString(row.total_amount),
        })),
        outstanding_amount: invoiceTotals.map((row) => ({
          currency: row.currency,
          amount: this.toAmountString(row.balance_amount),
        })),
        collected_amount: this.normalizeMoneyRows(receiptTotals),
        finance_visibility_mode: 'ACTIVE_COMPANY_ONLY',
      },
      charts: {
        invoice_trend: invoiceTrend.map((row) => ({
          period: row.period,
          currency: row.currency,
          invoice_count: this.toNumber(row.count),
          invoiced_amount: this.toAmountString(row.amount),
        })),
        receipt_trend: receiptTrend.map((row) => ({
          period: row.period,
          currency: row.currency,
          receipt_count: this.toNumber(row.count),
          collected_amount: this.toAmountString(row.amount),
        })),
      },
      commissions: this.hasPermission(
        user,
        DashboardPermissions.COMMISSIONS,
      )
        ? await this.buildCommissions(scope, query, period)
        : null,
    };
  }

  private async buildCommissions(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const metrics = await this.createCommissionQuery(
      scope,
      query,
      period,
    )
      .select(
        'COUNT(DISTINCT commission.id)',
        'total',
      )
      .addSelect(
        `COUNT(DISTINCT commission.id) FILTER (
          WHERE UPPER(commission.status) = 'PAID'
        )`,
        'paid',
      )
      .addSelect(
        `COUNT(DISTINCT commission.id) FILTER (
          WHERE UPPER(commission.status) <> 'PAID'
        )`,
        'pending',
      )
      .getRawOne<{
        total: string;
        paid: string;
        pending: string;
      }>();

    const amountRows = await this.createCommissionQuery(
      scope,
      query,
      period,
    )
      .select('COALESCE(policy.currency, \'UNKNOWN\')', 'currency')
      .addSelect(
        'COALESCE(SUM(commission.commission_amount), 0)',
        'amount',
      )
      .groupBy('COALESCE(policy.currency, \'UNKNOWN\')')
      .orderBy('currency', 'ASC')
      .getRawMany<MoneyByCurrency>();

    const paidRows = await this.createCommissionQuery(
      scope,
      query,
      period,
    )
      .andWhere(`UPPER(commission.status) = 'PAID'`)
      .select('COALESCE(policy.currency, \'UNKNOWN\')', 'currency')
      .addSelect(
        'COALESCE(SUM(commission.commission_amount), 0)',
        'amount',
      )
      .groupBy('COALESCE(policy.currency, \'UNKNOWN\')')
      .orderBy('currency', 'ASC')
      .getRawMany<MoneyByCurrency>();

    const statusBreakdown = await this.createCommissionQuery(
      scope,
      query,
      period,
    )
      .select('commission.status', 'status')
      .addSelect('COALESCE(policy.currency, \'UNKNOWN\')', 'currency')
      .addSelect(
        'COUNT(DISTINCT commission.id)',
        'count',
      )
      .addSelect(
        'COALESCE(SUM(commission.commission_amount), 0)',
        'amount',
      )
      .groupBy('commission.status')
      .addGroupBy('COALESCE(policy.currency, \'UNKNOWN\')')
      .orderBy('commission.status', 'ASC')
      .addOrderBy('currency', 'ASC')
      .getRawMany<{
        status: string;
        currency: string;
        count: string;
        amount: string;
      }>();

    return {
      kpis: {
        total_transactions: this.toNumber(metrics?.total),
        pending_transactions: this.toNumber(
          metrics?.pending,
        ),
        paid_transactions: this.toNumber(metrics?.paid),
        accrued_amount: this.normalizeMoneyRows(amountRows),
        paid_amount: this.normalizeMoneyRows(paidRows),
      },
      charts: {
        status_breakdown: statusBreakdown.map((row) => ({
          status: row.status,
          currency: row.currency,
          count: this.toNumber(row.count),
          amount: this.toAmountString(row.amount),
        })),
      },
    };
  }

  private async buildTiramis(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const metrics = await this.createTiramisQuery(
      scope,
      query,
      period,
    )
      .select('COUNT(DISTINCT tracking.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT tracking.id) FILTER (
          WHERE tracking.status IN (:...successStatuses)
        )`,
        'success',
      )
      .addSelect(
        `COUNT(DISTINCT tracking.id) FILTER (
          WHERE tracking.status IN (:...pendingStatuses)
        )`,
        'pending',
      )
      .addSelect(
        `COUNT(DISTINCT tracking.id) FILTER (
          WHERE tracking.status IN (:...failedStatuses)
        )`,
        'failed',
      )
      .addSelect(
        `COUNT(DISTINCT tracking.id) FILTER (
          WHERE tracking.is_retryable = true
        )`,
        'retryable',
      )
      .setParameters({
        successStatuses: [
          TiramisSubmissionStatus.FINAL_SUCCESS,
        ],
        pendingStatuses: [
          TiramisSubmissionStatus.DRAFT,
          TiramisSubmissionStatus.PENDING,
          TiramisSubmissionStatus.SUBMITTING,
          TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
          TiramisSubmissionStatus.ACK_ACCEPTED,
          TiramisSubmissionStatus.ACKNOWLEDGED,
          TiramisSubmissionStatus.PENDING_FINAL,
          TiramisSubmissionStatus.RETRY_PENDING,
          TiramisSubmissionStatus.RETRYING,
          TiramisSubmissionStatus.UNKNOWN,
        ],
        failedStatuses: [
          TiramisSubmissionStatus.ACK_FAILED,
          TiramisSubmissionStatus.FINAL_FAILED,
          TiramisSubmissionStatus.RETRY_EXHAUSTED,
          TiramisSubmissionStatus.CALLBACK_OVERDUE,
          TiramisSubmissionStatus.FAILED,
        ],
      })
      .getRawOne<{
        total: string;
        success: string;
        pending: string;
        failed: string;
        retryable: string;
      }>();

    const statusBreakdown = await this.createTiramisQuery(
      scope,
      query,
      period,
    )
      .select('tracking.status', 'label')
      .addSelect('COUNT(DISTINCT tracking.id)', 'count')
      .groupBy('tracking.status')
      .orderBy('tracking.status', 'ASC')
      .getRawMany<CountByLabel>();

    const recentFailures = await this.createTiramisQuery(
      scope,
      query,
      period,
    )
      .andWhere(
        'tracking.status IN (:...failureStatuses)',
        {
          failureStatuses: [
            TiramisSubmissionStatus.ACK_FAILED,
            TiramisSubmissionStatus.FINAL_FAILED,
            TiramisSubmissionStatus.RETRY_EXHAUSTED,
            TiramisSubmissionStatus.CALLBACK_OVERDUE,
            TiramisSubmissionStatus.FAILED,
          ],
        },
      )
      .select('tracking.id', 'tracking_id')
      .addSelect(
        'tracking.business_reference',
        'business_reference',
      )
      .addSelect('tracking.status', 'status')
      .addSelect(
        'tracking.last_error_message',
        'last_error_message',
      )
      .addSelect('tracking.created_at', 'created_at')
      .orderBy('tracking.created_at', 'DESC')
      .limit(query.limit ?? 10)
      .getRawMany<{
        tracking_id: string;
        business_reference: string | null;
        status: string;
        last_error_message: string | null;
        created_at: string;
      }>();

    return {
      kpis: {
        total_submissions: this.toNumber(metrics?.total),
        successful_submissions: this.toNumber(
          metrics?.success,
        ),
        pending_submissions: this.toNumber(
          metrics?.pending,
        ),
        failed_submissions: this.toNumber(
          metrics?.failed,
        ),
        retryable_submissions: this.toNumber(
          metrics?.retryable,
        ),
      },
      charts: {
        status_breakdown:
          this.normalizeCountBreakdown(statusBreakdown),
      },
      recent_failures: recentFailures,
    };
  }

  private async buildTasks(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const today = this.todayInTimeZone();
    const expiryBoundary = this.addDays(today, 30);

    const [
      approvals,
      payments,
      readyForTiramis,
      tiramisFailures,
      overdueInvoices,
      expiringPolicies,
    ] = await Promise.all([
      this.createQuotationQuery(scope, query, period)
        .andWhere(
          'quotation.approval_status = :pendingApproval',
          { pendingApproval: ApprovalStatus.PENDING },
        )
        .select('COUNT(DISTINCT quotation.id)', 'count')
        .getRawOne<{ count: string }>(),
      this.createQuotationQuery(scope, query, period)
        .andWhere(
          'quotation.payment_status IN (:...paymentStatuses)',
          {
            paymentStatuses: [
              PaymentStatus.REQUESTED,
              PaymentStatus.PROCESSING,
              PaymentStatus.PARTIALLY_PAID,
            ],
          },
        )
        .select('COUNT(DISTINCT quotation.id)', 'count')
        .getRawOne<{ count: string }>(),
      this.createQuotationQuery(scope, query, period)
        .andWhere(
          'quotation.status = :readyStatus',
          {
            readyStatus:
              QuotationStatus.READY_FOR_SUBMISSION,
          },
        )
        .andWhere(
          'quotation.tira_status = :notSubmitted',
          { notSubmitted: TiraStatus.NOT_SUBMITTED },
        )
        .select('COUNT(DISTINCT quotation.id)', 'count')
        .getRawOne<{ count: string }>(),
      this.createTiramisQuery(scope, query, period)
        .andWhere(
          'tracking.status IN (:...failureStatuses)',
          {
            failureStatuses: [
              TiramisSubmissionStatus.ACK_FAILED,
              TiramisSubmissionStatus.FINAL_FAILED,
              TiramisSubmissionStatus.RETRY_EXHAUSTED,
              TiramisSubmissionStatus.CALLBACK_OVERDUE,
              TiramisSubmissionStatus.FAILED,
            ],
          },
        )
        .select('COUNT(DISTINCT tracking.id)', 'count')
        .getRawOne<{ count: string }>(),
      this.createInvoiceQuery(scope, query, period)
        .andWhere('invoice.balance_amount > 0')
        .andWhere('invoice.due_date IS NOT NULL')
        .andWhere('invoice.due_date < :today', { today })
        .select('COUNT(DISTINCT invoice.id)', 'count')
        .getRawOne<{ count: string }>(),
      this.createPolicyQuery(scope, query, period)
        .andWhere(
          'policy.end_date BETWEEN :today AND :expiryBoundary',
          {
            today,
            expiryBoundary,
          },
        )
        .andWhere(
          `policy.policy_status NOT IN ('CANCELLED', 'EXPIRED')`,
        )
        .select('COUNT(DISTINCT policy.id)', 'count')
        .getRawOne<{ count: string }>(),
    ]);

    const queues = [
      {
        key: 'approvals',
        label: 'Pending approvals',
        count: this.toNumber(approvals?.count),
      },
      {
        key: 'payments',
        label: 'Awaiting payment',
        count: this.toNumber(payments?.count),
      },
      {
        key: 'tiramis_ready',
        label: 'Ready for TIRAMIS',
        count: this.toNumber(
          readyForTiramis?.count,
        ),
      },
      {
        key: 'tiramis_failed',
        label: 'TIRAMIS failures',
        count: this.toNumber(
          tiramisFailures?.count,
        ),
      },
      {
        key: 'overdue_invoices',
        label: 'Overdue invoices',
        count: this.toNumber(
          overdueInvoices?.count,
        ),
      },
      {
        key: 'policy_expiry',
        label: 'Policies expiring in 30 days',
        count: this.toNumber(
          expiringPolicies?.count,
        ),
      },
    ];

    const alerts = queues
      .filter((queue) => queue.count > 0)
      .map((queue) => ({
        code: queue.key,
        severity:
          queue.key === 'tiramis_failed' ||
          queue.key === 'overdue_invoices'
            ? 'high'
            : 'medium',
        message: `${queue.count} ${queue.label.toLowerCase()}`,
      }));

    return {
      queues,
      alerts,
      totals: {
        open_items: queues.reduce(
          (sum, queue) => sum + queue.count,
          0,
        ),
      },
    };
  }

  private resolveContext(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
  ) {
    const scope = this.dataAccessScopeService.resolve(user);
    this.dataAccessScopeService.assertRequestedBranchAllowed(
      scope,
      query.branch_id,
    );

    return {
      scope,
      period: this.resolvePeriod(query),
    };
  }

  private resolvePeriod(
    query: DashboardQueryDto,
  ): DashboardPeriod {
    const today = this.todayInTimeZone();
    const to = query.to ?? today;
    const from = query.from ?? `${to.slice(0, 7)}-01`;

    const fromDate = this.parseIsoDate(from);
    const toDate = this.parseIsoDate(to);

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException(
        'The from date must be on or before the to date',
      );
    }

    const rangeDays =
      Math.floor(
        (toDate.getTime() - fromDate.getTime()) /
          86_400_000,
      ) + 1;

    if (rangeDays > this.maximumRangeDays) {
      throw new BadRequestException(
        `Dashboard date ranges may not exceed ${this.maximumRangeDays} days`,
      );
    }

    return {
      from,
      to,
      groupBy: query.group_by ?? DashboardGroupBy.DAY,
    };
  }

  private createQuotationQuery(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoin('quotation.cover_note', 'coverNote')
      .andWhere('quotation.deleted_at IS NULL');

    this.dataAccessScopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      scope,
    );

    this.applyCreatedAtPeriod(
      queryBuilder,
      'quotation.created_at',
      period,
    );

    if (query.branch_id) {
      queryBuilder.andWhere(
        'quotation.branch_id = :branchId',
        { branchId: query.branch_id },
      );
    }

    if (query.product_id) {
      queryBuilder.andWhere(
        'quotation.product_id = :productId',
        { productId: query.product_id },
      );
    }

    if (query.channel_type) {
      queryBuilder.andWhere(
        'quotation.channel_type = :channelType',
        { channelType: query.channel_type },
      );
    }

    if (query.currency) {
      queryBuilder.andWhere(
        'coverNote.currency_code = :currency',
        { currency: query.currency },
      );
    }

    return queryBuilder;
  }

  private createPolicyQuery(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const queryBuilder = this.policyRepository
      .createQueryBuilder('policy')
      .andWhere('policy.deleted_at IS NULL');

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      scope,
    );

    this.applyCreatedAtPeriod(
      queryBuilder,
      'policy.created_at',
      period,
    );

    if (query.branch_id) {
      queryBuilder.andWhere(
        'policy.branch_id = :branchId',
        { branchId: query.branch_id },
      );
    }

    if (query.product_id) {
      queryBuilder.andWhere(
        'policy.product_id = :productId',
        { productId: query.product_id },
      );
    }

    if (query.channel_type) {
      queryBuilder.andWhere(
        'policy.channel_type = :channelType',
        { channelType: query.channel_type },
      );
    }

    if (query.currency) {
      queryBuilder.andWhere(
        'policy.currency = :currency',
        { currency: query.currency },
      );
    }

    return queryBuilder;
  }

  private createCustomerQuery(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .andWhere('customer.deleted_at IS NULL');

    this.dataAccessScopeService.applyCustomerReadScope(
      queryBuilder,
      'customer',
      scope,
    );

    this.applyCreatedAtPeriod(
      queryBuilder,
      'customer.created_at',
      period,
    );

    if (
      query.branch_id ||
      query.product_id ||
      query.channel_type
    ) {
      queryBuilder.andWhere(
        new Brackets((filterQuery) => {
          filterQuery
            .where(`
              EXISTS (
                SELECT 1
                FROM quotations customer_quotation
                WHERE customer_quotation.customer_id = customer.id
                  AND customer_quotation.company_id = :scopeCompanyId
                  AND customer_quotation.deleted_at IS NULL
                  ${
                    query.branch_id
                      ? 'AND customer_quotation.branch_id = :customerBranchId'
                      : ''
                  }
                  ${
                    query.product_id
                      ? 'AND customer_quotation.product_id = :customerProductId'
                      : ''
                  }
                  ${
                    query.channel_type
                      ? 'AND customer_quotation.channel_type = :customerChannelType'
                      : ''
                  }
              )
            `)
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM policies customer_policy
                WHERE customer_policy.customer_id = customer.id
                  AND customer_policy.company_id = :scopeCompanyId
                  AND customer_policy.deleted_at IS NULL
                  ${
                    query.branch_id
                      ? 'AND customer_policy.branch_id = :customerBranchId'
                      : ''
                  }
                  ${
                    query.product_id
                      ? 'AND customer_policy.product_id = :customerProductId'
                      : ''
                  }
                  ${
                    query.channel_type
                      ? 'AND customer_policy.channel_type = :customerChannelType'
                      : ''
                  }
              )
            `);
        }),
      );

      queryBuilder.setParameters({
        customerBranchId: query.branch_id,
        customerProductId: query.product_id,
        customerChannelType: query.channel_type,
      });
    }

    return queryBuilder;
  }

  private createInvoiceQuery(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.policy', 'policy')
      .leftJoin('invoice.quotation', 'quotation')
      .andWhere('invoice.company_id = :scopeCompanyId')
      .andWhere('invoice.deleted_at IS NULL')
      .setParameters({
        scopeCompanyId: scope.companyId,
        scopeUserId: scope.userId,
        scopeBranchIds: scope.allowedBranchIds,
      });

    this.applyCreatedAtPeriod(
      queryBuilder,
      'invoice.created_at',
      period,
    );
    this.applyFinancialRecordScope(
      queryBuilder,
      'invoice',
      'policy',
      'quotation',
      scope,
      query.branch_id,
    );

    if (query.product_id) {
      queryBuilder.andWhere(
        new Brackets((productQuery) => {
          productQuery
            .where('policy.product_id = :productId')
            .orWhere('quotation.product_id = :productId');
        }),
        { productId: query.product_id },
      );
    }

    if (query.channel_type) {
      queryBuilder.andWhere(
        new Brackets((channelQuery) => {
          channelQuery
            .where('policy.channel_type = :channelType')
            .orWhere(
              'quotation.channel_type = :channelType',
            );
        }),
        { channelType: query.channel_type },
      );
    }

    if (query.currency) {
      queryBuilder.andWhere(
        'invoice.currency = :currency',
        { currency: query.currency },
      );
    }

    return queryBuilder;
  }

  private createReceiptQuery(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const queryBuilder = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoin('receipt.invoice', 'invoice')
      .leftJoin('invoice.policy', 'policy')
      .leftJoin('invoice.quotation', 'quotation')
      .andWhere('receipt.company_id = :scopeCompanyId')
      .andWhere('receipt.deleted_at IS NULL')
      .setParameters({
        scopeCompanyId: scope.companyId,
        scopeUserId: scope.userId,
        scopeBranchIds: scope.allowedBranchIds,
      });

    this.applyCreatedAtPeriod(
      queryBuilder,
      'receipt.created_at',
      period,
    );
    this.applyReceiptScope(
      queryBuilder,
      scope,
      query.branch_id,
    );

    if (query.product_id) {
      queryBuilder.andWhere(
        new Brackets((productQuery) => {
          productQuery
            .where('policy.product_id = :productId')
            .orWhere('quotation.product_id = :productId');
        }),
        { productId: query.product_id },
      );
    }

    if (query.channel_type) {
      queryBuilder.andWhere(
        new Brackets((channelQuery) => {
          channelQuery
            .where('policy.channel_type = :channelType')
            .orWhere(
              'quotation.channel_type = :channelType',
            );
        }),
        { channelType: query.channel_type },
      );
    }

    if (query.currency) {
      queryBuilder.andWhere(
        'receipt.currency = :currency',
        { currency: query.currency },
      );
    }

    return queryBuilder;
  }

  private createCommissionQuery(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const queryBuilder = this.commissionRepository
      .createQueryBuilder('commission')
      .innerJoin('commission.policy', 'policy')
      .andWhere('commission.company_id = :scopeCompanyId')
      .andWhere('commission.deleted_at IS NULL')
      .andWhere('policy.deleted_at IS NULL')
      .setParameters({
        scopeCompanyId: scope.companyId,
        scopeUserId: scope.userId,
        scopeBranchIds: scope.allowedBranchIds,
      });

    this.applyCreatedAtPeriod(
      queryBuilder,
      'commission.created_at',
      period,
    );

    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(
        'policy.created_by = :scopeUserId',
      );
    } else if (query.branch_id) {
      queryBuilder.andWhere(
        'policy.branch_id = :branchId',
        { branchId: query.branch_id },
      );
    } else if (!scope.canViewAllBranches) {
      if (scope.allowedBranchIds.length) {
        queryBuilder.andWhere(
          'policy.branch_id IN (:...scopeBranchIds)',
        );
      } else {
        queryBuilder.andWhere(
          'policy.created_by = :scopeUserId',
        );
      }
    }

    if (query.product_id) {
      queryBuilder.andWhere(
        'policy.product_id = :productId',
        { productId: query.product_id },
      );
    }

    if (query.channel_type) {
      queryBuilder.andWhere(
        'policy.channel_type = :channelType',
        { channelType: query.channel_type },
      );
    }

    if (query.currency) {
      queryBuilder.andWhere(
        'policy.currency = :currency',
        { currency: query.currency },
      );
    }

    return queryBuilder;
  }

  private createTiramisQuery(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    const queryBuilder = this.tiramisTrackingRepository
      .createQueryBuilder('tracking')
      .andWhere('tracking.source_company_id = :scopeCompanyId')
      .andWhere('tracking.deleted_at IS NULL')
      .setParameters({
        scopeCompanyId: scope.companyId,
        scopeUserId: scope.userId,
        scopeBranchIds: scope.allowedBranchIds,
        requestedBranchId: query.branch_id,
        productId: query.product_id,
        channelType: query.channel_type,
      });

    this.applyCreatedAtPeriod(
      queryBuilder,
      'tracking.created_at',
      period,
    );
    this.applyTiramisScope(
      queryBuilder,
      scope,
      query.branch_id,
    );
    this.applyTiramisBusinessFilters(queryBuilder, query);

    return queryBuilder;
  }

  private applyCreatedAtPeriod<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    column: string,
    period: DashboardPeriod,
  ) {
    queryBuilder.andWhere(
      `${this.localDateExpression(column)} BETWEEN :periodFrom AND :periodTo`,
      {
        periodFrom: period.from,
        periodTo: period.to,
      },
    );
  }

  private applyFinancialRecordScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    recordAlias: string,
    policyAlias: string,
    quotationAlias: string,
    scope: TenantDataScope,
    requestedBranchId?: string,
  ) {
    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(
        `${recordAlias}.created_by = :scopeUserId`,
      );
      return;
    }

    if (requestedBranchId) {
      queryBuilder.andWhere(
        new Brackets((branchQuery) => {
          branchQuery
            .where(
              `${policyAlias}.branch_id = :requestedBranchId`,
            )
            .orWhere(
              `${quotationAlias}.branch_id = :requestedBranchId`,
            );
        }),
      );
      return;
    }

    if (scope.canViewAllBranches) {
      return;
    }

    if (!scope.allowedBranchIds.length) {
      queryBuilder.andWhere(
        `${recordAlias}.created_by = :scopeUserId`,
      );
      return;
    }

    queryBuilder.andWhere(
      new Brackets((scopeQuery) => {
        scopeQuery
          .where(
            `${recordAlias}.created_by = :scopeUserId`,
          )
          .orWhere(
            `${policyAlias}.branch_id IN (:...scopeBranchIds)`,
          )
          .orWhere(
            `${quotationAlias}.branch_id IN (:...scopeBranchIds)`,
          );
      }),
    );
  }

  private applyReceiptScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    scope: TenantDataScope,
    requestedBranchId?: string,
  ) {
    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(
        new Brackets((ownQuery) => {
          ownQuery
            .where('receipt.received_by = :scopeUserId')
            .orWhere('invoice.created_by = :scopeUserId');
        }),
      );
      return;
    }

    if (requestedBranchId) {
      queryBuilder.andWhere(
        new Brackets((branchQuery) => {
          branchQuery
            .where('policy.branch_id = :requestedBranchId')
            .orWhere(
              'quotation.branch_id = :requestedBranchId',
            );
        }),
      );
      return;
    }

    if (scope.canViewAllBranches) {
      return;
    }

    if (!scope.allowedBranchIds.length) {
      queryBuilder.andWhere(
        new Brackets((ownQuery) => {
          ownQuery
            .where('receipt.received_by = :scopeUserId')
            .orWhere('invoice.created_by = :scopeUserId');
        }),
      );
      return;
    }

    queryBuilder.andWhere(
      new Brackets((scopeQuery) => {
        scopeQuery
          .where('receipt.received_by = :scopeUserId')
          .orWhere('invoice.created_by = :scopeUserId')
          .orWhere('policy.branch_id IN (:...scopeBranchIds)')
          .orWhere(
            'quotation.branch_id IN (:...scopeBranchIds)',
          );
      }),
    );
  }

  private applyTiramisScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    scope: TenantDataScope,
    requestedBranchId?: string,
  ) {
    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(
        'tracking.source_user_id = :scopeUserId',
      );
      return;
    }

    if (requestedBranchId) {
      queryBuilder.andWhere(
        new Brackets((branchQuery) => {
          branchQuery
            .where('tracking.source_user_id = :scopeUserId')
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM quotations scoped_quotation
                WHERE scoped_quotation.id::text = tracking.source_record_id
                  AND scoped_quotation.company_id = :scopeCompanyId
                  AND scoped_quotation.branch_id = :requestedBranchId
                  AND scoped_quotation.deleted_at IS NULL
              )
            `)
            .orWhere(`
              EXISTS (
                SELECT 1
                FROM policies scoped_policy
                WHERE scoped_policy.id::text = tracking.source_record_id
                  AND scoped_policy.company_id = :scopeCompanyId
                  AND scoped_policy.branch_id = :requestedBranchId
                  AND scoped_policy.deleted_at IS NULL
              )
            `);
        }),
      );
      return;
    }

    if (scope.canViewAllBranches) {
      return;
    }

    if (!scope.allowedBranchIds.length) {
      queryBuilder.andWhere(
        'tracking.source_user_id = :scopeUserId',
      );
      return;
    }

    queryBuilder.andWhere(
      new Brackets((scopeQuery) => {
        scopeQuery
          .where('tracking.source_user_id = :scopeUserId')
          .orWhere(`
            EXISTS (
              SELECT 1
              FROM quotations scoped_quotation
              WHERE scoped_quotation.id::text = tracking.source_record_id
                AND scoped_quotation.company_id = :scopeCompanyId
                AND scoped_quotation.branch_id IN (:...scopeBranchIds)
                AND scoped_quotation.deleted_at IS NULL
            )
          `)
          .orWhere(`
            EXISTS (
              SELECT 1
              FROM policies scoped_policy
              WHERE scoped_policy.id::text = tracking.source_record_id
                AND scoped_policy.company_id = :scopeCompanyId
                AND scoped_policy.branch_id IN (:...scopeBranchIds)
                AND scoped_policy.deleted_at IS NULL
            )
          `);
      }),
    );
  }

  private applyTiramisBusinessFilters<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    query: DashboardQueryDto,
  ) {
    if (!query.product_id && !query.channel_type) {
      return;
    }

    queryBuilder.andWhere(
      new Brackets((businessQuery) => {
        businessQuery
          .where(`
            EXISTS (
              SELECT 1
              FROM quotations scoped_quotation
              WHERE scoped_quotation.id::text = tracking.source_record_id
                AND scoped_quotation.deleted_at IS NULL
                ${
                  query.product_id
                    ? 'AND scoped_quotation.product_id = :productId'
                    : ''
                }
                ${
                  query.channel_type
                    ? 'AND scoped_quotation.channel_type = :channelType'
                    : ''
                }
            )
          `)
          .orWhere(`
            EXISTS (
              SELECT 1
              FROM policies scoped_policy
              WHERE scoped_policy.id::text = tracking.source_record_id
                AND scoped_policy.deleted_at IS NULL
                ${
                  query.product_id
                    ? 'AND scoped_policy.product_id = :productId'
                    : ''
                }
                ${
                  query.channel_type
                    ? 'AND scoped_policy.channel_type = :channelType'
                    : ''
                }
            )
          `);
      }),
    );
  }

  private buildContext(
    scope: TenantDataScope,
    query: DashboardQueryDto,
    period: DashboardPeriod,
  ) {
    return {
      period: {
        from: period.from,
        to: period.to,
        group_by: period.groupBy,
        timezone: this.timezone,
      },
      filters: {
        branch_id: query.branch_id ?? null,
        product_id: query.product_id ?? null,
        channel_type: query.channel_type ?? null,
        currency: query.currency ?? null,
        limit: query.limit ?? 10,
      },
      scope: {
        company_id: scope.companyId,
        active_branch_id: scope.activeBranchId,
        allowed_branch_ids: scope.allowedBranchIds,
        can_view_all_branches: scope.canViewAllBranches,
        own_records_only: scope.ownRecordsOnly,
      },
    };
  }

  private buildNavigation(
    companyType: CompanyType,
    sections: Record<string, boolean>,
  ) {
    return [
      {
        id: 'overview',
        label: 'Overview',
        path: '/tenant/dashboard',
        enabled: sections.overview,
      },
      {
        id: 'sales',
        label: 'Sales',
        path: '/tenant/dashboard/sales',
        enabled: sections.sales,
      },
      {
        id: 'policies',
        label: 'Policies',
        path: '/tenant/dashboard/policies',
        enabled: sections.policies,
      },
      {
        id: 'finance',
        label: 'Finance',
        path: '/tenant/dashboard/finance',
        enabled: sections.finance,
      },
      {
        id: 'tiramis',
        label: 'TIRAMIS',
        path: '/tenant/dashboard/tiramis',
        enabled: sections.tiramis,
      },
      {
        id: 'tasks',
        label: 'Tasks',
        path: '/tenant/dashboard/tasks',
        enabled: sections.tasks,
      },
      {
        id: 'claims',
        label: 'Claims',
        path: null,
        enabled: false,
        coming_soon: true,
      },
      {
        id: 'reinsurance',
        label:
          companyType === CompanyType.REINSURANCE_COMPANY
            ? 'Treaties'
            : 'Reinsurance',
        path: null,
        enabled: false,
        coming_soon: true,
      },
    ];
  }

  private hasPermission(
    user: AuthenticatedUser,
    permission: string,
  ) {
    return (user.permissions ?? []).includes(permission);
  }

  private dateBucketExpression(
    column: string,
    groupBy: DashboardGroupBy,
  ) {
    const localizedColumn = this.localizedTimestamp(column);

    switch (groupBy) {
      case DashboardGroupBy.WEEK:
        return `TO_CHAR(DATE_TRUNC('week', ${localizedColumn}), 'YYYY-MM-DD')`;
      case DashboardGroupBy.MONTH:
        return `TO_CHAR(DATE_TRUNC('month', ${localizedColumn}), 'YYYY-MM')`;
      case DashboardGroupBy.DAY:
      default:
        return `TO_CHAR(DATE_TRUNC('day', ${localizedColumn}), 'YYYY-MM-DD')`;
    }
  }

  private localizedTimestamp(column: string) {
    const timezone = this.timezone.replace(/'/g, "''");
    return `${column} AT TIME ZONE '${timezone}'`;
  }

  private localDateExpression(column: string) {
    return `DATE(${this.localizedTimestamp(column)})`;
  }

  private todayInTimeZone() {
    return this.formatDateInTimeZone(new Date());
  }

  private formatDateInTimeZone(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const lookup = new Map(
      parts.map((part) => [part.type, part.value]),
    );

    return `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')}`;
  }

  private parseIsoDate(value: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `Invalid ISO date: ${value}`,
      );
    }

    return parsed;
  }

  private addDays(value: string, days: number) {
    const date = this.parseIsoDate(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private normalizeMoneyRows(rows: MoneyByCurrency[]) {
    return rows.map((row) => ({
      currency: row.currency,
      amount: this.toAmountString(row.amount),
    }));
  }

  private normalizeCountBreakdown(rows: CountByLabel[]) {
    return rows.map((row) => ({
      label: row.label,
      count: this.toNumber(row.count),
    }));
  }

  private toAmountString(
    value: string | number | null | undefined,
  ) {
    const number = Number(value ?? 0);
    return Number.isFinite(number)
      ? number.toFixed(2)
      : '0.00';
  }

  private toNumber(
    value: string | number | null | undefined,
  ) {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
  }

  private roundPercentage(value: number) {
    return Math.round(value * 100) / 100;
  }
}
