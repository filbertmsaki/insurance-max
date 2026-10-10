import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, Repository } from 'typeorm';
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import {
  HTTP_HEADERS,
  RequestContextService,
} from '@insurance-max/shared-kernel';

import { TIRAMIS_DEFAULTS } from '../../../config/tiramis-defaults';
import { TiramisPortalNotificationEventDto } from '../dto/tiramis-portal-notification-event.dto';
import {
  TiramisPortalNotificationOutboxEntity,
  TiramisPortalNotificationOutboxStatus,
} from '../entities/tiramis-portal-notification-outbox.entity';
import { TiramisClientConfigurationEntity } from '../../config/entities/tiramis-client-configuration.entity';
import { TiramisSecretCryptoService } from '../../security/services/tiramis-secret-crypto.service';
import { TiramisSystemProfileService } from '../../config/services/tiramis-system-profile.service';
import { TiramisCallbackReceiptEntity } from '../../callbacks/entities/tiramis-callback-receipt.entity';
import { TiramisCallbackDeadLetterEntity } from '../../callbacks/entities/tiramis-callback-dead-letter.entity';

export const TIRAMIS_NOTIFICATION_EVENT_TYPES = [
  'TIRAMIS_CONNECTION_TEST',
  'TIRAMIS_ACK_RECEIVED',
  'TIRAMIS_ACK_FAILED',
  'TIRAMIS_FINAL_RESPONSE_RECEIVED',
  'TIRAMIS_FINAL_SUCCESS',
  'TIRAMIS_FINAL_FAILED',
  'TIRAMIS_FINAL_CALLBACK_OVERDUE',
  'TIRAMIS_RESPONSE_ACK_SENT',
  'TIRAMIS_CALLBACK_REJECTED',
  'TIRAMIS_SUBMISSION_FAILED',
] as const;

/**
 * How long a row being delivered is hidden from the outbox worker. Inline
 * delivery and worker claims both take this lease so the same event is never
 * posted to the portal twice concurrently; success or failure then sets the
 * real next attempt time.
 */
const DELIVERY_LEASE_MS = 60_000;
const PORTAL_WEBHOOK_PATH = '/webhooks/tiramis/notifications';

@Injectable()
export class TiramisPortalNotificationService {
  private readonly logger = new Logger(TiramisPortalNotificationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
    private readonly secretCryptoService: TiramisSecretCryptoService,
    @InjectRepository(TiramisClientConfigurationEntity)
    private readonly configurationRepository: Repository<TiramisClientConfigurationEntity>,
    @InjectRepository(TiramisPortalNotificationOutboxEntity)
    private readonly outboxRepository: Repository<TiramisPortalNotificationOutboxEntity>,
    @InjectRepository(TiramisCallbackReceiptEntity)
    private readonly callbackReceiptRepository: Repository<TiramisCallbackReceiptEntity>,
    @InjectRepository(TiramisCallbackDeadLetterEntity)
    private readonly callbackDeadLetterRepository: Repository<TiramisCallbackDeadLetterEntity>,
    private readonly systemProfiles: TiramisSystemProfileService,
  ) {}

  async testWebhook(configurationId: string, webhookUrl: string) {
    try {
      await this.assertWebhookUrlAllowed(webhookUrl);
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Webhook URL is not allowed.',
      };
    }

    const configuration = await this.configurationRepository.findOne({
      where: { id: configurationId, isActive: 1 },
    });
    if (!configuration) {
      return {
        success: false,
        message: 'Active TIRAMIS configuration was not found.',
      };
    }
    let apiKey: string | null;
    try {
      apiKey = await this.resolvePortalApiKey(configurationId);
    } catch (error: any) {
      return { success: false, message: error?.message };
    }
    if (!apiKey) {
      return {
        success: false,
        message: 'Portal webhook API key is not configured.',
      };
    }

