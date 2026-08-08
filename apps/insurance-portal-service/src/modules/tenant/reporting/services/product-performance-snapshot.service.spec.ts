import { ProductPerformanceSnapshotService } from './product-performance-snapshot.service';

describe('ProductPerformanceSnapshotService', () => {
  it('deletes any existing snapshot for the date, then inserts one row per product with a computed loss ratio', async () => {
    const query = jest.fn();
    // First call: the CTE aggregate SELECT.
    query.mockResolvedValueOnce([
      {
        product_id: 'product-1',
        currency: 'TZS',
        policies_count: '3',
        gross_written_premium: '300000.00',
        earned_premium: '150000.00',
        ceded_premium: '30000.00',
        commissions: '15000.00',
        claims_count: '1',
        claims_paid: '20000.00',
        outstanding_reserve: '10000.00',
        claims_incurred: '30000.00',
        premium_collected: '250000.00',
      },
    ]);
    // Second call: the DELETE.
    query.mockResolvedValueOnce(undefined);
    // Third call: the INSERT.
    query.mockResolvedValueOnce(undefined);

    const dataSource = { query } as any;
    const service = new ProductPerformanceSnapshotService(dataSource);

    const count = await service.refreshSnapshots({
      companyId: 'company-1',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      snapshotDate: '2026-08-01',
    });

    expect(count).toBe(1);
    expect(query).toHaveBeenCalledTimes(3);

    // DELETE happens before the INSERT, scoped to the company + snapshot date.
    expect(query.mock.calls[1][0]).toContain(
      'DELETE FROM product_performance_snapshots',
    );
    expect(query.mock.calls[1][1]).toEqual(['company-1', '2026-08-01']);

    // Loss ratio = claims_incurred / earned_premium = 30000 / 150000 = 0.2.
    const insertParams = query.mock.calls[2][1];
    expect(insertParams).toEqual([
      'company-1',
      'product-1',
      'TZS',
      '2026-08-01',
      '2026-07-01',
      '2026-07-31',
      '300000.00',
      '150000.00',
      '250000.00',
      '30000.00',
      '20000.00',
      '10000.00',
      '30000.00',
      '15000.00',
      3,
      1,
      0.2,
    ]);
  });

  it('leaves loss ratio null when earned premium is zero, instead of dividing by zero', async () => {
    const query = jest.fn();
    query.mockResolvedValueOnce([
      {
        product_id: 'product-2',
        currency: 'TZS',
        policies_count: '0',
        gross_written_premium: '0',
        earned_premium: '0',
        ceded_premium: '0',
        commissions: '0',
        claims_count: '2',
        claims_paid: '5000.00',
        outstanding_reserve: '0',
        claims_incurred: '5000.00',
        premium_collected: '0',
      },
    ]);
    query.mockResolvedValueOnce(undefined);
    query.mockResolvedValueOnce(undefined);

    const dataSource = { query } as any;
    const service = new ProductPerformanceSnapshotService(dataSource);

    await service.refreshSnapshots({
      companyId: 'company-1',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      snapshotDate: '2026-08-01',
    });

    const insertParams = query.mock.calls[2][1];
    expect(insertParams[insertParams.length - 1]).toBeNull();
  });

  it('returns 0 and issues no insert when there is nothing to aggregate', async () => {
    const query = jest.fn();
    query.mockResolvedValueOnce([]);
    query.mockResolvedValueOnce(undefined);

    const dataSource = { query } as any;
    const service = new ProductPerformanceSnapshotService(dataSource);

    const count = await service.refreshSnapshots({
      companyId: 'company-1',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      snapshotDate: '2026-08-01',
    });

    expect(count).toBe(0);
    // Only the SELECT and the DELETE ran — no INSERT for an empty result set.
    expect(query).toHaveBeenCalledTimes(2);
  });
});
