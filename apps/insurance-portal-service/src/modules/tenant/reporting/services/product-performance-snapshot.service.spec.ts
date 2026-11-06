import { ProductPerformanceSnapshotService } from './product-performance-snapshot.service';

describe('ProductPerformanceSnapshotService', () => {
  it('deletes any existing snapshot for the date, then inserts one row per product with a computed loss ratio', async () => {
    const query = jest.fn().mockResolvedValueOnce(undefined);
    // Advisory lock precedes the aggregate SELECT.
    query.mockResolvedValueOnce([
      {
        branch_id: 'branch-1',
        department_id: 'department-1',
        user_id: 'user-1',
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

    const dataSource = {
      transaction: jest.fn(async (work) => work({ query })),
    } as any;
    const service = new ProductPerformanceSnapshotService(dataSource);

    const count = await service.refreshSnapshots({
      companyId: 'company-1',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      snapshotDate: '2026-08-01',
    });

    expect(count).toBe(1);
    expect(query).toHaveBeenCalledTimes(4);

    // DELETE happens before the INSERT, scoped to the company + snapshot date.
    expect(query.mock.calls[2][0]).toContain(
      'DELETE FROM product_performance_snapshots',
    );
    expect(query.mock.calls[2][1]).toEqual(['company-1', '2026-08-01']);

    // Loss ratio = claims_incurred / earned_premium = 30000 / 150000 = 0.2.
    const insertParams = query.mock.calls[3][1];
    expect(insertParams).toEqual([
      'company-1',
      'branch-1',
      'department-1',
      'user-1',
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
    const query = jest.fn().mockResolvedValueOnce(undefined);
    query.mockResolvedValueOnce([
      {
        branch_id: null,
        department_id: null,
        user_id: 'user-2',
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

    const dataSource = {
      transaction: jest.fn(async (work) => work({ query })),
    } as any;
    const service = new ProductPerformanceSnapshotService(dataSource);

    await service.refreshSnapshots({
      companyId: 'company-1',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      snapshotDate: '2026-08-01',
    });

    const insertParams = query.mock.calls[3][1];
    expect(insertParams[insertParams.length - 1]).toBeNull();
  });

  it('returns 0 and issues no insert when there is nothing to aggregate', async () => {
    const query = jest.fn().mockResolvedValueOnce(undefined);
    query.mockResolvedValueOnce([]);
    query.mockResolvedValueOnce(undefined);

    const dataSource = {
      transaction: jest.fn(async (work) => work({ query })),
    } as any;
    const service = new ProductPerformanceSnapshotService(dataSource);

    const count = await service.refreshSnapshots({
      companyId: 'company-1',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      snapshotDate: '2026-08-01',
    });

    expect(count).toBe(0);
    // Only the SELECT and the DELETE ran — no INSERT for an empty result set.
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('propagates an insertion failure so replacement is rolled back', async () => {
    const published = ['old snapshot'];
    let staged = [...published];
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.includes('WITH policy_agg'))
        return [
          {
            product_id: 'p',
            currency: 'TZS',
            earned_premium: '1',
            gross_written_premium: '1',
            ceded_premium: '0',
            commissions: '0',
            claims_paid: '0',
            outstanding_reserve: '0',
            premium_collected: '0',
            claims_incurred: '0',
            policies_count: '1',
            claims_count: '0',
          },
        ];
      if (sql.includes('DELETE FROM')) {
        staged = [];
        return;
      }
      if (sql.includes('INSERT INTO')) throw new Error('insert failed');
    });
    const dataSource = {
      transaction: jest.fn(async (work) => {
        staged = [...published];
        const value = await work({ query });
        published.splice(0, published.length, ...staged);
        return value;
      }),
    };
    const service = new ProductPerformanceSnapshotService(dataSource as any);
    await expect(
      service.refreshSnapshots({
        companyId: 'co',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        snapshotDate: '2026-02-01',
      }),
    ).rejects.toThrow('insert failed');
    expect(published).toEqual(['old snapshot']);
  });
  it('rejects invalid aggregate rows before deleting the existing snapshot', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { product_id: 'p', currency: '', earned_premium: '1' },
      ]);
    const service = new ProductPerformanceSnapshotService({
      transaction: async (work: any) => work({ query }),
    } as any);
    await expect(
      service.refreshSnapshots({
        companyId: 'co',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        snapshotDate: '2026-02-01',
      }),
    ).rejects.toThrow('missing product or currency');
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM')),
    ).toBe(false);
  });
});
