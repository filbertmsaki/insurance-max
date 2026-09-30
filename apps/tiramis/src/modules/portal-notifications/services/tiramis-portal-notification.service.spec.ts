import { of } from 'rxjs';

import { TiramisPortalNotificationService } from './tiramis-portal-notification.service';

describe('TiramisPortalNotificationService', () => {
  it('uses the transaction client configuration when resolving the portal webhook API key', async () => {
    const post = jest.fn().mockReturnValue(of({ status: 200 }));
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'configuration-for-transaction',
          portalWebhookApiKeyEncrypted: 'encrypted-transaction-key',
        })
        .mockResolvedValueOnce({
          id: 'latest-live-configuration',
          portalWebhookApiKeyEncrypted: 'encrypted-latest-key',
        }),
    };

    const service = new TiramisPortalNotificationService(
      { post } as any,
      { get: jest.fn().mockReturnValue('live') } as any,
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
    );

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
});
