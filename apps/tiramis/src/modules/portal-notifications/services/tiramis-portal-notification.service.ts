import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import {
  HTTP_HEADERS,
  RequestContextService,
} from '@insurance-max/shared-kernel';

import { TiramisPortalNotificationEventDto } from '../dto/tiramis-portal-notification-event.dto';
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
  ) {}

  async publish(event: TiramisPortalNotificationEventDto): Promise<void> {
    if (
      !this.configService.get<boolean>(
        'tiramisService.portalNotifyEnabled',
        true,
      )
    ) {
      return;
    }

    const webhookUrl =
      this.configService.get<string>('tiramisService.portalWebhookUrl') || '';

    if (!webhookUrl) {
      this.logger.warn(
        `Portal notification skipped for requestId ${event.requestId}: INSURANCE_PORTAL_WEBHOOK_URL is not configured`,
      );
      return;
    }

    const timeoutMs =
      this.configService.get<number>('tiramisService.portalWebhookTimeoutMs') ||
      5000;

    const requestId =
      this.requestContextService.getRequestId() || event.requestId;

    const correlationId =
      this.requestContextService.getCorrelationId() || requestId;

    const sourceService = this.configService.getOrThrow<string>(
      'tiramisService.sourceService',
    );

    const apiKey = await this.resolvePortalApiKey();
    if (!apiKey) {
      this.logger.warn(
        `Portal notification skipped for requestId ${event.requestId}: portal webhook API key is not configured`,
      );
      return;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, event, {
          timeout: timeoutMs,
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',

            'X-API-Key': apiKey,

            [HTTP_HEADERS.REQUEST_ID]: requestId,
            [HTTP_HEADERS.CORRELATION_ID]: correlationId,
            [HTTP_HEADERS.SOURCE_SERVICE]: sourceService,
          },
        }),
      );

      if (response.status < 200 || response.status >= 300) {
        this.logger.warn(
          `Failed to notify insurance portal for requestId ${event.requestId}: HTTP ${response.status}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Portal notification publish failed for requestId ${event.requestId}: ${
          error?.message || 'Unknown error'
        }`,
      );
    }
  }

  private async resolvePortalApiKey(): Promise<string | null> {
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
