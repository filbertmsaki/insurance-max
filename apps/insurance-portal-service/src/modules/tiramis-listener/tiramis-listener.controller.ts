import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class TiramisListenerController {
  private readonly logger = new Logger(TiramisListenerController.name);

  @EventPattern('tiramis.submission.status.updated')
  async handleTiramisSubmissionStatusUpdated(@Payload() payload: any) {
    this.logger.log(
      `Received TIRAMIS update for requestId ${payload.requestId}: ${payload.eventType}`,
    );

    return {
      received: true,
    };
  }
}
