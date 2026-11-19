import type { DataSource } from 'typeorm';
import { FinanceDashboardService } from './finance-dashboard.service';

describe('Finance dashboard aggregate', () => {
  it('keeps full company totals separated by currency', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          kind: 'invoice',
          currency: 'TZS',
          record_count: '130',
          amount: '250000.25',
        },
        {
          kind: 'invoice',
          currency: 'USD',
          record_count: '2',
          amount: '150.10',
        },
        {
          kind: 'receipt',
          currency: 'TZS',
          record_count: '111',
          amount: '100000.00',
        },
        { kind: 'refund', currency: 'USD', record_count: '1', amount: '10.00' },
      ])
      .mockResolvedValueOnce([{ record_count: '145' }]);
    const service = new FinanceDashboardService({
      query,
    } as unknown as DataSource);

    await expect(service.summary('company-1')).resolves.toEqual({
      openInvoices: [
        { currency: 'TZS', count: 130, amount: '250000.25' },
        { currency: 'USD', count: 2, amount: '150.10' },
      ],
      receipts: [{ currency: 'TZS', count: 111, amount: '100000.00' }],
      paidRefunds: [{ currency: 'USD', count: 1, amount: '10.00' }],
      journalCount: 145,
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual(['company-1']);
    expect(query.mock.calls[0][0]).toContain("'FULLY_ALLOCATED'");
    expect(query.mock.calls[0][0]).not.toContain("'DRAFT'");
    expect(query.mock.calls[1][1]).toEqual(['company-1']);
  });
});
