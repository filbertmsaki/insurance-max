import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { NotificationsService } from '../../work-items/notifications.service';
import { WorkItemsService } from '../../work-items/work-items.service';
import { ClaimSlaStatus } from '../enums/claim.enums';
import { ClaimSlaEvent } from '../entities/claim-sla-event.entity';

@Injectable()
export class ClaimSlaMonitorService {
  constructor(
    @InjectRepository(ClaimSlaEvent)
    private readonly eventRepository: Repository<ClaimSlaEvent>,

    private readonly workItemsService: WorkItemsService,

    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 * * * *')
  async monitor(): Promise<void> {
    const overdue = await this.eventRepository.find({
      where: {
        status: ClaimSlaStatus.PENDING,
        due_at: LessThanOrEqual(new Date()),
      },
      take: 500,
      order: {
        due_at: 'ASC',
      },
    });

    for (const event of overdue) {
      event.status = ClaimSlaStatus.BREACHED;
      event.breached_at = new Date();

      await this.eventRepository.save(event);

      await this.workItemsService.create({
        companyId: event.company_id,
        branchId: event.branch_id,
        domain: 'CLAIMS',
        resourceType: 'claim',
        resourceId: event.claim_id,
        title: `Claim SLA breached: ${event.event_type}`,
        priority: 'CRITICAL',
        assignedRole: 'CLAIMS_MANAGER',
        dueAt: event.due_at,
        dedupeKey: `claim-sla-breach:${event.id}`,
        metadata: {
          event_type: event.event_type,
          due_at: event.due_at,
        },
      });

      await this.notificationsService.create({
        companyId: event.company_id,
        branchId: event.branch_id,
        recipientRole: 'CLAIMS_MANAGER',
        type: 'CLAIM_SLA_BREACH',
        severity: 'CRITICAL',
        title: 'Claim SLA breached',
        message: `Claim action ${event.event_type} is overdue.`,
        resourceType: 'claim',
        resourceId: event.claim_id,
        actionUrl: `/claims/${event.claim_id}`,
      });
    }
  }
}
