import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';

import { TiramisWebhookSignatureService } from './tiramis-webhook-signature.service';

describe('TiramisWebhookSignatureService', () => {
  const secret = 'portal-webhook-secret';
  const payload = {
    eventType: 'TIRAMIS_FINAL_SUCCESS',
    requestId: 'REQ-1',
    responseId: 'RES-1',
  };

  function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }

  function createFixture(options?: {
    nonceExists?: boolean;
    timestamp?: string;
    payloadHash?: string;
    signature?: string;
  }) {
    const redisService = {
      exists: jest.fn().mockResolvedValue(options?.nonceExists ?? false),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'TIRAMIS_PORTAL_WEBHOOK_SIGNING_SECRET') return secret;
        return fallback;
      }),
    };
    const service = new TiramisWebhookSignatureService(
      configService as any,
      redisService as any,
    );
    const timestamp = options?.timestamp ?? new Date().toISOString();
    const nonce = '0123456789abcdef';
    const payloadHash =
      options?.payloadHash ??
      createHash('sha256')
        .update(stableStringify(payload), 'utf8')
        .digest('hex');
    const signature =
      options?.signature ??
      createHmac('sha256', secret)
        .update(`${timestamp}.${nonce}.${payloadHash}`, 'utf8')
        .digest('hex');
    const request = {
      headers: {
        'x-tiramis-timestamp': timestamp,
        'x-tiramis-nonce': nonce,
        'x-tiramis-payload-sha256': payloadHash,
        'x-tiramis-signature': `v1=${signature}`,
        'x-api-key': 'api-key-fallback',
      },
    };

    return { service, redisService, request };
  }

  it('accepts a fresh signed webhook and reserves the nonce', async () => {
    const { service, redisService, request } = createFixture();

    await expect(service.verify(request as any, payload)).resolves.toBe(
      undefined,
    );
    expect(redisService.set).toHaveBeenCalledWith(
      'tiramis:webhook:nonce:0123456789abcdef',
      '1',
      300,
    );
  });

  it('rejects stale timestamps', async () => {
    const { service, request } = createFixture({
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });

    await expect(
      service.verify(request as any, payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects replayed nonces', async () => {
    const { service, request } = createFixture({ nonceExists: true });

    await expect(
      service.verify(request as any, payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects payload hash mismatches before processing', async () => {
    const { service, request } = createFixture({
      payloadHash: 'a'.repeat(64),
    });

    await expect(
      service.verify(request as any, payload),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid signatures without reserving the nonce', async () => {
    const { service, redisService, request } = createFixture({
      signature: 'b'.repeat(64),
    });

    await expect(
      service.verify(request as any, payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redisService.set).not.toHaveBeenCalled();
  });
});
