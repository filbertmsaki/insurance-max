import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ServiceEndpoint } from '@insurance-max/portal-shared';
import { RequireApiClientScopes } from '../../platform/api-clients/decorators/require-api-client-scopes.decorator';
import { ApiKeyGuard } from '../../platform/api-clients/guards/api-key.guard';

import type { TiramisNotificationEventDto } from './dto/tiramis-notification-event.dto';
import { TiramisIntegrationService } from './tiramis-integration.service';

@ApiExcludeController()
@ServiceEndpoint()
@UseGuards(ApiKeyGuard)
@RequireApiClientScopes('tiramis:notify')
@Controller('webhooks/tiramis')
export class TiramisIntegrationWebhookController {
  constructor(
    private readonly tiramisIntegrationService: TiramisIntegrationService,
  ) {}

  @Post('notifications')
  async receiveNotification(@Body() payload: TiramisNotificationEventDto) {
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
