import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';

interface ProductPerformanceRow {
  branch_id: string | null;
  department_id: string | null;
  user_id: string | null;
  product_id: string;
  currency: string;
  policies_count: string;
  gross_written_premium: string;
  earned_premium: string;
  ceded_premium: string;
  commissions: string;
  claims_count: string;
  claims_paid: string;
  outstanding_reserve: string;
  claims_incurred: string;
  premium_collected: string;
}

/**
 * Populates `product_performance_snapshots` from real underlying data —
 * previously nothing wrote to this table at all, so the one working report
 * type (`product-performance`) always returned zero rows.
 *
 * Current methodology, pending Finance validation:
 * - Written premium uses policies issued within the requested period.
 * - Earned premium prorates those policies through period end by days on risk.
 * - Claims created by period end use current claim balances, not historical balances.
 * - Collections use current paid amounts on POLICY-sourced invoices, without a period filter.
 * - Rows group by company, branch, department, user, product and policy currency.
 * Claim and invoice balances are grouped in their original currency. Source coverage
 * and historical balances must still be reconciled before operational use.
 */
@Injectable()
export class ProductPerformanceSnapshotService {
  private readonly logger = new Logger(ProductPerformanceSnapshotService.name);

  constructor(private readonly dataSource: DataSource) {}

