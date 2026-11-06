import {
  calculateAllocatedPremiumAsOf,
  type HistoricalAllocation,
} from './allocation-as-of';

const date = (value: string) => new Date(value);
const cutoff = date('2026-06-30T20:59:59.999Z');
function allocation(
  overrides: Partial<HistoricalAllocation> = {},
): HistoricalAllocation {
  return {
    id: 'a1',
    companyId: 'co1',
    invoiceId: 'i1',
    currency: 'TZS',
    amount: '100.25',
    createdAt: date('2026-06-10T08:00:00Z'),
    allocatedAt: date('2026-06-10T08:00:00Z'),
    status: 'ACTIVE',
    reversedAt: null,
    receipt: {
      companyId: 'co1',
      currency: 'TZS',
      status: 'FULLY_ALLOCATED',
      postedAt: date('2026-06-10T07:00:00Z'),
      reversedAt: null,
      deletedAt: null,
    },
    ...overrides,
  };
}
function calculate(rows: HistoricalAllocation[]) {
  return calculateAllocatedPremiumAsOf({
    companyId: 'co1',
    invoiceId: 'i1',
    currency: 'TZS',
    cutoff,
    allocations: rows,
  });
}

describe('historical allocated premium', () => {
  it('uses posting and reversal timestamps instead of current reversed status', () => {
    const row = allocation({
      status: 'REVERSED',
      reversedAt: date('2026-07-01T10:00:00Z'),
    });
    expect(calculate([row])).toBe('100.2500');
    row.reversedAt = cutoff;
    expect(calculate([row])).toBe('0.0000');
  });
  it('excludes allocations recorded or effective after the cutoff', () => {
    expect(
      calculate([allocation({ createdAt: date('2026-07-01T00:00:00Z') })]),
    ).toBe('0.0000');
    expect(
      calculate([allocation({ allocatedAt: date('2026-07-01T00:00:00Z') })]),
    ).toBe('0.0000');
  });
  it('handles receipt reversal after and at cutoff', () => {
    const row = allocation();
    row.receipt.status = 'REVERSED';
    row.receipt.reversedAt = date('2026-07-01T10:00:00Z');
    expect(calculate([row])).toBe('100.2500');
    row.receipt.reversedAt = cutoff;
    expect(calculate([row])).toBe('0.0000');
  });
  it('rejects missing reversal history, duplicate rows, and wrong scope or currency', () => {
    expect(() => calculate([allocation({ status: 'REVERSED' })])).toThrow(
      'reversal time',
    );
    expect(() => calculate([allocation(), allocation()])).toThrow(
      'Duplicate allocation',
    );
    expect(() => calculate([allocation({ companyId: 'other' })])).toThrow(
      'ownership',
    );
    expect(() => calculate([allocation({ currency: 'USD' })])).toThrow(
      'currency',
    );
  });
  it('uses decimal arithmetic for multiple allocations', () => {
    expect(
      calculate([
        allocation({ amount: '0.10' }),
        allocation({ id: 'a2', amount: '0.20' }),
      ]),
    ).toBe('0.3000');
  });
});
