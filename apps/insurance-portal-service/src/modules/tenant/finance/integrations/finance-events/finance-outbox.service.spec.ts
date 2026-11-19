import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { FinanceOutboxService } from './finance-outbox.service';

const event = {
  companyId: 'company-1',
  aggregateType: 'INVOICE',
  aggregateId: 'invoice-1',
  eventType: 'INVOICE_ISSUED',
  eventKey: 'invoice:invoice-1:issued',
  payload: { amount: '100.00', currency: 'TZS' },
};

describe('Finance outbox event identity', () => {
  it('reuses an identical event without updating its saved evidence', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'event-1' }]);
    const findOneByOrFail = jest.fn().mockResolvedValue({ id: 'event-1' });
    const manager = {
      query,
      getRepository: jest.fn().mockReturnValue({ findOneByOrFail }),
    } as unknown as EntityManager;

    await expect(
      new FinanceOutboxService().add(manager, event),
    ).resolves.toEqual({
      id: 'event-1',
    });
    expect(query.mock.calls[0][0]).toContain(
      'ON CONFLICT (company_id, event_key) DO NOTHING',
    );
    expect(findOneByOrFail).toHaveBeenCalledWith({ id: 'event-1' });
  });

  it('rejects a reused key with different financial evidence', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      getRepository: jest.fn(),
    } as unknown as EntityManager;

    await expect(
      new FinanceOutboxService().add(manager, event),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.getRepository).not.toHaveBeenCalled();
  });
});
