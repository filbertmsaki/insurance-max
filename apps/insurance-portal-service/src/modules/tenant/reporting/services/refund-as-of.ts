import Decimal from 'decimal.js';

/** A scoped refund row. The caller must supply all historical rows for an invoice. */
export interface HistoricalRefund {
  id: string;
  companyId: string;
  invoiceId: string | null;
  currency: string;
  amount: string;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
}

/**
 * Sum paid refunds at an inclusive cutoff, separate from receipt allocations.
 * Reversed or incomplete payment history must be reconciled by the caller.
 * This calculation is not wired into the production report.
 */
export function calculatePaidRefundsAsOf(input: {
  companyId: string;
  invoiceId: string;
  currency: string;
  cutoff: Date;
  refunds: HistoricalRefund[];
}): string {
  const cutoff = input.cutoff instanceof Date ? input.cutoff.getTime() : NaN;
  if (!Number.isFinite(cutoff)) throw new Error('Invalid cutoff');
  const ids = new Set<string>();
  let total = new Decimal(0);
  const unpaidStatuses = [
    'REQUESTED',
    'APPROVED',
    'PROCESSING',
    'FAILED',
    'CANCELLED',
  ];
  for (const refund of input.refunds) {
    if (ids.has(refund.id)) throw new Error('Duplicate refund');
    ids.add(refund.id);
    if (
      refund.companyId !== input.companyId ||
      refund.invoiceId !== input.invoiceId
    ) {
      throw new Error('Refund ownership mismatch');
    }
    if (refund.currency !== input.currency)
      throw new Error('Refund currency mismatch');
    const created =
      refund.createdAt instanceof Date ? refund.createdAt.getTime() : NaN;
    if (!Number.isFinite(created))
      throw new Error('Invalid refund creation time');
    if (created > cutoff) continue;
    if (refund.status !== 'PAID') {
      if (!unpaidStatuses.includes(refund.status) || refund.paidAt) {
        throw new Error('Refund payment history requires reconciliation');
      }
      continue;
    }
    const paid = refund.paidAt instanceof Date ? refund.paidAt.getTime() : NaN;
    if (!Number.isFinite(paid) || paid < created)
      throw new Error('Invalid refund payment time');
    if (paid > cutoff) continue;
    let amount: Decimal;
    try {
      amount = new Decimal(refund.amount);
    } catch {
      throw new Error('Invalid refund amount');
    }
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0))
      throw new Error('Invalid refund amount');
    total = total.plus(amount);
  }
  return total.toFixed(4);
}
