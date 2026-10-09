import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

import { RedisService } from '../../../shared/redis/redis.service';

@Injectable()
export class TiramisWebhookSignatureService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async verify(request: Request, payload: unknown): Promise<void> {
    const enabled = this.configService.get<boolean>(
      'TIRAMIS_PORTAL_WEBHOOK_SIGNATURE_REQUIRED',
      true,
    );
    if (!enabled) return;

    const timestamp = this.requiredHeader(request, 'x-tiramis-timestamp');
    const nonce = this.requiredHeader(request, 'x-tiramis-nonce');
    const payloadHash = this.requiredHeader(
      request,
      'x-tiramis-payload-sha256',
    );
    const signatureHeader = this.requiredHeader(request, 'x-tiramis-signature');

    this.assertFreshTimestamp(timestamp);
    this.assertPayloadHash(payload, payloadHash);
    await this.assertNonceUnused(nonce);

    const secret = this.resolveSigningSecret(request);
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${nonce}.${payloadHash}`, 'utf8')
      .digest('hex');
    const actual = signatureHeader.replace(/^v1=/i, '');

    if (!this.constantTimeEquals(actual, expected)) {
      throw new UnauthorizedException('Invalid TIRAMIS webhook signature');
    }

    await this.reserveNonce(nonce);
  }

  private requiredHeader(request: Request, name: string): string {
    const value = request.headers[name];
    const header = Array.isArray(value) ? value[0] : value;
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException(
        `Missing TIRAMIS webhook signature header: ${name}`,
      );
    }
    return header.trim();
  }

  private assertFreshTimestamp(timestamp: string): void {
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed)) {
      throw new UnauthorizedException('Invalid TIRAMIS webhook timestamp');
    }

    const maxAgeSeconds = this.configService.get<number>(
      'TIRAMIS_PORTAL_WEBHOOK_SIGNATURE_MAX_AGE_SECONDS',
      300,
    );
    if (Math.abs(Date.now() - parsed) > maxAgeSeconds * 1000) {
      throw new UnauthorizedException('Stale TIRAMIS webhook signature');
    }
  }

  private assertPayloadHash(payload: unknown, expectedHash: string): void {
    if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
      throw new UnauthorizedException('Invalid TIRAMIS webhook payload hash');
    }

    const actualHash = createHash('sha256')
      .update(this.stableStringify(payload || {}), 'utf8')
      .digest('hex');

    if (!this.constantTimeEquals(actualHash, expectedHash.toLowerCase())) {
      throw new BadRequestException('TIRAMIS webhook payload hash mismatch');
    }
  }

  private async assertNonceUnused(nonce: string): Promise<void> {
    if (!/^[a-f0-9-]{16,80}$/i.test(nonce)) {
      throw new UnauthorizedException('Invalid TIRAMIS webhook nonce');
    }

    const key = `tiramis:webhook:nonce:${nonce}`;
    if (await this.redisService.exists(key)) {
      throw new UnauthorizedException('Replayed TIRAMIS webhook nonce');
    }
  }

  private async reserveNonce(nonce: string): Promise<void> {
    await this.redisService.set(
      `tiramis:webhook:nonce:${nonce}`,
      '1',
      this.configService.get<number>(
        'TIRAMIS_PORTAL_WEBHOOK_SIGNATURE_MAX_AGE_SECONDS',
        300,
      ),
    );
  }

  private resolveSigningSecret(request: Request): string {
    const configured = this.configService.get<string>(
      'TIRAMIS_PORTAL_WEBHOOK_SIGNING_SECRET',
      '',
    );
    if (configured.trim()) return configured.trim();

    const apiKey = request.headers['x-api-key'];
    const value = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    if (!value || typeof value !== 'string') {
      throw new UnauthorizedException(
        'TIRAMIS webhook signing secret is unavailable',
      );
    }
    return value.trim();
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
      )
      .join(',')}}`;
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
