import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { environment } from '@insurance-max/shared-config';

import { TiramisPortalNotificationService } from './tiramis-portal-notification.service';

@Injectable()
export class TiramisPortalNotificationOutboxWorkerService {
  private readonly logger = new Logger(
    TiramisPortalNotificationOutboxWorkerService.name,
  );
  private isRunning = false;

  constructor(
    private readonly notificationService: TiramisPortalNotificationService,
  ) {}

  @Interval(Number(process.env.TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS || 10000))
  async run() {
    if (environment.TIRAMIS_PORTAL_NOTIFY_ENABLED === 'false') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const limit = Number(environment.TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE || 20);
      await this.notificationService.processDueOutbox(limit);
    } catch (error: any) {
      this.logger.error(
        `Portal notification outbox worker failed: ${
          error?.message || 'Unknown error'
        }`,
        error?.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
