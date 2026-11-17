import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ClaimFxGovernanceService } from './claim-fx-governance.service';

describe('ClaimFxGovernanceService rate selection', () => {
  const service = new ClaimFxGovernanceService({} as DataSource);
  const manager = { query: jest.fn() } as unknown as EntityManager;
  const query = manager.query as jest.Mock;

  beforeEach(() => query.mockReset());

  it('uses parity only for the configured functional currency', async () => {
    query.mockResolvedValueOnce([
      { slug: 'other', settings: { functional_currency: 'USD' } },
    ]);
    await expect(
      service.resolve(manager, 'company', 'USD', '2025-01-01'),
    ).resolves.toMatchObject({
      rate: '1',
      rateId: null,
      source: 'PARITY',
      functionalCurrency: 'USD',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('requires explicit configuration for other companies', async () => {
    query.mockResolvedValueOnce([
      { slug: 'other', settings: { currency: 'TZS' } },
    ]);
    await expect(
      service.resolve(manager, 'company', 'USD', '2025-01-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses approved Alliance currency and refuses a missing foreign rate', async () => {
    query
      .mockResolvedValueOnce([
        { slug: 'alliance-insurance-corporation', settings: null },
      ])
      .mockResolvedValueOnce([]);
    await expect(
      service.resolve(manager, 'company', 'USD', '2025-01-01'),
    ).rejects.toThrow('No approved exchange rate');
    expect(query.mock.calls[1][1]).toEqual([
      'company',
      'USD',
      'TZS',
      '2025-01-01',
    ]);
  });

  it('selects a matching approved foreign rate', async () => {
    query
      .mockResolvedValueOnce([
        { slug: 'alliance-insurance-corporation', settings: null },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rate-id',
          rate: '2600.0000000000',
          source_reference: 'test fixture',
          effective_date: '2025-01-01',
        },
      ]);
    await expect(
      service.resolve(manager, 'company', 'USD', '2025-01-02'),
    ).resolves.toMatchObject({
      rate: '2600.0000000000',
      rateId: 'rate-id',
      source: 'MANUAL',
    });
  });
});
