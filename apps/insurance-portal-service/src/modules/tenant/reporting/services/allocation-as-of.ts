import Decimal from 'decimal.js';

/**
 * Inputs must be obtained from a company-scoped, complete invoice allocation
 * query, including currently reversed rows and their receipts. This calculation
 * is not an invoice balance: it excludes refunds, credits and write-offs.
 */
export interface HistoricalAllocation {
  id: string;
  invoiceId: string;
  companyId: string;
  currency: string;
  amount: string;
  allocatedAt: Date;
  createdAt: Date;
  status: 'ACTIVE' | 'REVERSED';
  reversedAt: Date | null;
  receipt: {
    companyId: string;
    currency: string;
    status: string;
    postedAt: Date | null;
    reversedAt: Date | null;
    deletedAt: Date | null;
  };
}

export interface AllocationAsOfInput {
  companyId: string;
  invoiceId: string;
  currency: string;
  /** Inclusive instant; the caller is responsible for period/time-zone rules. */
  cutoff: Date;
  allocations: HistoricalAllocation[];
}

function timestamp(date: Date, name: string): number {
  const value = date instanceof Date ? date.getTime() : NaN;
  if (!Number.isFinite(value)) throw new Error(`Invalid ${name}`);
  return value;
}

/**
 * Amount allocated at an instant from receipts posted by that instant.
 * Fails on incomplete or inconsistent source rows rather than reporting zero.
 * This helper is deliberately not wired into financial reports.
 */
export function calculateAllocatedPremiumAsOf(
  input: AllocationAsOfInput,
): string {
  const cutoff = timestamp(input.cutoff, 'cutoff');
  const ids = new Set<string>();
  let total = new Decimal(0);

  for (const row of input.allocations) {
    if (ids.has(row.id)) throw new Error('Duplicate allocation');
    ids.add(row.id);
    if (
      row.companyId !== input.companyId ||
      row.invoiceId !== input.invoiceId ||
      row.receipt.companyId !== input.companyId
    ) {
      throw new Error('Allocation ownership mismatch');
    }
    if (
      row.currency !== input.currency ||
      row.receipt.currency !== input.currency
    ) {
      throw new Error('Allocation currency mismatch');
    }
    const createdAt = timestamp(row.createdAt, 'allocation creation time');
    const allocatedAt = timestamp(row.allocatedAt, 'allocation time');
    if (createdAt > cutoff || allocatedAt > cutoff) continue;

    if (!row.receipt.postedAt)
      throw new Error('Receipt posting time is missing');
    const postedAt = timestamp(row.receipt.postedAt, 'receipt posting time');
    if (postedAt > cutoff) continue;
    if (postedAt > allocatedAt)
      throw new Error('Receipt posted after allocation');
    if (!['ACTIVE', 'REVERSED'].includes(row.status))
      throw new Error('Unknown allocation status');
    if (row.status === 'REVERSED' && !row.reversedAt)
      throw new Error('Allocation reversal time is missing');
    if (row.status === 'ACTIVE' && row.reversedAt)
      throw new Error('Inconsistent allocation reversal');
    if (row.receipt.status === 'REVERSED' && !row.receipt.reversedAt)
      throw new Error('Receipt reversal time is missing');
    if (
      ![
        'POSTED',
        'PARTIALLY_ALLOCATED',
        'FULLY_ALLOCATED',
        'REVERSED',
      ].includes(row.receipt.status)
    ) {
      throw new Error('Unsupported receipt status');
    }
    if (
      row.reversedAt &&
      timestamp(row.reversedAt, 'allocation reversal time') < allocatedAt
    ) {
      throw new Error('Allocation reversal precedes allocation');
    }
    if (
      row.receipt.reversedAt &&
      timestamp(row.receipt.reversedAt, 'receipt reversal time') < postedAt
    ) {
      throw new Error('Receipt reversal precedes posting');
    }
    if (
      row.receipt.deletedAt &&
      timestamp(row.receipt.deletedAt, 'receipt deletion time') <= cutoff
    ) {
      throw new Error('Deleted receipt requires reconciliation');
    }
    if (
      (row.reversedAt && row.reversedAt.getTime() <= cutoff) ||
      (row.receipt.reversedAt && row.receipt.reversedAt.getTime() <= cutoff)
    )
      continue;
    let amount: Decimal;
    try {
      amount = new Decimal(row.amount);
    } catch {
      throw new Error('Invalid allocation amount');
    }
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0))
      throw new Error('Invalid allocation amount');
    total = total.plus(amount);
  }
  return total.toFixed(4);
}
