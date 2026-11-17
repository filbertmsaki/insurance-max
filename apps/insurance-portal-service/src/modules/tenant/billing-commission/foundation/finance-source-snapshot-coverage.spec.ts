import { assertSourceSnapshotCoverage } from './finance-source-snapshot-coverage';

describe('company source snapshot coverage', () => {
  const hq = { id: 'hq', code: 'HQ', status: 'active' };
  const east = { id: 'east', code: 'EAST', status: 'active' };
  const product = { id: 'product', version: 'v1' };
  it('accepts a snapshot covering the reviewed dimensions of multiple books', () => {
    expect(() =>
      assertSourceSnapshotCoverage(
        { branches: [hq, east], products: [product] },
        [
          { branches: [hq], products: [product] },
          { branches: [east], products: [] },
        ],
      ),
    ).not.toThrow();
  });
  it('holds a revision that omits or changes another book’s dimension', () => {
    const other = [{ branches: [east], products: [product] }];
    expect(() =>
      assertSourceSnapshotCoverage(
        { branches: [hq], products: [product] },
        other,
      ),
    ).toThrow('does not cover');
    expect(() =>
      assertSourceSnapshotCoverage(
        { branches: [east], products: [{ ...product, version: 'v2' }] },
        other,
      ),
    ).toThrow('does not cover');
  });
});
