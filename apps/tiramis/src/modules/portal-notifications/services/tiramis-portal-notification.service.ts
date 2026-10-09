import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import {
  HTTP_HEADERS,
  RequestContextService,
} from '@insurance-max/shared-kernel';

import { TiramisPortalNotificationEventDto } from '../dto/tiramis-portal-notification-event.dto';
import {
  TiramisPortalNotificationOutboxEntity,
  TiramisPortalNotificationOutboxStatus,
} from '../entities/tiramis-portal-notification-outbox.entity';
import { TiramisClientConfigurationEntity } from '../../config/entities/tiramis-client-configuration.entity';
import { TiramisSecretCryptoService } from '../../security/services/tiramis-secret-crypto.service';
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
  ) {}

  async testWebhook(configurationId: string, webhookUrl: string) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      return {
        success: false,
        message: 'Webhook URL is not a valid absolute URL.',
      };
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, message: 'Webhook URL must use HTTP or HTTPS.' };
    }
    if (
      !parsedUrl.pathname
        .replace(/\/$/, '')
        .endsWith('/webhooks/tiramis/notifications')
    ) {
      return {
        success: false,
        message: 'Only the portal TIRAMIS notification endpoint can be tested.',
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
      const response = await firstValueFrom(
        this.httpService.post(
          webhookUrl,
          {
            eventType: 'TIRAMIS_CONNECTION_TEST',
            sourceService: 'tiramis-service',
            requestId,
            occurredAt: new Date().toISOString(),
          },
          {
            timeout: 10_000,
            validateStatus: () => true,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-API-Key': apiKey,
              [HTTP_HEADERS.REQUEST_ID]: requestId,
              [HTTP_HEADERS.CORRELATION_ID]: requestId,
            },
          },
        ),
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
    const configured = configuration?.portalNotificationEvents;
    // null means legacy/default behavior; an empty array explicitly disables all events.
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
      5000;

    try {
      const response = await firstValueFrom(
        this.httpService.post(outbox.webhookUrl, event, {
          timeout: timeoutMs,
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',

            'X-API-Key': apiKey,

            [HTTP_HEADERS.REQUEST_ID]: requestId,
            [HTTP_HEADERS.CORRELATION_ID]: correlationId,
          },
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
    const seconds = [5, 15, 30, 60, 300, 900, 1800, 3600];
    return seconds[Math.min(attemptCount - 1, seconds.length - 1)] * 1000;
  }

  private buildEventKey(event: TiramisPortalNotificationEventDto): string {
    return [event.requestId, event.responseId || 'none', event.eventType].join(
      ':',
    );
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
    const configuration = await this.configurationRepository.findOne({
      where: { id: clientConfigurationId, isActive: 1 },
    });
    if (!configuration) {
      throw new Error(
        `Portal webhook configuration ${clientConfigurationId} is unavailable; refusing environment fallback.`,
      );
    }
    if (!configuration.portalWebhookApiKeyEncrypted) return null;
    return this.decryptPortalApiKey(configuration);
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