  async refreshSnapshots(params: {
    companyId: string;
    periodStart: string;
    periodEnd: string;
    snapshotDate: string;
  }): Promise<number> {
    const count = await this.dataSource.transaction(async (manager) => {
      // Serialize refreshes of the same published snapshot across workers.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        [params.companyId, params.snapshotDate],
      );
      const rows: ProductPerformanceRow[] = await manager.query(
        `
      WITH policy_agg AS (
        SELECT
          branch_id,
          department_id,
          created_by AS user_id,
          product_id,
          currency,
          COUNT(*) AS policies_count,
          COALESCE(SUM(total_premium), 0) AS gross_written_premium,
          COALESCE(SUM(ceded_premium), 0) AS ceded_premium,
          COALESCE(SUM(total_commission), 0) AS commissions,
          COALESCE(SUM(
            total_premium * LEAST(1.0, GREATEST(0.0,
              (LEAST($3::date, end_date) - start_date + 1)::numeric
                / GREATEST(1, (end_date - start_date + 1))
            ))
          ), 0) AS earned_premium
        FROM policies
        WHERE company_id = $1
          AND deleted_at IS NULL
          AND issue_date BETWEEN $2 AND $3
        GROUP BY branch_id, department_id, created_by, product_id, currency
      ),
      claim_agg AS (
        SELECT
          p.branch_id,
          p.department_id,
          p.created_by AS user_id,
          p.product_id,
          c.currency_code AS currency,
          COUNT(DISTINCT c.id) AS claims_count,
          COALESCE(SUM(c.paid_amount), 0) AS claims_paid,
          COALESCE(SUM(c.outstanding_reserve), 0) AS outstanding_reserve,
          COALESCE(SUM(c.paid_amount + c.outstanding_reserve), 0) AS claims_incurred
        FROM claims c
        JOIN policies p ON p.id = c.policy_id AND p.company_id = c.company_id
        WHERE c.company_id = $1
          AND p.deleted_at IS NULL
          AND c.created_at::date <= $3::date
        GROUP BY p.branch_id, p.department_id, p.created_by, p.product_id, c.currency_code
      ),
      invoice_agg AS (
        SELECT
          p.branch_id,
          p.department_id,
          p.created_by AS user_id,
          p.product_id,
          i.currency AS currency,
          COALESCE(SUM(i.paid_amount), 0) AS premium_collected
        FROM invoices i
        JOIN policies p ON p.id = i.source_record_id AND p.company_id = i.company_id AND i.source_type = 'POLICY'
        WHERE i.company_id = $1
          AND i.deleted_at IS NULL AND p.deleted_at IS NULL
        GROUP BY p.branch_id, p.department_id, p.created_by, p.product_id, i.currency
      )
      SELECT
        COALESCE(pa.branch_id, ca.branch_id, ia.branch_id) AS branch_id,
        COALESCE(pa.department_id, ca.department_id, ia.department_id) AS department_id,
        COALESCE(pa.user_id, ca.user_id, ia.user_id) AS user_id,
        COALESCE(pa.product_id, ca.product_id, ia.product_id) AS product_id,
        COALESCE(pa.currency, ca.currency, ia.currency) AS currency,
        COALESCE(pa.policies_count, 0) AS policies_count,
        COALESCE(pa.gross_written_premium, 0) AS gross_written_premium,
        COALESCE(pa.earned_premium, 0) AS earned_premium,
        COALESCE(pa.ceded_premium, 0) AS ceded_premium,
        COALESCE(pa.commissions, 0) AS commissions,
        COALESCE(ca.claims_count, 0) AS claims_count,
        COALESCE(ca.claims_paid, 0) AS claims_paid,
        COALESCE(ca.outstanding_reserve, 0) AS outstanding_reserve,
        COALESCE(ca.claims_incurred, 0) AS claims_incurred,
        COALESCE(ia.premium_collected, 0) AS premium_collected
      FROM policy_agg pa
      FULL OUTER JOIN claim_agg ca
        ON ca.product_id = pa.product_id
        AND ca.currency = pa.currency
        AND ca.branch_id IS NOT DISTINCT FROM pa.branch_id
        AND ca.department_id IS NOT DISTINCT FROM pa.department_id
        AND ca.user_id IS NOT DISTINCT FROM pa.user_id
      FULL OUTER JOIN invoice_agg ia
        ON ia.product_id = COALESCE(pa.product_id, ca.product_id)
        AND ia.currency = COALESCE(pa.currency, ca.currency)
        AND ia.branch_id IS NOT DISTINCT FROM COALESCE(pa.branch_id, ca.branch_id)
        AND ia.department_id IS NOT DISTINCT FROM COALESCE(pa.department_id, ca.department_id)
        AND ia.user_id IS NOT DISTINCT FROM COALESCE(pa.user_id, ca.user_id)
      `,
        [params.companyId, params.periodStart, params.periodEnd],
      );

      for (const row of rows) this.validateRow(row);

      await manager.query(
        `
      DELETE FROM product_performance_snapshots
      WHERE company_id = $1 AND snapshot_date = $2
      `,
        [params.companyId, params.snapshotDate],
      );

      for (const row of rows) {
        const earnedPremium = Number(row.earned_premium);
        const claimsIncurred = Number(row.claims_incurred);
        const lossRatio =
          earnedPremium !== 0 ? claimsIncurred / earnedPremium : null;

        await manager.query(
          `
        INSERT INTO product_performance_snapshots (
          company_id,
          branch_id,
          department_id,
          user_id,
          product_id,
          currency,
          snapshot_date,
          period_start,
          period_end,
          gross_written_premium,
          earned_premium,
          premium_collected,
          claims_incurred,
          claims_paid,
          outstanding_reserve,
          ceded_premium,
          commissions,
          policies_count,
          claims_count,
          loss_ratio
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        `,
          [
            params.companyId,
            row.branch_id,
            row.department_id,
            row.user_id,
            row.product_id,
            row.currency,
            params.snapshotDate,
            params.periodStart,
            params.periodEnd,
            row.gross_written_premium,
            row.earned_premium,
            row.premium_collected,
            row.claims_incurred,
            row.claims_paid,
            row.outstanding_reserve,
            row.ceded_premium,
            row.commissions,
            Number(row.policies_count),
            Number(row.claims_count),
            lossRatio,
          ],
        );
      }

      return rows.length;
    });

    this.logger.log(
      `Refreshed ${count} product performance snapshot(s) for company ${params.companyId} as of ${params.snapshotDate}`,
    );
    return count;
  }

  private validateRow(row: ProductPerformanceRow): void {
    if (!row.product_id || !row.currency?.trim()) {
      throw new Error('Product performance row is missing product or currency');
    }
    const amounts = [
      row.gross_written_premium,
      row.earned_premium,
      row.ceded_premium,
      row.commissions,
      row.claims_paid,
      row.outstanding_reserve,
      row.claims_incurred,
      row.premium_collected,
    ];
    for (const value of amounts) {
      try {
        if (value == null || !new Decimal(value).isFinite())
          throw new Error('invalid');
      } catch {
        throw new Error('Product performance row contains an invalid amount');
      }
    }
    for (const value of [row.policies_count, row.claims_count]) {
      if (
        value == null ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < 0
      ) {
        throw new Error('Product performance row contains an invalid count');
      }
    }
  }
}
