import { createHash } from 'crypto';

import { TiramisSubmissionEventRepository } from './tiramis-submission-event.repository';

describe('TiramisSubmissionEventRepository', () => {
  it('stores payload hash and byte size when raw payload is present', async () => {
    const payload = '<TiraMsg><Test>ok</Test></TiraMsg>';
    const typeormRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const repository = new TiramisSubmissionEventRepository(
      typeormRepository as any,
    );

    const event = await repository.createEvent({
      transactionId: 'txn-1',
      attemptId: 'attempt-1',
      requestId: 'REQ-1',
      eventType: 'REQUEST_SENT',
      rawPayload: payload,
    });

    expect(event.payloadHash).toBe(
      createHash('sha256').update(payload, 'utf8').digest('hex'),
    );
    expect(event.payloadSizeBytes).toBe(Buffer.byteLength(payload, 'utf8'));
  });

  it('leaves payload audit fields empty when no raw payload is present', async () => {
    const typeormRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const repository = new TiramisSubmissionEventRepository(
      typeormRepository as any,
    );

    const event = await repository.createEvent({
      transactionId: 'txn-1',
      attemptId: 'attempt-1',
      requestId: 'REQ-1',
      eventType: 'REQUEST_SENT',
    });

    expect(event.payloadHash).toBeNull();
    expect(event.payloadSizeBytes).toBeNull();
  });
});
