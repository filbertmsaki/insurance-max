import { of } from 'rxjs';

import { TiramisPortalNotificationService } from './tiramis-portal-notification.service';

describe('TiramisPortalNotificationService', () => {
  function createService(params?: {
    postStatus?: number;
    configGet?: jest.Mock;
    outboxRepository?: Record<string, any>;
  }) {
    const post = jest
      .fn()
      .mockReturnValue(of({ status: params?.postStatus ?? 200 }));
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'configuration-for-transaction',
        portalWebhookApiKeyEncrypted: 'encrypted-transaction-key',
      }),
    };
    const outboxRepository = params?.outboxRepository ?? {
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(),
    };

    const service = new TiramisPortalNotificationService(
      { post } as any,
      {
        get:
          params?.configGet ??
          jest.fn((key: string, fallback?: unknown) =>
            key === 'tiramisService.targetEnvironment' ? 'live' : fallback,
          ),
      } as any,
      {
        getRequestId: jest.fn().mockReturnValue('request-context-id'),
        getCorrelationId: jest.fn().mockReturnValue('correlation-id'),
      } as any,
      {
        decryptIfEncrypted: jest
          .fn()
          .mockImplementation((value: string) => `plain:${value}`),
      } as any,
      {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      } as any,
      outboxRepository as any,
    );

    return { post, queryBuilder, outboxRepository, service };
  }

  it('uses the transaction client configuration when resolving the portal webhook API key', async () => {
    const { post, queryBuilder, outboxRepository, service } = createService();

    await service.publish(
      {
        eventType: 'TIRAMIS_FINAL_SUCCESS',
        requestId: 'REQ-1',
        sourceService: 'tiramis-service',
      } as any,
      {
        webhookUrl:
          'https://portal.example.test/api/v1/webhooks/tiramis/notifications',
        clientConfigurationId: 'configuration-for-transaction',
      },
    );

    expect(outboxRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'REQ-1:none:TIRAMIS_FINAL_SUCCESS',
        requestId: 'REQ-1',
        eventType: 'TIRAMIS_FINAL_SUCCESS',
        status: 'PENDING',
      }),
    );
    expect(outboxRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SENT',
        eventKey: 'REQ-1:none:TIRAMIS_FINAL_SUCCESS',
      }),
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'configuration.id = :clientConfigurationId',
      { clientConfigurationId: 'configuration-for-transaction' },
    );
    expect(post).toHaveBeenCalledWith(
      'https://portal.example.test/api/v1/webhooks/tiramis/notifications',
      expect.objectContaining({ requestId: 'REQ-1' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'plain:encrypted-transaction-key',
        }),
      }),
    );
  });

  it('marks a successful portal delivery as sent so it is not retried', async () => {
    const { outboxRepository, service } = createService();

    await service.publish(
      {
        eventType: 'TIRAMIS_FINAL_SUCCESS',
        requestId: 'REQ-2',
        responseId: 'RES-2',
      } as any,
      {
        webhookUrl:
          'https://portal.example.test/api/v1/webhooks/tiramis/notifications',
        clientConfigurationId: 'configuration-for-transaction',
      },
    );

    expect(outboxRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'SENT',
        nextAttemptAt: null,
        lastError: null,
      }),
    );
  });

  it('keeps a failed portal delivery retryable with a future attempt time', async () => {
    const { outboxRepository, service } = createService({ postStatus: 500 });

    await service.publish(
      {
        eventType: 'TIRAMIS_FINAL_SUCCESS',
        requestId: 'REQ-3',
        responseId: 'RES-3',
      } as any,
      {
        webhookUrl:
          'https://portal.example.test/api/v1/webhooks/tiramis/notifications',
        clientConfigurationId: 'configuration-for-transaction',
      },
    );

    expect(outboxRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        attemptCount: 1,
        nextAttemptAt: expect.any(Date),
        lastError: 'Insurance portal returned HTTP 500',
      }),
    );
  });
});
