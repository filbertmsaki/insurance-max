import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PortalAccount } from '../entities/portal-account.entity';
import { PortalActorType } from '../enums/portal.enums';

@Injectable()
export class PortalDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  build(account: PortalAccount) {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      return this.customerDashboard(account);
    }

    if (account.actor_type === PortalActorType.INTERMEDIARY) {
      return this.intermediaryDashboard(account);
    }

    throw new ForbiddenException('Unsupported portal account type');
  }

  private async customerDashboard(account: PortalAccount) {
    if (!account.customer_id) {
      throw new ForbiddenException(
        'Customer portal account is not linked to a customer',
      );
    }

    const [
      quotations,
      policies,
      invoiceBalances,
      requests,
      notifications,
      recentRequests,
    ] = await Promise.all([
      this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer AS total,
          COUNT(*) FILTER (
            WHERE quotation_status IN ('DRAFT', 'INCOMPLETE', 'RETURNED')
          )::integer AS drafts,
          COUNT(*) FILTER (
            WHERE quotation_status IN (
              'SUBMITTED', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING_TIRA'
            )
          )::integer AS in_progress,
          COUNT(*) FILTER (
            WHERE quotation_status IN ('COMPLETED', 'POLICY_ISSUED')
          )::integer AS completed
        FROM quotations
        WHERE company_id = $1 AND customer_id = $2 AND deleted_at IS NULL
        `,
        [account.company_id, account.customer_id],
      ),

      this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer AS total,
          COUNT(*) FILTER (
            WHERE policy_status IN ('ACTIVE', 'ISSUED', 'IN_FORCE')
          )::integer AS active,
          COUNT(*) FILTER (
            WHERE end_date >= (timezone('Africa/Dar_es_Salaam', now()))::date
              AND end_date <= (timezone('Africa/Dar_es_Salaam', now()))::date + INTERVAL '30 days'
              AND policy_status NOT IN ('CANCELLED', 'VOID')
          )::integer AS expiring_soon
        FROM policies
        WHERE company_id = $1 AND customer_id = $2 AND deleted_at IS NULL
        `,
        [account.company_id, account.customer_id],
      ),

      this.dataSource.query(
        `
        SELECT
          currency,
          COUNT(*)::integer AS invoice_count,
          COALESCE(SUM(balance_amount), 0) AS outstanding_amount
        FROM invoices
        WHERE company_id = $1 AND customer_id = $2 AND deleted_at IS NULL
          AND status NOT IN ('VOID', 'CANCELLED', 'PAID')
          AND balance_amount > 0
        GROUP BY currency
        ORDER BY currency ASC
        `,
        [account.company_id, account.customer_id],
      ),

      this.dataSource.query(
        `
        SELECT
          COUNT(*) FILTER (
            WHERE status NOT IN ('REJECTED', 'COMPLETED', 'CANCELLED')
          )::integer AS open_count,
          COUNT(*) FILTER (
            WHERE status = 'ADDITIONAL_INFO_REQUIRED'
          )::integer AS action_required,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::integer AS completed_count
        FROM portal_service_requests
        WHERE portal_account_id = $1 AND deleted_at IS NULL
        `,
        [account.id],
      ),

      this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer AS total_count,
          COUNT(*) FILTER (WHERE read_at IS NULL)::integer AS unread_count
        FROM portal_notifications
        WHERE company_id = $1 AND user_id = $2
        `,
        [account.company_id, account.user_id],
      ),

      this.dataSource.query(
        `
        SELECT id, request_no, request_type, status, subject, submitted_at, created_at
        FROM portal_service_requests
        WHERE portal_account_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 5
        `,
        [account.id],
      ),
    ]);

    return {
      actor_type: PortalActorType.CUSTOMER,
      quotations: quotations[0] ?? {
        total: 0,
        drafts: 0,
        in_progress: 0,
        completed: 0,
      },
      policies: policies[0] ?? { total: 0, active: 0, expiring_soon: 0 },
      finance: {
        outstanding_by_currency: invoiceBalances.map(
          (row: {
            currency: string;
            invoice_count: number;
            outstanding_amount: string;
          }) => ({
            currency: row.currency,
            invoice_count: Number(row.invoice_count),
            outstanding_amount: row.outstanding_amount,
          }),
        ),
      },
      requests: requests[0] ?? {
        open_count: 0,
        action_required: 0,
        completed_count: 0,
      },
      notifications: notifications[0] ?? { total_count: 0, unread_count: 0 },
      recent_requests: recentRequests,
    };
  }

  private async intermediaryDashboard(account: PortalAccount) {
    if (!account.intermediary_company_id) {
      throw new ForbiddenException(
        'Intermediary portal account is not linked to an intermediary company',
      );
    }

    const intermediaryCompanyId = account.intermediary_company_id;

    const [
      customers,
      quotations,
      policies,
      invoiceBalances,
      commissions,
      requests,
      notifications,
      recentRequests,
    ] = await Promise.all([
      this.dataSource.query(
        `
        SELECT COUNT(DISTINCT customer_id)::integer AS total
        FROM (
          SELECT customer.id AS customer_id
          FROM customers customer
          WHERE customer.company_id = $1 AND customer.deleted_at IS NULL

          UNION

          SELECT quotation.customer_id
          FROM quotations quotation
          WHERE quotation.intermediary_company_id = $1
            AND quotation.customer_id IS NOT NULL
            AND quotation.deleted_at IS NULL

          UNION

          SELECT policy.customer_id
          FROM policies policy
          WHERE policy.intermediary_company_id = $1
            AND policy.customer_id IS NOT NULL
            AND policy.deleted_at IS NULL
        ) portfolio
        `,
        [intermediaryCompanyId],
      ),

      this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer AS total,
          COUNT(*) FILTER (
            WHERE quotation_status IN ('DRAFT', 'INCOMPLETE', 'RETURNED')
          )::integer AS drafts,
          COUNT(*) FILTER (
            WHERE quotation_status IN (
              'SUBMITTED', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING_TIRA'
            )
          )::integer AS in_progress,
          COUNT(*) FILTER (
            WHERE quotation_status IN ('COMPLETED', 'POLICY_ISSUED')
          )::integer AS completed
        FROM quotations
        WHERE intermediary_company_id = $1 AND deleted_at IS NULL
        `,
        [intermediaryCompanyId],
      ),

      this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer AS total,
          COUNT(*) FILTER (
            WHERE policy_status IN ('ACTIVE', 'ISSUED', 'IN_FORCE')
          )::integer AS active,
          COUNT(*) FILTER (
            WHERE end_date >= (timezone('Africa/Dar_es_Salaam', now()))::date
              AND end_date <= (timezone('Africa/Dar_es_Salaam', now()))::date + INTERVAL '60 days'
              AND policy_status NOT IN ('CANCELLED', 'VOID')
          )::integer AS renewal_pipeline
        FROM policies
        WHERE intermediary_company_id = $1 AND deleted_at IS NULL
        `,
        [intermediaryCompanyId],
      ),

      this.dataSource.query(
        `
        SELECT
          currency,
          COUNT(*)::integer AS invoice_count,
          COALESCE(SUM(balance_amount), 0) AS outstanding_amount
        FROM invoices
        WHERE intermediary_company_id = $1 AND deleted_at IS NULL
          AND status NOT IN ('VOID', 'CANCELLED', 'PAID')
          AND balance_amount > 0
        GROUP BY currency
        ORDER BY currency ASC
        `,
        [intermediaryCompanyId],
      ),

      this.dataSource.query(
        `
        SELECT
          COALESCE(policy.currency, 'UNKNOWN') AS currency,
          COUNT(*)::integer AS transaction_count,
          COALESCE(SUM(commission.commission_amount), 0) AS commission_amount,
          COALESCE(
            SUM(commission.commission_amount) FILTER (
              WHERE commission.status IN ('EARNED', 'APPROVED', 'PAYABLE')
            ),
            0
          ) AS outstanding_amount
        FROM commission_transactions commission
        LEFT JOIN policies policy ON policy.id = commission.policy_id
        WHERE commission.intermediary_company_id = $1
          AND commission.deleted_at IS NULL
        GROUP BY COALESCE(policy.currency, 'UNKNOWN')
        ORDER BY currency ASC
        `,
        [intermediaryCompanyId],
      ),

      this.dataSource.query(
        `
        SELECT
          COUNT(*) FILTER (
            WHERE status NOT IN ('REJECTED', 'COMPLETED', 'CANCELLED')
          )::integer AS open_count,
          COUNT(*) FILTER (
            WHERE status = 'ADDITIONAL_INFO_REQUIRED'
          )::integer AS action_required,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::integer AS completed_count
        FROM portal_service_requests
        WHERE portal_account_id = $1 AND deleted_at IS NULL
        `,
        [account.id],
      ),

      this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer AS total_count,
          COUNT(*) FILTER (WHERE read_at IS NULL)::integer AS unread_count
        FROM portal_notifications
        WHERE company_id = $1 AND user_id = $2
        `,
        [account.company_id, account.user_id],
      ),

      this.dataSource.query(
        `
        SELECT id, request_no, request_type, status, subject, submitted_at, created_at
        FROM portal_service_requests
        WHERE portal_account_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 5
        `,
        [account.id],
      ),
    ]);

    return {
      actor_type: PortalActorType.INTERMEDIARY,
      customers: customers[0] ?? { total: 0 },
      quotations: quotations[0] ?? {
        total: 0,
        drafts: 0,
        in_progress: 0,
        completed: 0,
      },
      policies: policies[0] ?? { total: 0, active: 0, renewal_pipeline: 0 },
      finance: {
        outstanding_invoices_by_currency: invoiceBalances.map(
          (row: {
            currency: string;
            invoice_count: number;
            outstanding_amount: string;
          }) => ({
            currency: row.currency,
            invoice_count: Number(row.invoice_count),
            outstanding_amount: row.outstanding_amount,
          }),
        ),
        commissions_by_currency: commissions.map(
          (row: {
            currency: string;
            transaction_count: number;
            commission_amount: string;
            outstanding_amount: string;
          }) => ({
            currency: row.currency,
            transaction_count: Number(row.transaction_count),
            commission_amount: row.commission_amount,
            outstanding_amount: row.outstanding_amount,
          }),
        ),
      },
      requests: requests[0] ?? {
        open_count: 0,
        action_required: 0,
        completed_count: 0,
      },
      notifications: notifications[0] ?? { total_count: 0, unread_count: 0 },
      recent_requests: recentRequests,
    };
  }
}
