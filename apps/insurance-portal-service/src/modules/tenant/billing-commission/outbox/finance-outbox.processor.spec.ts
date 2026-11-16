import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { FinanceOutboxProcessor } from './finance-outbox.processor';
import { FinanceOutboxEvent } from '../entities/finance-outbox-event.entity';

describe('FinanceOutboxProcessor', () => {
  it.each([
    ['UNKNOWN_CONTRACT', true],
    ['QUOTATION_PAYMENT_EVENT', false],
  ])(
    'never acknowledges unsupported contracts and preserves supported retry classification (%s)',
    async (eventType, unsupported) => {
      const event = {
        id: 'classified-event',
        status: 'PROCESSING',
        event_type: eventType,
        payload: { eventId: 'fixture' },
        attempt_count: 0,
        last_error: null,
      };
      const repo = {
        findOneBy: jest.fn().mockResolvedValue(event),
        save: jest.fn().mockImplementation(async (row) => row),
      };
      const source = {
        transaction: jest
          .fn()
          .mockImplementation(async (cb) =>
            cb({ query: jest.fn().mockResolvedValue([[{ id: event.id }], 1]) }),
          ),
        getRepository: jest.fn().mockReturnValue(repo),
      };
      const config = {
        get: jest
          .fn()
          .mockImplementation((_key: string, fallback: unknown) => fallback),
      };
      const projection = {
        apply: jest
          .fn()
          .mockRejectedValue(new Error('UNSUPPORTED_FINANCE_OUTBOX_CONTRACT')),
      };
      const processor = new FinanceOutboxProcessor(
        source as unknown as DataSource,
        config as unknown as ConfigService,
        projection as never,
      );
      await processor.processPending();
      expect(event.status).toBe(unsupported ? 'DEAD_LETTER' : 'FAILED');
      expect(event.status).not.toBe('PUBLISHED');
      expect(projection.apply).toHaveBeenCalledTimes(unsupported ? 0 : 1);
    },
  );
  it('skips malformed claimed rows before publish', async () => {
    const manager = {
      query: jest.fn(),
    };

    const transaction = jest
      .fn()
      .mockImplementationOnce(async (cb: any) => cb(manager));

    const repository = {
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    const dataSource: Partial<DataSource> = {
      transaction,
      getRepository: jest.fn().mockReturnValue(repository),
    };

    const configService: Partial<ConfigService> = {
      get: jest.fn().mockImplementation((key: string, def: any) => {
        if (key === 'FINANCE_OUTBOX_ENABLED') return true;
        if (key === 'FINANCE_OUTBOX_BATCH_SIZE') return 100;
        return def;
      }),
    };

    const quotationPaymentEventService = {
      apply: jest.fn(),
    };

    const processor = new FinanceOutboxProcessor(
      dataSource as DataSource,
      configService as ConfigService,
      quotationPaymentEventService as any,
    );

    // TypeORM returns [rows, rowCount] for UPDATE ... RETURNING.
    manager.query.mockResolvedValueOnce([[{ id: null }, {}], 2]);

    await processor.processPending();

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(repository.findOneBy).not.toHaveBeenCalled();
    expect(quotationPaymentEventService.apply).not.toHaveBeenCalled();
  });

  it('returns quietly when a claimed event no longer exists', async () => {
    const manager = {
      query: jest.fn(),
    };

    const transaction = jest
      .fn()
      .mockImplementationOnce(async (cb: any) => cb(manager));

    const repository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };

    const dataSource: Partial<DataSource> = {
      transaction,
      getRepository: jest.fn().mockReturnValue(repository),
    };

    const configService: Partial<ConfigService> = {
      get: jest.fn().mockImplementation((key: string, def: any) => {
        if (key === 'FINANCE_OUTBOX_ENABLED') return true;
        if (key === 'FINANCE_OUTBOX_BATCH_SIZE') return 100;
        return def;
      }),
    };

    const quotationPaymentEventService = {
      apply: jest.fn(),
    };

    const processor = new FinanceOutboxProcessor(
      dataSource as DataSource,
      configService as ConfigService,
      quotationPaymentEventService as any,
    );

    manager.query.mockResolvedValueOnce([[{ id: 'event-1' }], 1]);

    await processor.processPending();

    expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'event-1' });
    expect(repository.save).not.toHaveBeenCalled();
    expect(quotationPaymentEventService.apply).not.toHaveBeenCalled();
  });

  it('publishes known outbox events', async () => {
    const event: Partial<FinanceOutboxEvent> = {
      id: 'event-2',
      status: 'PROCESSING',
      event_type: 'QUOTATION_PAYMENT_EVENT',
      payload: { eventId: 'quotation-finance-1' },
      attempt_count: 0,
      last_error: null,
    };

    const manager = {
      query: jest.fn(),
    };

    const transaction = jest
      .fn()
      .mockImplementationOnce(async (cb: any) => cb(manager));

    const repository = {
      findOneBy: jest.fn().mockResolvedValue(event),
      save: jest.fn().mockImplementation(async (value) => value),
    };

    const dataSource: Partial<DataSource> = {
      transaction,
      getRepository: jest.fn().mockReturnValue(repository),
    };

    const configService: Partial<ConfigService> = {
      get: jest.fn().mockImplementation((key: string, def: any) => {
        if (key === 'FINANCE_OUTBOX_ENABLED') return true;
        if (key === 'FINANCE_OUTBOX_BATCH_SIZE') return 100;
        if (key === 'FINANCE_OUTBOX_MAX_ATTEMPTS') return 10;
        return def;
      }),
    };

    const quotationPaymentEventService = {
      apply: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new FinanceOutboxProcessor(
      dataSource as DataSource,
      configService as ConfigService,
      quotationPaymentEventService as any,
    );

    manager.query.mockResolvedValueOnce([[{ id: 'event-2' }], 1]);

    await processor.processPending();

    expect(quotationPaymentEventService.apply).toHaveBeenCalledWith(
      event.payload,
    );
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-2',
        status: 'PUBLISHED',
      }),
    );
  });
});
