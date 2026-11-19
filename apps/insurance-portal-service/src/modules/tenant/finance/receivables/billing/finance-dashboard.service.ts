import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface FinanceDashboardAmount {
  currency: string;
  count: number;
  amount: string;
}

export interface FinanceDashboardSummary {
  openInvoices: FinanceDashboardAmount[];
  receipts: FinanceDashboardAmount[];
  paidRefunds: FinanceDashboardAmount[];
  journalCount: number;
}

export interface FinanceReceivableAge {
  currency: string;
  bucket: 'NO_DUE_DATE' | 'CURRENT' | '1_30' | '31_60' | '61_90' | 'OVER_90';
  count: number;
  amount: string;
}

type AggregateRow = {
  kind: 'invoice' | 'receipt' | 'refund';
  currency: string;
  record_count: string;
  amount: string;
};

/** All rows are aggregated by PostgreSQL; no paged result is treated as a total. */
@Injectable()
export class FinanceDashboardService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Current outstanding balances, grouped by due date and currency. */
  async receivableAging(companyId: string): Promise<FinanceReceivableAge[]> {
    const rows = await this.dataSource.query(
      `SELECT currency, bucket, COUNT(*)::text AS record_count,
              SUM(balance_amount)::text AS amount
         FROM (
           SELECT currency, balance_amount,
             CASE
               WHEN due_date IS NULL THEN 'NO_DUE_DATE'
               WHEN due_date >= CURRENT_DATE THEN 'CURRENT'
               WHEN CURRENT_DATE - due_date <= 30 THEN '1_30'
               WHEN CURRENT_DATE - due_date <= 60 THEN '31_60'
               WHEN CURRENT_DATE - due_date <= 90 THEN '61_90'
               ELSE 'OVER_90'
             END AS bucket
           FROM invoices
           WHERE company_id = $1 AND deleted_at IS NULL AND balance_amount > 0
             AND status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERPAID')
         ) outstanding
        GROUP BY currency, bucket ORDER BY currency, bucket`,
      [companyId],
    );
    return rows.map(
      (row: {
        currency: string;
        bucket: FinanceReceivableAge['bucket'];
        record_count: string;
        amount: string;
      }) => ({
        currency: row.currency,
        bucket: row.bucket,
        count: Number(row.record_count),
        amount: row.amount,
      }),
    );
  }

  async summary(companyId: string): Promise<FinanceDashboardSummary> {
    const rows = (await this.dataSource.query(
      `SELECT 'invoice' AS kind, currency, COUNT(*)::text AS record_count,
              COALESCE(SUM(balance_amount), 0)::text AS amount
         FROM invoices
        WHERE company_id = $1 AND deleted_at IS NULL AND balance_amount > 0
          AND status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERPAID')
        GROUP BY currency
       UNION ALL
       SELECT 'receipt' AS kind, currency, COUNT(*)::text AS record_count,
              COALESCE(SUM(amount), 0)::text AS amount
         FROM receipts
        WHERE company_id = $1 AND deleted_at IS NULL
          AND status IN ('POSTED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED')
        GROUP BY currency
       UNION ALL
       SELECT 'refund' AS kind, currency_code AS currency,
              COUNT(*)::text AS record_count,
              COALESCE(SUM(amount), 0)::text AS amount
         FROM finance_refunds
        WHERE company_id = $1 AND status = 'PAID'
        GROUP BY currency_code`,
      [companyId],
    )) as AggregateRow[];
    const [journalRow] = (await this.dataSource.query(
      `SELECT COUNT(*)::text AS record_count
         FROM finance_journal_entries WHERE company_id = $1`,
      [companyId],
    )) as Array<{ record_count: string }>;

    const group = (kind: AggregateRow['kind']): FinanceDashboardAmount[] =>
      rows
        .filter((row) => row.kind === kind)
        .map((row) => ({
          currency: row.currency,
          count: Number(row.record_count),
          amount: row.amount,
        }))
        .sort((left, right) => left.currency.localeCompare(right.currency));

    return {
      openInvoices: group('invoice'),
      receipts: group('receipt'),
      paidRefunds: group('refund'),
      journalCount: Number(journalRow?.record_count ?? 0),
    };
  }
}
