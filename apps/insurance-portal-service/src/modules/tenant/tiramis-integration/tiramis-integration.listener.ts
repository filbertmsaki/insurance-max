import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import type { TiramisNotificationEventDto } from './dto/tiramis-notification-event.dto';
import { TiramisIntegrationService } from './tiramis-integration.service';

@Controller()
export class TiramisIntegrationListener {
  private readonly logger = new Logger(TiramisIntegrationListener.name);

  constructor(
    private readonly tiramisIntegrationService: TiramisIntegrationService,
  ) {}

  @EventPattern('tiramis.submission.status.updated')
  async handleTiramisSubmissionStatusUpdated(
    @Payload() payload: TiramisNotificationEventDto,
  ) {
    this.logger.log(
      `Received TIRAMIS update for requestId ${payload.requestId}: ${payload.eventType}`,
    );

    const submission =
      await this.tiramisIntegrationService.handleTiramisNotification(payload);

    return {
      received: true,
      submissionId: submission.id,
      status: submission.status,
    };
  }
}
