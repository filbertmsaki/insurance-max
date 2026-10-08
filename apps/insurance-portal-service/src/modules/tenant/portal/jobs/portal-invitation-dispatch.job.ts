import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PortalInvitationDeliveryService } from '../services/portal-invitation-delivery.service';

/** Drains the portal invitation email outbox. Safe on several instances. */
@Injectable()
export class PortalInvitationDispatchJob {
  private readonly logger = new Logger(PortalInvitationDispatchJob.name);

  constructor(
    private readonly deliveryService: PortalInvitationDeliveryService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async dispatch() {
    try {
      const { claimed, sent } = await this.deliveryService.dispatchDue();
      if (claimed > 0) {
        this.logger.log(`Portal invitations: sent ${sent} of ${claimed} due`);
      }
    } catch (error) {
      this.logger.error(
        `Portal invitation dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