    const requestId = `portal-webhook-test-${randomUUID()}`;
    try {
      const headers = this.buildWebhookHeaders({
        apiKey,
        event: {
          eventType: 'TIRAMIS_CONNECTION_TEST',
          sourceService: 'tiramis-service',
          requestId,
          occurredAt: new Date().toISOString(),
        } as unknown as TiramisPortalNotificationEventDto,
        requestId,
        correlationId: requestId,
      });
      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, headers.payload, {
          timeout: 10_000,
          validateStatus: () => true,
          headers: headers.headers,
        }),
      );
      const success = response.status >= 200 && response.status < 300;
      return {
        success,
        httpStatus: response.status,
        requestId,
        message: success
          ? 'Portal webhook accepted the authenticated connection test.'
          : `Portal webhook returned HTTP ${response.status}.`,
      };
    } catch (error: any) {
      return {
        success: false,
        requestId,
        message: error?.message || 'Unable to connect to the portal webhook.',
      };
    }
  }

  async publish(
    event: TiramisPortalNotificationEventDto,
    options?: {
      webhookUrl?: string | null;
      clientConfigurationId?: string | null;
    },
  ): Promise<void> {
    if (
      !this.configService.get<boolean>(
        'tiramisService.portalNotifyEnabled',
        true,
      )
    ) {
      return;
    }

    const webhookUrl = options?.webhookUrl?.trim() || '';

    const eventAllowed = await this.isEventEnabled(
      options?.clientConfigurationId,
      event.eventType,
    );
    if (!eventAllowed) return;

    if (!webhookUrl) {
      this.logger.warn(
        `Portal notification skipped for requestId ${event.requestId}: portalWebhookUrl was not provided in the source metadata`,
      );
      return;
    }

    const outbox = await this.enqueue(event, {
      webhookUrl,
      clientConfigurationId: options?.clientConfigurationId || null,
    });

    if (outbox.status === 'SENT') {
      return;
    }

    await this.deliver(outbox);
  }

  private async isEventEnabled(
    clientConfigurationId: string | null | undefined,
    eventType: string,
  ): Promise<boolean> {
    if (!clientConfigurationId) return true;
    const configuration = await this.configurationRepository.findOne({
      where: { id: clientConfigurationId },
    });
    // Platform policy for the transaction's environment wins; a company's
    // legacy per-row policy applies only while no platform policy is set.
    const platformEvents = configuration
      ? this.platformProfile(configuration.environment)
          ?.portalNotificationEvents
      : null;
    const configured =
      platformEvents ?? configuration?.portalNotificationEvents ?? null;
    // null means the default set; an empty array disables all events.
    return configured == null || configured.includes(eventType);
  }

  async processDueOutbox(limit = 20): Promise<number> {
    const rows = await this.claimDueOutbox(limit);

    let sent = 0;

    for (const row of rows) {
      if (await this.deliver(row)) {
        sent += 1;
      }
    }

    return sent;
  }

  async listOutbox(params: {
    status?: TiramisPortalNotificationOutboxStatus;
    requestId?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(Number(params.limit || 50), 1), 200);
    const qb = this.outboxRepository
      .createQueryBuilder('outbox')
      .orderBy('outbox.createdAt', 'DESC')
      .limit(limit);

    if (params.status) {
      qb.andWhere('outbox.status = :status', { status: params.status });
    }

    if (params.requestId) {
      qb.andWhere('outbox.requestId = :requestId', {
        requestId: params.requestId,
      });
    }

    const rows = await qb.getMany();

    return rows.map((row) => ({
      id: row.id,
      eventKey: row.eventKey,
      requestId: row.requestId,
      responseId: row.responseId,
      eventType: row.eventType,
      status: row.status,
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
      lastAttemptAt: row.lastAttemptAt,
      sentAt: row.sentAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      clientConfigurationId: row.clientConfigurationId,
    }));
  }

  async listCallbackDiagnostics(params: {
    requestId?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(Number(params.limit || 50), 1), 200);
    const receiptQb = this.callbackReceiptRepository
      .createQueryBuilder('receipt')
      .orderBy('receipt.createdAt', 'DESC')
      .limit(limit);
    const deadLetterQb = this.callbackDeadLetterRepository
      .createQueryBuilder('deadLetter')
      .orderBy('deadLetter.createdAt', 'DESC')
      .limit(limit);
    if (params.requestId) {
      receiptQb.where('receipt.requestId = :requestId', {
        requestId: params.requestId,
      });
      deadLetterQb.where('deadLetter.requestId = :requestId', {
        requestId: params.requestId,
      });
    }
    const [receipts, deadLetters] = await Promise.all([
      receiptQb.getMany(),
      deadLetterQb.getMany(),
    ]);
    return {
      receipts: receipts.map((row) => ({
        id: row.id,
        environment: row.environment,
        requestId: row.requestId,
        responseId: row.responseId,
        rootName: row.rootName,
        responseStatusCode: row.responseStatusCode,
        responseStatusDesc: row.responseStatusDesc,
        payloadHash: row.payloadHash,
        signatureVerified: Boolean(row.signatureVerified),
        signatureVerificationReason: row.signatureVerificationReason ?? null,
        processingStatus: row.processingStatus,
        receiveCount: row.receiveCount,
        acknowledgementStatusCode: row.acknowledgementStatusCode,
        acknowledgementStatusDesc: row.acknowledgementStatusDesc,
        lastError: row.lastError,
        lastReceivedAt: row.lastReceivedAt,
        createdAt: row.createdAt,
      })),
      deadLetters: deadLetters.map((row) => ({
        id: row.id,
        environment: row.environment,
        requestId: row.requestId,
        responseId: row.responseId,
        rootName: row.rootName,
        statusCode: row.statusCode,
        statusDesc: row.statusDesc,
        payloadHash: row.payloadHash,
        reason: row.reason,
        isProcessed: Boolean(row.isProcessed),
        createdAt: row.createdAt,
      })),
    };
  }

  async retryOutboxEntry(id: string) {
    const row = await this.outboxRepository.findOne({ where: { id } });

    if (!row) {
      throw new BadRequestException('Portal notification outbox row not found');
    }

    if (row.status === 'SENT') {
      return {
        success: true,
        alreadySent: true,
        id: row.id,
        eventKey: row.eventKey,
      };
    }

    row.status = 'PENDING';
    row.nextAttemptAt = new Date();
    row.lastError = null;
    await this.outboxRepository.save(row);

    const sent = await this.deliver(row);

    return {
      success: sent,
      id: row.id,
      eventKey: row.eventKey,
      status: row.status,
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
      lastError: row.lastError,
    };
  }

  private async enqueue(
    event: TiramisPortalNotificationEventDto,
    options: {
      webhookUrl: string;
      clientConfigurationId?: string | null;
    },
  ): Promise<TiramisPortalNotificationOutboxEntity> {
    const eventKey = this.buildEventKey(event);

    const outbox = this.outboxRepository.create({
      eventKey,
      requestId: event.requestId,
      responseId: event.responseId || null,
      eventType: event.eventType,
      webhookUrl: options.webhookUrl,
      clientConfigurationId: options.clientConfigurationId || null,
      payload: event as unknown as Record<string, any>,
      status: 'PENDING',
      nextAttemptAt: new Date(Date.now() + DELIVERY_LEASE_MS),
    });

    try {
      return await this.outboxRepository.save(outbox);
    } catch (error: any) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.outboxRepository.findOne({
        where: { eventKey },
      });

      if (existing) {
        return existing;
      }

      throw error;
    }
  }

  private async claimDueOutbox(
    limit: number,
  ): Promise<TiramisPortalNotificationOutboxEntity[]> {
    return this.outboxRepository.manager.transaction(async (manager) => {
      const rows = await manager
        .getRepository(TiramisPortalNotificationOutboxEntity)
        .createQueryBuilder('outbox')
        .where('outbox.status IN (:...statuses)', {
          statuses: ['PENDING', 'FAILED'],
        })
        .andWhere(
          '(outbox.nextAttemptAt IS NULL OR outbox.nextAttemptAt <= :now)',
          { now: new Date() },
        )
        .orderBy('outbox.createdAt', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (!rows.length) {
        return [];
      }

      await manager.getRepository(TiramisPortalNotificationOutboxEntity).update(
        { id: In(rows.map((row) => row.id)) },
        {
          status: 'PENDING',
          lastAttemptAt: new Date(),
          nextAttemptAt: new Date(Date.now() + DELIVERY_LEASE_MS),
        },
      );

      return rows;
    });
  }

  private async deliver(
    outbox: TiramisPortalNotificationOutboxEntity,
  ): Promise<boolean> {
    const event = outbox.payload as TiramisPortalNotificationEventDto;

    const requestId =
      this.requestContextService.getRequestId() || event.requestId;

    const correlationId =
      this.requestContextService.getCorrelationId() || requestId;

    let apiKey: string | null;
    try {
      apiKey = await this.resolvePortalApiKey(outbox.clientConfigurationId);
    } catch (error: any) {
      await this.markDeliveryFailed(
        outbox,
        error?.message || 'Unable to resolve portal webhook API key',
      );
      return false;
    }
    if (!apiKey) {
      await this.markDeliveryFailed(
        outbox,
        'Portal webhook API key is not configured',
      );
      return false;
    }

    const timeoutMs =
      this.configService.get<number>('tiramisService.portalWebhookTimeoutMs') ||
      TIRAMIS_DEFAULTS.portalWebhookTimeoutMs;

    try {
      await this.assertWebhookUrlAllowed(outbox.webhookUrl);
      const headers = this.buildWebhookHeaders({
        apiKey,
        event,
        requestId,
        correlationId,
      });
      const response = await firstValueFrom(
        this.httpService.post(outbox.webhookUrl, headers.payload, {
          timeout: timeoutMs,
          validateStatus: () => true,
          headers: headers.headers,
        }),
      );

      if (response.status < 200 || response.status >= 300) {
        await this.markDeliveryFailed(
          outbox,
          `Insurance portal returned HTTP ${response.status}`,
        );
        return false;
      }

      outbox.status = 'SENT';
      outbox.sentAt = new Date();
      outbox.lastAttemptAt = outbox.sentAt;
      outbox.lastError = null;
      outbox.nextAttemptAt = null;
      await this.outboxRepository.save(outbox);
      return true;
    } catch (error: any) {
      await this.markDeliveryFailed(
        outbox,
        error?.message || 'Unknown portal notification delivery error',
      );
      return false;
    }
  }

  private async markDeliveryFailed(
    outbox: TiramisPortalNotificationOutboxEntity,
    message: string,
  ) {
    const attemptCount = Number(outbox.attemptCount || 0) + 1;
    const maxAttempts = Number(
      this.configService.get<number>(
        'tiramisService.portalWebhookMaxAttempts',
      ) || 8,
    );

    outbox.attemptCount = attemptCount;
    outbox.lastAttemptAt = new Date();
    outbox.lastError = message;
    outbox.status = attemptCount >= maxAttempts ? 'DEAD' : 'FAILED';
    outbox.nextAttemptAt =
      outbox.status === 'DEAD'
        ? null
        : new Date(Date.now() + this.retryDelayMs(attemptCount));

    await this.outboxRepository.save(outbox);

    this.logger.warn(
      `Portal notification ${outbox.eventKey} delivery failed: ${message}`,
    );
  }

  private retryDelayMs(attemptCount: number): number {
    const seconds = this.configService.get<number[]>(
      'tiramisService.portalWebhookRetryDelaysSeconds',
      TIRAMIS_DEFAULTS.portalWebhookRetryDelaysSeconds,
    );
    return seconds[Math.min(attemptCount - 1, seconds.length - 1)] * 1000;
  }

  private buildEventKey(event: TiramisPortalNotificationEventDto): string {
    return [event.requestId, event.responseId || 'none', event.eventType].join(
      ':',
    );
  }

  private buildWebhookHeaders(params: {
    apiKey: string;
    event: TiramisPortalNotificationEventDto;
    requestId: string;
    correlationId: string;
  }): {
    payload: TiramisPortalNotificationEventDto;
    headers: Record<string, string>;
  } {
    const timestamp = new Date().toISOString();
    const nonce = randomBytes(16).toString('hex');
    const payloadHash = this.hashPayload(params.event);
    const signatureBase = `${timestamp}.${nonce}.${payloadHash}`;
    const signature = createHmac(
      'sha256',
      this.resolveWebhookSigningSecret(params.apiKey),
    )
      .update(signatureBase, 'utf8')
      .digest('hex');

    return {
      payload: params.event,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': params.apiKey,
        'X-TIRAMIS-Signature': `v1=${signature}`,
        'X-TIRAMIS-Signature-Alg': 'hmac-sha256',
        'X-TIRAMIS-Timestamp': timestamp,
        'X-TIRAMIS-Nonce': nonce,
        'X-TIRAMIS-Payload-SHA256': payloadHash,
        [HTTP_HEADERS.REQUEST_ID]: params.requestId,
        [HTTP_HEADERS.CORRELATION_ID]: params.correlationId,
      },
    };
  }

  private resolveWebhookSigningSecret(apiKey: string): string {
    return (
      this.configService.get<string>('TIRAMIS_PORTAL_WEBHOOK_SIGNING_SECRET') ||
      this.configService.get<string>(
        'tiramisService.portalWebhookSigningSecret',
      ) ||
      apiKey
    );
  }

  private hashPayload(payload: unknown): string {
    return createHash('sha256')
      .update(this.stableStringify(payload || {}), 'utf8')
      .digest('hex');
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

  private async assertWebhookUrlAllowed(webhookUrl: string): Promise<URL> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      throw new BadRequestException('Webhook URL is not a valid absolute URL.');
    }

    const appEnv = this.configService.get<string>('app.env', 'development');
    const requireHttps =
      this.configService.get<boolean>(
        'tiramisService.portalWebhookRequireHttps',
      ) ?? appEnv === 'production';
    if (requireHttps && parsedUrl.protocol !== 'https:') {
      throw new BadRequestException(
        'Portal webhook URL must use HTTPS in this environment.',
      );
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('Webhook URL must use HTTP or HTTPS.');
    }

    if (!parsedUrl.pathname.replace(/\/$/, '').endsWith(PORTAL_WEBHOOK_PATH)) {
      throw new BadRequestException(
        'Only the portal TIRAMIS notification endpoint can be used.',
      );
    }

    const allowedHosts = this.csvConfig(
      'tiramisService.portalWebhookAllowedHosts',
    );
    if (allowedHosts.length && !allowedHosts.includes(parsedUrl.hostname)) {
      throw new BadRequestException(
        'Portal webhook host is not in the allowed host list.',
      );
    }

    const blockPrivate =
      this.configService.get<boolean>(
        'tiramisService.portalWebhookBlockPrivateIps',
      ) ?? appEnv === 'production';
    if (blockPrivate) {
      await this.assertWebhookHostIsPublic(parsedUrl.hostname);
    }

    return parsedUrl;
  }

  private async assertWebhookHostIsPublic(hostname: string): Promise<void> {
    const addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: false });

    if (!addresses.length) {
      throw new BadRequestException('Portal webhook host did not resolve.');
    }

    for (const result of addresses) {
      if (this.isPrivateOrLocalAddress(result.address)) {
        throw new BadRequestException(
          'Portal webhook host resolves to a private or local address.',
        );
      }
    }
  }

  private isPrivateOrLocalAddress(address: string): boolean {
    const normalized = address.startsWith('::ffff:')
      ? address.slice(7)
      : address.toLowerCase();
    if (normalized === '::1' || normalized === 'localhost') return true;

    if (isIP(normalized) === 4) {
      const octets = normalized.split('.').map((value) => Number(value));
      const [a, b] = octets;
      return (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a === 0
      );
    }

    if (isIP(normalized) === 6) {
      return (
        normalized === '::' ||
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:')
      );
    }

    return true;
  }

  private csvConfig(key: string): string[] {
    const value = this.configService.get<string>(key, '');
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  private isUniqueViolation(error: any): boolean {
    return (
      error?.code === '23505' ||
      String(error?.message || '')
        .toLowerCase()
        .includes('unique')
    );
  }

  private async resolvePortalApiKey(
    clientConfigurationId?: string | null,
  ): Promise<string | null> {
    if (!clientConfigurationId) return null;
    // Deliberately not filtered on isActive: a deactivated company's
    // in-flight transactions must still deliver their results.
    const configuration = await this.configurationRepository.findOne({
      where: { id: clientConfigurationId },
    });
    if (!configuration) {
      throw new Error(
        `Portal webhook configuration ${clientConfigurationId} is unavailable; refusing environment fallback.`,
      );
    }
    // The platform webhook key of the transaction's environment; a company's
    // legacy per-row key is used only until the platform key is configured.
    const platformKey = this.platformProfile(
      configuration.environment,
    )?.portalWebhookApiKey;
    if (platformKey) return platformKey;
    if (!configuration.portalWebhookApiKeyEncrypted) return null;
    return this.decryptPortalApiKey(configuration);
  }

  private platformProfile(environment?: string | null) {
    const env = String(environment ?? '').toLowerCase();
    return env === 'test' || env === 'live'
      ? this.systemProfiles.getEffective(env)
      : null;
  }

  private decryptPortalApiKey(configuration: {
    id: string;
    portalWebhookApiKeyEncrypted?: string | null;
  }): string | null {
    try {
      return this.secretCryptoService.decryptIfEncrypted(
        configuration.portalWebhookApiKeyEncrypted,
      );
    } catch (error: any) {
      const message =
        `PORTAL_WEBHOOK_SECRET_UNREADABLE: API key for configuration ${configuration.id} cannot be decrypted. ` +
        'Check TIRAMIS_SECRET_ENCRYPTION_KEY and TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS, then use the admin secret repair action to reissue it.';
      this.logger.error(`${message} (${error?.message})`);
      throw new Error(message);
    }
  }
}
