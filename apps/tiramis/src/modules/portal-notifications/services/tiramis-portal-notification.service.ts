import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';

import { TiramisPortalNotificationEventDto } from '../dto/tiramis-portal-notification-event.dto';

@Injectable()
export class TiramisPortalNotificationService {
  private readonly logger = new Logger(TiramisPortalNotificationService.name);

  constructor(
    @Inject('INSURANCE_PORTAL_SERVICE_CLIENT')
    private readonly portalClient: ClientProxy,
  ) {}

  async publish(event: TiramisPortalNotificationEventDto): Promise<void> {
    if (process.env.TIRAMIS_PORTAL_NOTIFY_ENABLED === 'false') {
      return;
    }

    try {
      await firstValueFrom(
        this.portalClient.emit('tiramis.submission.status.updated', event).pipe(
          timeout(5000),
          catchError((error) => {
            this.logger.warn(
              `Failed to notify insurance portal for requestId ${event.requestId}: ${
                error?.message || 'Unknown error'
              }`,
            );

            return of(null);
          }),
        ),
      );
    } catch (error: any) {
      this.logger.warn(
        `Portal notification publish failed for requestId ${event.requestId}: ${
          error?.message || 'Unknown error'
        }`,
      );
    }
  }
}
