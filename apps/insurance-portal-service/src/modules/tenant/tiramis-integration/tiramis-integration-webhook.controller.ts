import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@insurance-max/portal-shared';

import type { TiramisNotificationEventDto } from './dto/tiramis-notification-event.dto';
import { TiramisIntegrationService } from './tiramis-integration.service';

@ApiExcludeController()
@Public()
@Controller('webhooks/tiramis')
export class TiramisIntegrationWebhookController {
  constructor(
    private readonly tiramisIntegrationService: TiramisIntegrationService,
    private readonly configService: ConfigService,
  ) {}

  @Post('notifications')
  async receiveNotification(
    @Headers('x-tiramis-webhook-token') webhookToken: string | undefined,
    @Body() payload: TiramisNotificationEventDto,
  ) {
    const expectedToken =
      this.configService.get<string>('TIRAMIS_PORTAL_WEBHOOK_TOKEN') || '';

    if (!expectedToken || webhookToken !== expectedToken) {
      throw new UnauthorizedException('Invalid TIRAMIS webhook token');
    }

    if (!payload?.eventType || !payload?.requestId) {
      throw new BadRequestException(
        'eventType and requestId are required in the TIRAMIS webhook payload',
      );
    }

    await this.tiramisIntegrationService.handleTiramisNotification(payload);

    return {
      success: true,
      requestId: payload.requestId,
      eventType: payload.eventType,
    };
  }
}
