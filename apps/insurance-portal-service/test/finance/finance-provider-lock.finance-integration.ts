import { PaymentTransactionStatus } from '@insurance-max/contracts';
import { PaymentTransactionProviderService } from '../../src/modules/tenant/finance/integrations/payment-providers/payment-transaction-provider.service';
import { withFinanceTestDatabase } from '../support/finance-test-database';

describe('provider transaction locking on isolated PostgreSQL', () => {
  it('serializes distinct callbacks for the same provider transaction', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let firstSaved!: () => void;
      const entered = new Promise<void>((resolve) => {
        firstSaved = resolve;
      });
      const payment = {
        status: PaymentTransactionStatus.PENDING,
        provider_amount: '100',
        provider_currency_code: 'TZS',
        amount: '100',
        currency: 'TZS',
      };
      let reads = 0;
      const repository = {
        findOne: async () => {
          reads++;
          return { ...payment };
        },
        save: async (value: typeof payment) => {
          if (reads === 1) {
            firstSaved();
            await gate;
          }
          Object.assign(payment, value);
          return value;
        },
      };
      const service = new PaymentTransactionProviderService({} as never);
      const event = {
        providerCode: 'TEST',
        providerTransactionId: 'transaction-1',
        eventId: 'event-1',
        status: PaymentTransactionStatus.SUCCESSFUL,
        amount: '100',
        currencyCode: 'TZS',
      };
      const execute = (eventId: string) =>
        dataSource.transaction((manager) =>
          service.applyProviderEvent(
            {
              query: manager.query.bind(manager),
              getRepository: () => repository,
            } as never,
            { ...event, eventId } as never,
            'hash',
            {},
          ),
        );
      const first = execute('event-1');
      try {
        await entered;
        const second = execute('event-2');
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(reads).toBe(1);
        release();
        await Promise.all([first, second]);
        expect(reads).toBe(2);
      } finally {
        release();
      }
    });
  }, 120000);
});
