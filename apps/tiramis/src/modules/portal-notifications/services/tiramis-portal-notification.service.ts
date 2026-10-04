import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, Repository } from 'typeorm';

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
  ) {}

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
    }));
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
      nextAttemptAt: new Date(),
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

      await manager
        .getRepository(TiramisPortalNotificationOutboxEntity)
        .update(
          { id: In(rows.map((row) => row.id)) },
          { status: 'PENDING', lastAttemptAt: new Date() },
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

    const apiKey = await this.resolvePortalApiKey(outbox.clientConfigurationId);
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
    const configurationById = clientConfigurationId
      ? await this.configurationRepository
          .createQueryBuilder('configuration')
          .where('configuration.id = :clientConfigurationId', {
            clientConfigurationId,
          })
          .andWhere('configuration.isActive = 1')
          .andWhere('configuration.portalWebhookApiKeyEncrypted IS NOT NULL')
          .getOne()
      : null;

    if (configurationById) {
      return this.secretCryptoService.decryptIfEncrypted(
        configurationById.portalWebhookApiKeyEncrypted,
      );
    }

    const environment =
      this.configService.get<string>('tiramisService.targetEnvironment') ??
      'test';
    const configuration = await this.configurationRepository
      .createQueryBuilder('configuration')
      .where('configuration.environment = :environment', { environment })
      .andWhere('configuration.isActive = 1')
      .andWhere('configuration.portalWebhookApiKeyEncrypted IS NOT NULL')
      .orderBy('configuration.updatedAt', 'DESC')
      .getOne();

    return this.secretCryptoService.decryptIfEncrypted(
      configuration?.portalWebhookApiKeyEncrypted,
    );
  }
}
