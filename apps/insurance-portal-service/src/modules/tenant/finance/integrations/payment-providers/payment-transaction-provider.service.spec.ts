import { ConflictException } from '@nestjs/common';
import { PaymentTransactionStatus } from '@insurance-max/contracts';
import { PaymentTransaction } from '../../receivables/payment-transactions/entities/payment-transaction.entity';
import { PaymentTransactionProviderService } from './payment-transaction-provider.service';

describe('PaymentTransactionProviderService confirmation integrity', () => {
  const event = {
    providerCode: 'TEST',
    eventId: 'event-1',
    providerTransactionId: 'provider-1',
    status: PaymentTransactionStatus.SUCCESSFUL,
    amount: '100.00',
    currencyCode: 'TZS',
    paymentReference: null,
    payerName: null,
    payerPhone: null,
    payerEmail: null,
    receivedAt: null,
    settledAt: null,
  };
  function fixture() {
    const payment = {
      status: PaymentTransactionStatus.PENDING,
      provider_amount: '100.0000',
      provider_currency_code: 'TZS',
      amount: '100.00',
      currency: 'TZS',
    };
    const repository = {
      findOne: jest.fn().mockResolvedValue(payment),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn((entity) =>
        entity === PaymentTransaction ? repository : undefined,
      ),
    };
    return {
      payment,
      repository,
      manager,
      service: new PaymentTransactionProviderService({} as never),
    };
  }
  it.each([
    { amount: '90', currencyCode: 'TZS' },
    { amount: '100', currencyCode: 'USD' },
    { amount: '0', currencyCode: 'TZS' },
  ])(
    'rejects a mismatched confirmation without changing the payment',
    async (changes) => {
      const f = fixture();
      await expect(
        f.service.applyProviderEvent(
          f.manager as never,
          { ...event, ...changes } as never,
          'hash',
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(f.payment.status).toBe(PaymentTransactionStatus.PENDING);
      expect(f.repository.save).not.toHaveBeenCalled();
    },
  );
  it('accepts the matching exact amount and currency', async () => {
    const f = fixture();
    await f.service.applyProviderEvent(
      f.manager as never,
      event as never,
      'hash',
      {},
    );
    expect(f.payment.status).toBe(PaymentTransactionStatus.SUCCESSFUL);
    expect(f.repository.save).toHaveBeenCalledTimes(1);
  });
});
