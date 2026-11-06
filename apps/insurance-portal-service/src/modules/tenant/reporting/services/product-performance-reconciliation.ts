import Decimal from 'decimal.js';

export interface ReconciliationContext {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  cutoff: string;
  /** Explicitly identifies the approved date basis and calculation definition. */
  basis: string;
}

export interface ReconciliationRow {
  metric: string;
  branchId: string | null;
  departmentId: string | null;
  userId: string | null;
  productId: string | null;
  currency: string;
  amount: string;
}

export interface ReconciliationDataset {
  context: ReconciliationContext;
  rows: ReconciliationRow[];
}

export interface ReconciliationDifference {
  dimensions: Omit<ReconciliationRow, 'amount'>;
  reportAmount: string | null;
  sourceAmount: string | null;
  difference: string | null;
  status: 'MATCH' | 'MISMATCH' | 'MISSING_REPORT' | 'MISSING_SOURCE';
}

/** Compare independent, already scoped totals. This does not retrieve or validate source data. */
export function reconcileProductPerformance(
  report: ReconciliationDataset,
  source: ReconciliationDataset,
): ReconciliationDifference[] {
  for (const field of [
    'companyId',
    'periodStart',
    'periodEnd',
    'cutoff',
    'basis',
  ] as const) {
    if (
      !report.context[field]?.trim() ||
      report.context[field] !== source.context[field]
    ) {
      throw new Error(`Reconciliation context mismatch: ${field}`);
    }
  }
  const makeIndex = (rows: ReconciliationRow[]) => {
    const result = new Map<
      string,
      { dimensions: Omit<ReconciliationRow, 'amount'>; amount: Decimal }
    >();
    for (const row of rows) {
      if (!row.metric.trim() || !row.currency.trim())
        throw new Error('Missing metric or currency');
      const dimensions = {
        metric: row.metric,
        branchId: row.branchId,
        departmentId: row.departmentId,
        userId: row.userId,
        productId: row.productId,
        currency: row.currency,
      };
      const key = JSON.stringify(Object.values(dimensions));
      if (result.has(key))
        throw new Error('Duplicate reconciliation dimensions');
      let amount: Decimal;
      try {
        amount = new Decimal(row.amount);
      } catch {
        throw new Error('Invalid reconciliation amount');
      }
      if (!amount.isFinite()) throw new Error('Invalid reconciliation amount');
      result.set(key, { dimensions, amount });
    }
    return result;
  };
  const format = (value: Decimal) =>
    value.toFixed(Math.max(4, value.decimalPlaces()));
  const reports = makeIndex(report.rows);
  const sources = makeIndex(source.rows);
  const keys = [...new Set([...reports.keys(), ...sources.keys()])].sort();
  return keys.map((key) => {
    const left = reports.get(key);
    const right = sources.get(key);
    const difference = left && right ? left.amount.minus(right.amount) : null;
    return {
      dimensions: (left ?? right)!.dimensions,
      reportAmount: left ? format(left.amount) : null,
      sourceAmount: right ? format(right.amount) : null,
      difference: difference ? format(difference) : null,
      status: !left
        ? 'MISSING_REPORT'
        : !right
          ? 'MISSING_SOURCE'
          : difference!.isZero()
            ? 'MATCH'
            : 'MISMATCH',
    };
  });
}
