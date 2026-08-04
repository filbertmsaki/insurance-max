import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PortalInvitation } from '../entities/portal-invitation.entity';
import { PortalInvitationStatus } from '../enums/portal.enums';

/**
 * The invitation-acceptance flow already rejects expired tokens at read
 * time (assertInvitationUsable), so this job is not load-bearing for
 * correctness - it exists so PENDING invitations that were simply never
 * opened get reflected as EXPIRED for reporting/listing purposes instead of
 * sitting in PENDING forever.
 */
@Injectable()
export class PortalInvitationExpiryJob {
  private readonly logger = new Logger(PortalInvitationExpiryJob.name);

  constructor(
    @InjectRepository(PortalInvitation)
    private readonly invitationRepository: Repository<PortalInvitation>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleInvitations() {
    const result = await this.invitationRepository
      .createQueryBuilder()
      .update()
      .set({ status: PortalInvitationStatus.EXPIRED })
      .where('status = :status', {
        status: PortalInvitationStatus.PENDING,
      })
      .andWhere('expires_at <= :now', { now: new Date() })
      .execute();

    const affected = result.affected ?? 0;

    if (affected > 0) {
      this.logger.log(`Marked ${affected} portal invitations expired`);
    }
  }
}
