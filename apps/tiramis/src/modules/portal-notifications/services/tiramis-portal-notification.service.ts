import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { TiramisPortalNotificationEventDto } from '../dto/tiramis-portal-notification-event.dto';

@Injectable()
export class TiramisPortalNotificationService {
  private readonly logger = new Logger(TiramisPortalNotificationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
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

    const webhookToken =
      this.configService.get<string>('tiramisService.portalWebhookToken') || '';
    const timeoutMs =
      this.configService.get<number>('tiramisService.portalWebhookTimeoutMs') ||
      5000;

    try {
      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, event, {
          timeout: timeoutMs,
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(webhookToken
              ? { 'x-tiramis-webhook-token': webhookToken }
              : {}),
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
}
