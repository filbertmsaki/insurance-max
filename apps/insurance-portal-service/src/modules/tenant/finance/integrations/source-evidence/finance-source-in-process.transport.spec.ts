import { ForbiddenException } from '@nestjs/common';
import { inProcessSourceTransport } from './finance-source-in-process.transport';

describe('in-process Finance source transport', () => {
  const message = {
    body: Buffer.from('{}'),
    signature: 'sig',
    archiveExpired: true,
  };

  it('ingests through the registry and returns its signed receipt', async () => {
    const attestations = {
      ingest: jest.fn().mockResolvedValue({ id: 'r1', reused: false }),
      signedReceipt: jest
        .fn()
        .mockResolvedValue({ bodyBase64: 'b', signature: 's' }),
    };
    await expect(
      inProcessSourceTransport(attestations as any)(message),
    ).resolves.toEqual({ bodyBase64: 'b', signature: 's' });
    expect(attestations.ingest).toHaveBeenCalledWith(message.body, 'sig', true);
    expect(attestations.signedReceipt).toHaveBeenCalledWith('r1');
  });

  it('holds delivery when no receipt signer is configured', async () => {
    const attestations = {
      ingest: jest.fn().mockResolvedValue({ id: 'r1' }),
      signedReceipt: jest.fn().mockResolvedValue(null),
    };
    await expect(
      inProcessSourceTransport(attestations as any)(message),
    ).rejects.toThrow(ForbiddenException);
  });

  it('propagates registry rejections so the worker records HELD', async () => {
    const attestations = {
      ingest: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('bad signature')),
      signedReceipt: jest.fn(),
    };
    await expect(
      inProcessSourceTransport(attestations as any)(message),
    ).rejects.toThrow('bad signature');
    expect(attestations.signedReceipt).not.toHaveBeenCalled();
  });
});
