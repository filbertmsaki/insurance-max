import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import {
  optionalNumberEnv,
  TIRAMIS_DEFAULTS,
} from '../../../config/tiramis-defaults';
import { TiramisPortalNotificationService } from './tiramis-portal-notification.service';

@Injectable()
export class TiramisPortalNotificationOutboxWorkerService {
  private readonly logger = new Logger(
    TiramisPortalNotificationOutboxWorkerService.name,
  );
  private isRunning = false;

  constructor(
    private readonly notificationService: TiramisPortalNotificationService,
    private readonly configService: ConfigService,
  ) {}

  @Interval(
    optionalNumberEnv(
      'TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS',
      TIRAMIS_DEFAULTS.portalOutboxIntervalMs,
    ),
  )
  async run() {
    if (
      !this.configService.get<boolean>(
        'tiramisService.portalNotifyEnabled',
        TIRAMIS_DEFAULTS.portalNotifyEnabled,
      )
    ) {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const limit = this.configService.get<number>(
        'tiramisService.portalOutboxBatchSize',
        TIRAMIS_DEFAULTS.portalOutboxBatchSize,
      );
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
