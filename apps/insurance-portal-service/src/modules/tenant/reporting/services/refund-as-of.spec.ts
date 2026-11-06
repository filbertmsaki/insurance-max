import {
  calculatePaidRefundsAsOf,
  type HistoricalRefund,
} from './refund-as-of';
const date = (s: string) => new Date(s);
const cutoff = date('2026-06-30T20:59:59.999Z');
const refund = (
  overrides: Partial<HistoricalRefund> = {},
): HistoricalRefund => ({
  id: 'r1',
  companyId: 'co',
  invoiceId: 'inv',
  currency: 'TZS',
  amount: '50.25',
  status: 'PAID',
  createdAt: date('2026-06-01T00:00:00Z'),
  paidAt: date('2026-06-15T00:00:00Z'),
  ...overrides,
});
const calculate = (refunds: HistoricalRefund[]) =>
  calculatePaidRefundsAsOf({
    companyId: 'co',
    invoiceId: 'inv',
    currency: 'TZS',
    cutoff,
    refunds,
  });
describe('paid refunds as of cutoff', () => {
  it('includes only refunds paid by the cutoff', () => {
    expect(
      calculate([
        refund(),
        refund({ id: 'r2', paidAt: date('2026-07-01T00:00:00Z') }),
        refund({ id: 'r3', status: 'REQUESTED', paidAt: null }),
      ]),
    ).toBe('50.2500');
  });
  it('rejects unknown, incomplete or inconsistent payment history', () => {
    expect(() => calculate([refund({ paidAt: null })])).toThrow('payment time');
    expect(() => calculate([refund({ status: 'REVERSED' })])).toThrow(
      'requires reconciliation',
    );
    expect(() => calculate([refund({ status: 'FAILED' })])).toThrow(
      'requires reconciliation',
    );
  });
  it('rejects wrong scopes, mixed currency and duplicate refunds', () => {
    expect(() => calculate([refund({ companyId: 'other' })])).toThrow(
      'ownership',
    );
    expect(() => calculate([refund({ currency: 'USD' })])).toThrow('currency');
    expect(() => calculate([refund(), refund()])).toThrow('Duplicate');
  });
  it('sums decimal amounts without binary rounding', () => {
    expect(
      calculate([
        refund({ amount: '0.10' }),
        refund({ id: 'r2', amount: '0.20' }),
      ]),
    ).toBe('0.3000');
  });
});
