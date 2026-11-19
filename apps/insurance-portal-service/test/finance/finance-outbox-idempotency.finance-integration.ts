import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { FinanceOutboxEvent } from '../../src/modules/tenant/finance/integrations/finance-events/entities/finance-outbox-event.entity';
import { FinanceOutboxService } from '../../src/modules/tenant/finance/integrations/finance-events/finance-outbox.service';
import { withFinanceTestDatabase } from '../support/finance-test-database';

describe('Finance outbox event-key integrity on PostgreSQL', () => {
  it('serializes concurrent retries and rejects conflicting evidence', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      const outbox = new DataSource({
        ...dataSource.options,
        entities: [FinanceOutboxEvent],
        migrations: [],
        migrationsRun: false,
        synchronize: false,
      });
      try {
        await outbox.initialize();
        await outbox.synchronize();
        const service = new FinanceOutboxService();
        const companyId = randomUUID();
        const aggregateId = randomUUID();
        const params = {
          companyId,
          aggregateType: 'INVOICE',
          aggregateId,
          eventType: 'INVOICE_ISSUED',
          eventKey: `invoice:${aggregateId}:issued`,
          payload: { amount: '10.0000', currencyCode: 'USD' },
        };
        const [first, second] = await Promise.all([
          outbox.transaction((manager) => service.add(manager, params)),
          outbox.transaction((manager) => service.add(manager, params)),
        ]);
        expect(first.id).toBe(second.id);
        expect(await outbox.getRepository(FinanceOutboxEvent).count()).toBe(1);
        await expect(
          outbox.transaction((manager) =>
            service.add(manager, {
              ...params,
              payload: { amount: '11.0000', currencyCode: 'USD' },
            }),
          ),
        ).rejects.toMatchObject({
          response: { code: 'FINANCE_OUTBOX_EVENT_CONFLICT' },
        });
        expect(
          (
            await outbox
              .getRepository(FinanceOutboxEvent)
              .findOneByOrFail({ id: first.id })
          ).payload,
        ).toEqual(params.payload);
      } finally {
        if (outbox.isInitialized) await outbox.destroy();
      }
    });
  });
});
