import { randomUUID } from 'node:crypto';
import {
  FinanceDimensionMaster,
  validateDimensionSelection,
} from './finance-dimension-master';

describe('company dimension snapshot selection', () => {
  const fixture = () => {
    const companyId = randomUUID(),
      branchId = randomUUID(),
      productId = randomUUID();
    const master: FinanceDimensionMaster = {
      companyId,
      values: [
        {
          kind: 'BRANCH',
          id: branchId,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2026-12-31',
        },
        {
          kind: 'PRODUCT',
          id: productId,
          effectiveFrom: '2026-11-01',
          effectiveTo: null,
        },
      ],
    };
    return { companyId, branchId, productId, master };
  };
  it('accepts effective company-owned branch and product selections on interval boundaries', () => {
    const f = fixture();
    expect(() =>
      validateDimensionSelection(
        f.master,
        f.companyId.toUpperCase(),
        '2026-12-31',
        { branchId: f.branchId.toUpperCase(), productId: f.productId },
      ),
    ).not.toThrow();
  });
  it('rejects cross-company, unknown and outside-interval selections', () => {
    const f = fixture();
    expect(() =>
      validateDimensionSelection(f.master, randomUUID(), '2026-12-01', {
        branchId: f.branchId,
      }),
    ).toThrow();
    expect(() =>
      validateDimensionSelection(f.master, f.companyId, '2026-12-01', {
        productId: randomUUID(),
      }),
    ).toThrow();
    expect(() =>
      validateDimensionSelection(f.master, f.companyId, '2027-01-01', {
        branchId: f.branchId,
      }),
    ).toThrow();
    expect(() =>
      validateDimensionSelection(f.master, f.companyId, '2026-10-31', {
        productId: f.productId,
      }),
    ).toThrow();
  });
  it('rejects ambiguous snapshots and invalid dates even when values are not selected', () => {
    const f = fixture();
    f.master.values.push({ ...f.master.values[0] });
    expect(() =>
      validateDimensionSelection(f.master, f.companyId, '2026-12-01', {}),
    ).toThrow();
    f.master.values.pop();
    f.master.values[0].effectiveTo = '2025-12-31';
    expect(() =>
      validateDimensionSelection(f.master, f.companyId, '2026-12-01', {}),
    ).toThrow();
  });
});
