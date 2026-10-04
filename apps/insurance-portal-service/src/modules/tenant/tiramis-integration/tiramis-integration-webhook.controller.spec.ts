import { ConflictException } from '@nestjs/common';

import { TiramisIntegrationWebhookController } from './tiramis-integration-webhook.controller';

describe('TiramisIntegrationWebhookController', () => {
  function createFixture(existingReceipt?: any) {
    const service = {
      handleTiramisNotification: jest.fn().mockResolvedValue(undefined),
    };

    const receiptRepository = {
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => {
        if (!existingReceipt || value === existingReceipt) {
          return value;
        }

        const error = new Error('duplicate key');
        (error as any).code = '23505';
        throw error;
      }),
      findOne: jest.fn().mockResolvedValue(existingReceipt ?? null),
    };

    const controller = new TiramisIntegrationWebhookController(
      service as any,
      receiptRepository as any,
    );

    return { controller, receiptRepository, service };
  }

  const payload = {
    eventType: 'TIRAMIS_FINAL_SUCCESS',
    requestId: 'REQ-1',
    responseId: 'RES-1',
  } as any;

  it('returns success without reprocessing a completed duplicate', async () => {
    const receipt = {
      eventKey: 'REQ-1:RES-1:TIRAMIS_FINAL_SUCCESS',
      payloadHash: null,
      processingStatus: 'COMPLETED',
      receiveCount: 1,
    };
    const fixture = createFixture(receipt);

    const result = await fixture.controller.receiveNotification(payload);

    expect(result).toEqual(
      expect.objectContaining({ success: true, duplicate: true }),
    );
    expect(fixture.service.handleTiramisNotification).not.toHaveBeenCalled();
  });

  it('returns a non-2xx conflict for an in-progress duplicate so TIRAMIS retries', async () => {
    const receipt = {
      eventKey: 'REQ-1:RES-1:TIRAMIS_FINAL_SUCCESS',
      payloadHash: null,
      processingStatus: 'PROCESSING',
      receiveCount: 1,
    };
    const fixture = createFixture(receipt);

    await expect(
      fixture.controller.receiveNotification(payload),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fixture.service.handleTiramisNotification).not.toHaveBeenCalled();
  });

  it('reprocesses a previously failed receipt', async () => {
    const receipt = {
      eventKey: 'REQ-1:RES-1:TIRAMIS_FINAL_SUCCESS',
      payloadHash: null,
      processingStatus: 'FAILED',
      receiveCount: 1,
      lastError: 'previous failure',
    };
    const fixture = createFixture(receipt);

    const result = await fixture.controller.receiveNotification(payload);

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(fixture.service.handleTiramisNotification).toHaveBeenCalledWith(
      payload,
    );
    expect(receipt.processingStatus).toBe('COMPLETED');
    expect(receipt.lastError).toBeNull();
  });
});
