import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
 * Methodology (documented since none of this is enforced by a spec):
 * - "Written" is scoped to policies whose `issue_date` falls in the period.
 * - Earned premium is a simple day-count proration of the full-term
 *   premium as of the snapshot date — not a per-risk rating re-run.
 * - Claims are aggregated as of the snapshot date regardless of when the
 *   underlying policy was written (a claim on an older policy still counts
 *   toward that product's current outstanding reserve).
 * - Premium collected is the sum of paid amounts on `POLICY`-sourced
 *   invoices for policies of that product (not scoped to the period,
 *   mirroring real collections lagging the writing period).
 * - Aggregated at (company, product) — branch-level breakdown is out of
 *   scope for this pass; `branch_id` is left null on every snapshot row.
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
    const rows: ProductPerformanceRow[] = await this.dataSource.query(
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
            )) / GREATEST(1, (end_date - start_date + 1))
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
          COUNT(DISTINCT c.id) AS claims_count,
          COALESCE(SUM(c.paid_amount), 0) AS claims_paid,
          COALESCE(SUM(c.outstanding_reserve), 0) AS outstanding_reserve,
          COALESCE(SUM(c.paid_amount + c.outstanding_reserve), 0) AS claims_incurred
        FROM claims c
        JOIN policies p ON p.id = c.policy_id
        WHERE c.company_id = $1
          AND c.created_at::date <= $3::date
        GROUP BY p.branch_id, p.department_id, p.created_by, p.product_id
      ),
      invoice_agg AS (
        SELECT
          p.branch_id,
          p.department_id,
          p.created_by AS user_id,
          p.product_id,
          COALESCE(SUM(i.paid_amount), 0) AS premium_collected
        FROM invoices i
        JOIN policies p ON p.id = i.source_record_id AND i.source_type = 'POLICY'
        WHERE i.company_id = $1
        GROUP BY p.branch_id, p.department_id, p.created_by, p.product_id
      )
      SELECT
        COALESCE(pa.branch_id, ca.branch_id, ia.branch_id) AS branch_id,
        COALESCE(pa.department_id, ca.department_id, ia.department_id) AS department_id,
        COALESCE(pa.user_id, ca.user_id, ia.user_id) AS user_id,
        COALESCE(pa.product_id, ca.product_id, ia.product_id) AS product_id,
        COALESCE(pa.currency, 'TZS') AS currency,
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
        AND ca.branch_id IS NOT DISTINCT FROM pa.branch_id
        AND ca.department_id IS NOT DISTINCT FROM pa.department_id
        AND ca.user_id IS NOT DISTINCT FROM pa.user_id
      FULL OUTER JOIN invoice_agg ia
        ON ia.product_id = COALESCE(pa.product_id, ca.product_id)
        AND ia.branch_id IS NOT DISTINCT FROM COALESCE(pa.branch_id, ca.branch_id)
        AND ia.department_id IS NOT DISTINCT FROM COALESCE(pa.department_id, ca.department_id)
        AND ia.user_id IS NOT DISTINCT FROM COALESCE(pa.user_id, ca.user_id)
      `,
      [params.companyId, params.periodStart, params.periodEnd],
    );

    await this.dataSource.query(
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

      await this.dataSource.query(
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
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

    this.logger.log(
      `Refreshed ${rows.length} product performance snapshot(s) for company ${params.companyId} as of ${params.snapshotDate}`,
    );

    return rows.length;
  }
}
