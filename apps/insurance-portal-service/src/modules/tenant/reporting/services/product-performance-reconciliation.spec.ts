import {
  reconcileProductPerformance,
  type ReconciliationDataset,
  type ReconciliationRow,
} from './product-performance-reconciliation';
const context = {
  companyId: 'co',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  cutoff: '2026-06-30T20:59:59.999Z',
  basis: 'posted-v1',
};
const row = (
  overrides: Partial<ReconciliationRow> = {},
): ReconciliationRow => ({
  metric: 'premium_allocated',
  branchId: 'branch',
  departmentId: null,
  userId: null,
  productId: 'product',
  currency: 'TZS',
  amount: '100.00',
  ...overrides,
});
const dataset = (rows: ReconciliationRow[]): ReconciliationDataset => ({
  context,
  rows,
});
describe('product performance reconciliation', () => {
  it('compares decimal totals and exposes discrepancies', () => {
    expect(
      reconcileProductPerformance(
        dataset([row()]),
        dataset([row({ amount: '99.90' })]),
      )[0],
    ).toMatchObject({ status: 'MISMATCH', difference: '0.1000' });
    expect(
      reconcileProductPerformance(
        dataset([row()]),
        dataset([row({ amount: '100.0000' })]),
      )[0].status,
    ).toBe('MATCH');
  });
  it('preserves precision for small differences', () => {
    expect(
      reconcileProductPerformance(
        dataset([row({ amount: '1.00001' })]),
        dataset([row({ amount: '1' })]),
      )[0],
    ).toMatchObject({ status: 'MISMATCH', difference: '0.00001' });
  });
  it('keeps currencies separate and reports missing sides rather than assuming zero', () => {
    const results = reconcileProductPerformance(
      dataset([row()]),
      dataset([row({ currency: 'USD' })]),
    );
    expect(results.map((result) => result.status).sort()).toEqual([
      'MISSING_REPORT',
      'MISSING_SOURCE',
    ]);
    expect(results.every((result) => result.difference === null)).toBe(true);
  });
  it('refuses mismatched accounting periods, company, cutoff and basis', () => {
    for (const [key, value] of [
      ['companyId', 'other'],
      ['periodStart', '2026-05-01'],
      ['cutoff', '2026-07-01'],
      ['basis', 'other'],
    ]) {
      expect(() =>
        reconcileProductPerformance(dataset([row()]), {
          context: { ...context, [key]: value },
          rows: [row()],
        }),
      ).toThrow('context mismatch');
    }
  });
  it('rejects duplicate dimensions and invalid amounts', () => {
    expect(() =>
      reconcileProductPerformance(dataset([row(), row()]), dataset([])),
    ).toThrow('Duplicate');
    expect(() =>
      reconcileProductPerformance(
        dataset([row({ amount: 'NaN' })]),
        dataset([]),
      ),
    ).toThrow('Invalid');
  });
});
