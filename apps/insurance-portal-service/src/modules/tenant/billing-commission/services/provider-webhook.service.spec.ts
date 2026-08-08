import { UnauthorizedException } from '@nestjs/common';
import { PaymentTransactionStatus } from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { FinanceProviderEvent } from '../entities/finance-provider-event.entity';
import { ProviderWebhookService } from './provider-webhook.service';

describe('ProviderWebhookService', () => {
  const rawBody = Buffer.from(JSON.stringify({ secret: 'token', amount: 100 }));
  const parsedEvent = {
    providerCode: 'PAYCO',
    eventId: 'event-1',
    eventType: 'payment.success',
    providerTransactionId: 'provider-tx-1',
    paymentReference: 'INV-1',
    status: PaymentTransactionStatus.SUCCESSFUL,
    amount: '100.0000',
    currencyCode: 'TZS',
    rawPayload: { secret: 'token', amount: 100 },
  };

  function makeService(
    options: {
      signatureValid?: boolean;
      existingEvent?: Partial<FinanceProviderEvent> | null;
      transaction?: Record<string, unknown> | null;
    } = {},
  ) {
    const eventRecord: Partial<FinanceProviderEvent> = {
      provider_code: parsedEvent.providerCode,
      provider_event_id: parsedEvent.eventId,
      status: 'RECEIVED',
    };
    const eventRepository = {
      findOne: jest.fn(async () => options.existingEvent ?? null),
      create: jest.fn((entity) => ({ ...eventRecord, ...entity })),
      save: jest.fn(async (entity) => entity),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === FinanceProviderEvent) return eventRepository;
        throw new Error('Unexpected repository');
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const adapter = {
      verifySignature: jest.fn(async () => options.signatureValid ?? true),
      parseEvent: jest.fn(async () => parsedEvent),
    };
    const registry = {
      require: jest.fn(() => adapter),
    };
    const hashService = {
      hashDefinition: jest.fn(() => 'payload-hash'),
    };
    const redactionService = {
      redactPaymentPayload: jest.fn(() => ({ amount: 100 })),
    };
    const transaction =
      options.transaction === undefined
        ? { id: 'payment-1', company_id: 'company-1' }
        : options.transaction;
    const paymentTransactionProviderService = {
      applyProviderEvent: jest.fn(async () => transaction),
    };
    const autoReceiptService = {
      postWhenEligible: jest.fn(async () => null),
    };

    const service = new ProviderWebhookService(
      dataSource as never,
      registry as never,
      hashService as unknown as ProductDefinitionHashService,
      redactionService as never,
      paymentTransactionProviderService as never,
      autoReceiptService as never,
    );

    return {
      adapter,
      autoReceiptService,
      dataSource,
      eventRepository,
      paymentTransactionProviderService,
      service,
    };
  }

  it('rejects invalid provider signatures before opening a transaction', async () => {
    const { dataSource, service } = makeService({ signatureValid: false });

    await expect(service.process('PAYCO', {}, rawBody)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('returns processed duplicate provider events without reapplying payment state', async () => {
    const { autoReceiptService, paymentTransactionProviderService, service } =
      makeService({
        existingEvent: {
          status: 'PROCESSED',
          payment_transaction_id: 'payment-1',
        },
      });

    await expect(service.process('PAYCO', {}, rawBody)).resolves.toEqual({
      accepted: true,
      duplicate: true,
      paymentTransactionId: 'payment-1',
    });
    expect(
      paymentTransactionProviderService.applyProviderEvent,
    ).not.toHaveBeenCalled();
    expect(autoReceiptService.postWhenEligible).not.toHaveBeenCalled();
  });

  it('persists unresolved provider events when no unique invoice can be matched', async () => {
    const { autoReceiptService, eventRepository, service } = makeService({
      transaction: null,
    });

    await expect(service.process('PAYCO', {}, rawBody)).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
      resolved: false,
      paymentTransactionId: null,
    });

    expect(eventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'UNRESOLVED',
        payment_transaction_id: null,
        processing_error:
          'No unique invoice reference could be resolved from the provider event.',
      }),
    );
    expect(autoReceiptService.postWhenEligible).not.toHaveBeenCalled();
  });

  it('posts an automatic receipt after a provider event resolves to a transaction', async () => {
    const { autoReceiptService, eventRepository, service } = makeService();

    await expect(service.process('PAYCO', {}, rawBody)).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
      resolved: true,
      paymentTransactionId: 'payment-1',
    });

    expect(eventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'company-1',
        payment_transaction_id: 'payment-1',
        status: 'PROCESSED',
        processing_error: null,
      }),
    );
    expect(autoReceiptService.postWhenEligible).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'payment-1' }),
    );
  });
});
